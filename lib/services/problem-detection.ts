import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic";

export type FlagKind =
  | "long_silence"
  | "milestone_stalled"
  | "chase_unanswered"
  | "exchange_approaching_gaps"
  | "on_hold_extended"
  | "no_portal_activity"
  | "overdue_milestone";

const FLAG_LABELS: Record<FlagKind, string> = {
  long_silence: "No recent contact",
  milestone_stalled: "Progress stalled",
  chase_unanswered: "Unanswered chase",
  exchange_approaching_gaps: "Exchange approaching",
  on_hold_extended: "Extended hold",
  no_portal_activity: "No portal engagement",
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
  _count: { milestoneCompletions: number };
  communications: { createdAt: Date; type: string }[];
  chaseTasks: { dueDate: Date }[];
  contacts: { portalToken: string | null }[];
  milestoneCompletions: { completedAt: Date }[];
};

type DetectedFlag = { kind: FlagKind; context: string };

function detectFlags(tx: TxData): DetectedFlag[] {
  const now = Date.now();
  const flags: DetectedFlag[] = [];

  // Long silence: no outbound/inbound comm in ≥10 days (active files only)
  if (tx.status === "active") {
    const commsSorted = tx.communications
      .filter((c) => c.type === "outbound" || c.type === "inbound")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const lastComm = commsSorted[0]?.createdAt;
    const daysSilent = lastComm
      ? Math.floor((now - new Date(lastComm).getTime()) / 86400000)
      : Math.floor((now - new Date(tx.createdAt).getTime()) / 86400000);
    if (daysSilent >= 10) {
      flags.push({ kind: "long_silence", context: `No communication recorded in ${daysSilent} days` });
    }
  }

  // Milestone stalled: >25% behind benchmark
  if (tx.status === "active") {
    const completedCount = tx._count.milestoneCompletions;
    const weeksElapsed = (now - new Date(tx.createdAt).getTime()) / (7 * 86400000);
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
    const daysActive = Math.floor((now - new Date(tx.createdAt).getTime()) / 86400000);
    const hasPortalContacts = tx.contacts.some((c) => c.portalToken);
    const hasInbound = tx.communications.some((c) => c.type === "inbound");
    if (daysActive >= 14 && hasPortalContacts && !hasInbound) {
      flags.push({ kind: "no_portal_activity", context: `Portal set up ${daysActive} days ago but no client activity recorded` });
    }
  }

  // Overdue milestone: no new milestone in ≥21 days, not near completion
  if (tx.status === "active") {
    const completedCount = tx._count.milestoneCompletions;
    const sorted = [...tx.milestoneCompletions].sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
    const lastMilestoneAt = sorted[0]?.completedAt;
    if (lastMilestoneAt && completedCount > 0 && completedCount < 35) {
      const daysSince = Math.floor((now - new Date(lastMilestoneAt).getTime()) / 86400000);
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
  const transactions = await prisma.propertyTransaction.findMany({
    where: { agencyId, status: { in: ["active", "on_hold"] } },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      expectedExchangeDate: true,
      _count: {
        select: { milestoneCompletions: { where: { isActive: true, isNotRequired: false } } },
      },
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
      contacts: { select: { portalToken: true } },
      milestoneCompletions: {
        where: { isActive: true, isNotRequired: false },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: { completedAt: true },
      },
    },
  });

  // We need inbound comms separately for no_portal_activity check — fetch inline
  let flagsCreated = 0;

  for (const tx of transactions) {
    // Enrich with inbound count for portal activity check
    const inboundCount = await prisma.communicationRecord.count({
      where: { transactionId: tx.id, type: "inbound" },
    });
    const enriched: TxData = {
      ...tx,
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
