import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";

export type FlagKind =
  | "long_silence"
  | "milestone_stalled"
  | "chase_unanswered"
  | "exchange_approaching_gaps"
  | "on_hold_extended"
  | "no_portal_activity"
  | "portal_gone_quiet"
  | "overdue_milestone";

const FLAG_LABELS: Record<FlagKind, string> = {
  long_silence: "No recent contact",
  milestone_stalled: "Progress stalled",
  chase_unanswered: "Unanswered chase",
  exchange_approaching_gaps: "Exchange approaching",
  on_hold_extended: "Extended hold",
  no_portal_activity: "No portal engagement",
  portal_gone_quiet: "Client gone quiet",
  overdue_milestone: "Overdue milestone",
};

export { FLAG_LABELS };

type TxData = {
  id: string;
  propertyAddress: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  expectedExchangeDate: Date | null;
  // Pass 3 B4: active round's createdAt is the anchor for "weeks elapsed" /
  // "days silent" / "days active" on relisted files. Null on legacy
  // pre-Phase-1 files; callers fall back to tx.createdAt.
  activeRoundCreatedAt: Date | null;
  _count: { milestoneCompletions: number };
  communications: { createdAt: Date; type: string }[];
  chaseTasks: { dueDate: Date }[];
  contacts: { portalToken: string | null; visitDayCount: number; lastVisitDay: string | null }[];
  milestoneCompletions: { completedAt: Date | null }[];
};

type DetectedFlag = { kind: FlagKind; context: string };

function detectFlags(tx: TxData): DetectedFlag[] {
  const now = Date.now();
  const flags: DetectedFlag[] = [];
  // Pass 3 B4: anchor "since the file started" metrics on the active sale's
  // createdAt when present. Legacy pre-Phase-1 files fall back to tx.createdAt.
  const fileStartAnchor = tx.activeRoundCreatedAt ?? tx.createdAt;

  // Long silence: no outbound/inbound comm in ≥10 days (active files only)
  if (tx.status === "active") {
    const commsSorted = tx.communications
      .filter((c) => c.type === "outbound" || c.type === "inbound")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastComm = commsSorted[0]?.createdAt;
    const daysSilent = lastComm
      ? Math.floor((now - new Date(lastComm).getTime()) / 86400000)
      : Math.floor((now - new Date(fileStartAnchor).getTime()) / 86400000);
    if (daysSilent >= 10) {
      flags.push({ kind: "long_silence", context: `No communication recorded in ${daysSilent} days` });
    }
  }

  // Milestone stalled: >25% behind benchmark
  if (tx.status === "active") {
    const completedCount = tx._count.milestoneCompletions;
    const weeksElapsed = (now - new Date(fileStartAnchor).getTime()) / (7 * 86400000);
    const actualPercent = Math.min(100, (completedCount / 38) * 100);
    const expectedPercent = Math.min(100, (weeksElapsed / 12) * 100);
    const diff = actualPercent - expectedPercent;
    if (completedCount > 0 && diff < -25) {
      flags.push({
        kind: "milestone_stalled",
        context: `${completedCount} milestones complete but expected ~${Math.round((expectedPercent / 100) * 38)} by now (${Math.round(weeksElapsed)} weeks in)`,
      });
    }
  }

  // Chase unanswered: pending chase task ≥7 days overdue
  const overdueChase = tx.chaseTasks.find(
    (t) => (now - new Date(t.dueDate).getTime()) / 86400000 >= 7
  );
  if (overdueChase) {
    const daysOverdue = Math.floor((now - new Date(overdueChase.dueDate).getTime()) / 86400000);
    flags.push({ kind: "chase_unanswered", context: `Pending chase task is ${daysOverdue} days overdue` });
  }

  // Exchange approaching with low milestone completion
  if (tx.status === "active" && tx.expectedExchangeDate) {
    const daysToExchange = Math.floor(
      (new Date(tx.expectedExchangeDate).getTime() - now) / 86400000
    );
    const completedCount = tx._count.milestoneCompletions;
    if (daysToExchange >= 0 && daysToExchange <= 14 && completedCount < 25) {
      flags.push({
        kind: "exchange_approaching_gaps",
        context: `Exchange target in ${daysToExchange} days but only ${completedCount} milestones complete`,
      });
    }
  }

  // On hold extended: on hold ≥14 days
  if (tx.status === "on_hold") {
    const daysOnHold = Math.floor((now - new Date(tx.updatedAt).getTime()) / 86400000);
    if (daysOnHold >= 14) {
      flags.push({ kind: "on_hold_extended", context: `File has been on hold for ${daysOnHold} days` });
    }
  }

  // No portal activity: active ≥14 days, contacts have tokens, zero inbound comms
  if (tx.status === "active") {
    const daysActive = Math.floor((now - new Date(fileStartAnchor).getTime()) / 86400000);
    const hasPortalContacts = tx.contacts.some((c) => c.portalToken);
    const hasInbound = tx.communications.some((c) => c.type === "inbound");
    if (daysActive >= 14 && hasPortalContacts && !hasInbound) {
      flags.push({ kind: "no_portal_activity", context: `Portal set up ${daysActive} days ago but no client activity recorded` });
    }
  }

  // Client gone quiet: a client who was CHECKING IN regularly (portal visits
  // on ≥3 distinct days) and then stopped for ≥14 days. The single strongest
  // early sign of a wobble. Distinct from no_portal_activity (which is "never
  // engaged"). Portal-only signal — WhatsApp isn't reliably logged, so we
  // don't try to infer engagement from it. (Audit #6.)
  if (tx.status === "active") {
    const ENGAGED_DISTINCT_DAYS = 3;
    const QUIET_DAYS = 14;
    for (const c of tx.contacts) {
      if (c.visitDayCount >= ENGAGED_DISTINCT_DAYS && c.lastVisitDay) {
        const daysSince = Math.floor((now - new Date(`${c.lastVisitDay}T00:00:00Z`).getTime()) / 86400000);
        if (daysSince >= QUIET_DAYS) {
          flags.push({ kind: "portal_gone_quiet", context: `A client was checking the portal regularly but hasn't in ${daysSince} days` });
          break; // one flag per file even if both sides went quiet
        }
      }
    }
  }

  // Overdue milestone: no new milestone in ≥21 days, not near completion.
  // Pass 3c: clamp the "last milestone" reference forward to the active
  // round's createdAt — a relist is itself progress, so surviving vendor
  // VMs from before the relist don't read "overdue" on a fresh sale.
  if (tx.status === "active") {
    const completedCount = tx._count.milestoneCompletions;
    const sorted = [...tx.milestoneCompletions].sort(
      (a, b) => (b.completedAt ? new Date(b.completedAt).getTime() : 0) - (a.completedAt ? new Date(a.completedAt).getTime() : 0)
    );
    const lastMilestoneAt = sorted[0]?.completedAt;
    if (lastMilestoneAt && completedCount > 0 && completedCount < 35) {
      const reference = tx.activeRoundCreatedAt
        ? new Date(Math.max(new Date(lastMilestoneAt).getTime(), tx.activeRoundCreatedAt.getTime()))
        : new Date(lastMilestoneAt);
      const daysSince = Math.floor((now - reference.getTime()) / 86400000);
      if (daysSince >= 21) {
        flags.push({ kind: "overdue_milestone", context: `No milestone completed in ${daysSince} days` });
      }
    }
  }

  return flags;
}

async function generateReasons(
  address: string,
  flags: DetectedFlag[]
): Promise<Record<string, string>> {
  if (flags.length === 0) return {};

  const flagLines = flags.map((f) => `- ${f.kind}: ${f.context}`).join("\n");

  const system = `You are a property conveyancing assistant. Write a brief plain-English description (max 12 words each) for each warning sign. These are shown to property sales progressors. Be factual and specific. Return valid JSON only — nothing else.`;

  const user = `Transaction: ${address}

Warning signs detected:
${flagLines}

Return JSON array: [{"kind":"...","reason":"..."}]`;

  try {
    const raw = await callClaude(system, user, 400);
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON array found");
    const parsed: { kind: string; reason: string }[] = JSON.parse(jsonMatch[0]);
    const result: Record<string, string> = {};
    for (const item of parsed) result[item.kind] = item.reason;
    for (const f of flags) {
      if (!result[f.kind]) result[f.kind] = f.context;
    }
    return result;
  } catch {
    const result: Record<string, string> = {};
    for (const f of flags) result[f.kind] = f.context;
    return result;
  }
}

export async function detectAndStoreFlags(agencyId: string): Promise<number> {
  // PHASE 1 4d (b)-CLASS — detection action surface, restructured to
  // two-step to enforce round scoping per-tx.
  //
  // detectFlags() decides which transactionFlag rows get CREATED for
  // each file (milestone_stalled, chase_unanswered, overdue_milestone,
  // etc.) — those flags drive UI alerts AND the work-queue surface
  // the agent acts on. Under-scoping here would:
  //   * Hide a "milestone_stalled" flag that SHOULD fire on the new
  //     round of a relisted file, because an archived round's
  //     completedAt counts as "recent activity"
  //   * Surface stale _count of completions making the file look
  //     further along than it is
  // Both are action-affecting masking the user explicitly flagged
  // (4d preview: "chains.ts and problem-detection.ts deserve
  // particular suspicion since detection logic tends to drive
  // actions").
  //
  // The cross-tx fetch drops the milestoneCompletions include +
  // _count; per-tx fetch inside the loop uses forRound for proper
  // scoping. activeBuyerRoundId added to the parent select so the
  // per-tx loop has it without an extra round-trip.
  const transactions = await prisma.propertyTransaction.findMany({
    where: { agencyId, status: { in: ["active", "on_hold"] } },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      expectedExchangeDate: true,
      activeBuyerRoundId: true,
      // Pass 3 B4: relist-aware "weeks elapsed" / "days silent" anchor.
      activeBuyerRound: { select: { createdAt: true } },
      communications: {
        where: { type: { in: ["outbound", "inbound"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, type: true },
      },
      chaseTasks: {
        where: { status: "pending" },
        orderBy: { dueDate: "asc" },
        take: 3,
        select: { dueDate: true },
      },
      contacts: { select: { id: true, portalToken: true } },
    },
  });

  // We need inbound comms separately for no_portal_activity check — fetch inline
  let flagsCreated = 0;

  for (const tx of transactions) {
    // Per-tx round-scoped MC reads — the two pieces detectFlags needs:
    // count of complete rows (for _count.milestoneCompletions) and the
    // most-recent completedAt (for milestoneCompletions[0]?.completedAt).
    const scope = forRound(tx.activeBuyerRoundId, tx.id);
    const [completedCount, lastCompleted] = await Promise.all([
      prisma.milestoneCompletion.count({
        where: {
          transactionId: tx.id,
          state: "complete",
          ...milestoneScopeWhere(scope),
        },
      }),
      prisma.milestoneCompletion.findFirst({
        where: {
          transactionId: tx.id,
          state: "complete",
          ...milestoneScopeWhere(scope),
        },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
    ]);

    // Enrich with inbound count for portal activity check
    const inboundCount = await prisma.outboundMessage.count({
      where: { transactionId: tx.id, type: "inbound" },
    });

    // Per-contact portal-visit history (audit #6): distinct visit-days + the
    // most recent, so detectFlags can tell "was engaged then went quiet" from
    // "never engaged".
    const contactIds = tx.contacts.map((c) => c.id);
    const visitAgg = contactIds.length
      ? await prisma.portalVisit.groupBy({
          by: ["contactId"],
          where: { contactId: { in: contactIds } },
          _count: { day: true },
          _max: { day: true },
        })
      : [];
    const visitByContact = new Map(
      visitAgg.map((v) => [v.contactId, { count: v._count.day, lastDay: v._max.day }]),
    );

    const enriched: TxData = {
      ...tx,
      activeRoundCreatedAt: tx.activeBuyerRound?.createdAt ?? null,
      _count: { milestoneCompletions: completedCount },
      milestoneCompletions: lastCompleted ? [lastCompleted] : [],
      contacts: tx.contacts.map((c) => {
        const v = visitByContact.get(c.id);
        return { portalToken: c.portalToken, visitDayCount: v?.count ?? 0, lastVisitDay: v?.lastDay ?? null };
      }),
      communications: [
        ...tx.communications,
        ...(inboundCount > 0 ? [{ createdAt: new Date(), type: "inbound" }] : []),
      ],
    };

    const detected = detectFlags(enriched);
    const detectedKinds = new Set(detected.map((f) => f.kind));

    // Resolve flags that no longer apply
    await prisma.transactionFlag.updateMany({
      where: {
        transactionId: tx.id,
        resolvedAt: null,
        kind: { notIn: [...detectedKinds] },
      },
      data: { resolvedAt: new Date() },
    });

    if (detected.length === 0) continue;

    const existing = await prisma.transactionFlag.findMany({
      where: { transactionId: tx.id, resolvedAt: null },
      select: { kind: true },
    });
    const existingKinds = new Set(existing.map((f) => f.kind));
    const newFlags = detected.filter((f) => !existingKinds.has(f.kind));

    if (newFlags.length === 0) continue;

    const reasons = await generateReasons(tx.propertyAddress, newFlags);

    for (const flag of newFlags) {
      await prisma.transactionFlag.upsert({
        where: { transactionId_kind: { transactionId: tx.id, kind: flag.kind } },
        create: {
          transactionId: tx.id,
          agencyId,
          kind: flag.kind,
          reason: reasons[flag.kind] ?? flag.context,
          detectedAt: new Date(),
        },
        update: {
          reason: reasons[flag.kind] ?? flag.context,
          resolvedAt: null,
          detectedAt: new Date(),
        },
      });
      flagsCreated++;
    }
  }

  return flagsCreated;
}

export async function getActiveFlags(agencyId: string) {
  return prisma.transactionFlag.findMany({
    where: { agencyId, resolvedAt: null },
    orderBy: { detectedAt: "desc" },
    select: {
      id: true,
      kind: true,
      reason: true,
      detectedAt: true,
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          status: true,
          assignedUser: { select: { name: true } },
        },
      },
    },
  });
}
