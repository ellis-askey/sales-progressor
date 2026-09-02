// lib/services/chase-timeline.ts
//
// Read-only assembler for the Chase Timeline tab (docs/active/chase-timeline-SPEC.md).
// Merges every chase track into one per-file thread view: the client auto-chase
// (ClientChaseState) + manual/agent (ChaseTask + OutboundMessage) lanes (one
// ReminderLog = one thread), the solicitor lane (SolicitorChaseState, with
// completion truth from MilestoneCompletion), the enquiry trackers, and the
// exchange-day overlay. See docs/active/chase-consolidation/00-spec.md.
//
// Pure read: no writes, no schema of its own. The file page already enforces
// access (getTransactionByScope / agencyId), so this scopes by transactionId.

import { prisma } from "@/lib/prisma";
import { toUKDateStr } from "@/lib/utils";
import { isExchangeDayActive } from "@/lib/services/exchange-day";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { getChaseOverridesForTimeline } from "@/lib/services/chase-overrides";

// The client auto-chase pipeline stops after this many emails, then hands the
// file to the team. Mirrors CLIENT_CHASE_COUNT_CAP in client-chase-cron.ts;
// duplicated as a plain constant so this read path pulls in no server-only deps.
const CLIENT_CHASE_CAP = 2;
// The solicitor auto-chase pipeline (softer cadence) also stops after 2, then
// escalates to the team. Mirrors the solicitor-confirm cap.
const SOLICITOR_CHASE_CAP = 2;

export type ChaseThreadState =
  | "scheduled"
  | "auto_chasing"
  | "handed_to_team"
  | "manual_chasing"
  | "escalated"
  | "snoozed"
  | "completed"
  | "cancelled";

export type ChaseEventKind =
  | "scheduled"
  | "auto_chase"
  | "handed"
  | "manual_chase"
  | "escalated"
  | "snoozed"
  | "resolved"
  | "cancelled";

export type ChaseDelivery = "sent" | "delivered" | "opened" | "bounced" | null;

export type ChaseThreadEvent = {
  at: string; // ISO — serialisable for the client component
  kind: ChaseEventKind;
  title: string;
  detail?: string;
  actor?: string; // "By Sales Progressor (Ellis)", "System", etc.
  delivery?: ChaseDelivery;
  ordinal?: { n: number; of: number; by: "auto" | "you" };
};

export type ChaseThread = {
  id: string; // reminderLogId
  title: string;
  side: "vendor" | "purchaser";
  track: "client" | "solicitor" | "enquiry" | "exchange"; // which auto-chase lane owns this thread ("exchange" = the exchange-day overlay)
  trackLabel: string; // "Buyer" / "Seller" / "Buyer's solicitor" / "Seller's solicitor"
  state: ChaseThreadState;
  waitingOn: string; // who owes the action (the client, or the solicitor)
  autoChases: number;
  manualChases: number;
  totalChases: number;
  lastChasedAt: string | null;
  nextDueAt: string | null;
  nextIsAutomated: boolean; // true = autopilot sends next; false = reminder for the team
  escalatesAfter: number; // human chases before urgent
  escalated: boolean;
  snoozedUntil: string | null;
  startedAt: string; // ReminderLog.createdAt
  events: ChaseThreadEvent[];
  // Override target — lets the timeline edit/skip this thread's NEXT chase.
  // Null for enquiry / exchange threads (they aren't client/solicitor chases).
  overrideTarget:
    | { kind: "client"; contactId: string; milestoneCode: string }
    | { kind: "solicitor"; side: "vendor" | "purchaser"; milestoneCode: string }
    | null;
  overrideEdited: boolean;  // a subject/body edit is staged for the next chase
  overrideSkipped: boolean; // the next chase is set to skip
};

export type ChaseTimelineStats = {
  active: number;
  dueToday: number;
  escalating: number;
  completed: number;
};

// Client-chase pause state (re-homed from the Reminders auto-emails card,
// chase-consolidation D4). null = chasing is live. Mirrors the honesty logic in
// lib/services/automated-emails-preview.ts (global > agency > file precedence).
export type ChasePauseState = {
  reason: "global" | "agency" | "file";
  agencyName: string | null;
} | null;

export type ChaseTimeline = {
  stats: ChaseTimelineStats;
  threads: ChaseThread[];
  pause: ChasePauseState;
};

function stripChase(name: string): string {
  return name.replace(/^Chase:\s*/i, "").trim();
}

function sideForCode(code: string | null): "vendor" | "purchaser" {
  return code?.toUpperCase().startsWith("V") ? "vendor" : "purchaser";
}

// State-precedence order for the thread list (most-urgent first).
const STATE_ORDER: Record<ChaseThreadState, number> = {
  escalated: 0,
  manual_chasing: 1,
  handed_to_team: 2,
  auto_chasing: 3,
  scheduled: 4,
  snoozed: 5,
  completed: 6,
  cancelled: 7,
};

export async function getChaseTimeline(
  transactionId: string,
  agencyId: string | null,
): Promise<ChaseTimeline> {
  // Ownership guard mirrors the reminder service: agency users are scoped by
  // agencyId; internal staff (null) already passed the page's scope check.
  const tx = await prisma.propertyTransaction.findFirst({
    where: agencyId ? { id: transactionId, agencyId } : { id: transactionId },
    select: {
      id: true,
      activeBuyerRoundId: true,
      clientEmailsPaused: true,
      agency: { select: { chaseEmailsEnabled: true, name: true } },
      completionDate: true,
      exchangeDayStartedAt: true,
      exchangeDayCancelledAt: true,
      exchangedAt: true,
      exchangeDayMorningEmailAt: true,
      exchangeDayMiddayEmailAt: true,
      exchangeDayAfternoonEmailAt: true,
      exchangeDayClientMorningEmailAt: true,
      exchangeDayClientAuthorityEmailAt: true,
    },
  });
  if (!tx) throw new Error("Transaction not found");

  const [logs, contacts, clientStates, chaseMsgs, solStates, raiseChase, enquiryTracker, completions] = await Promise.all([
    prisma.reminderLog.findMany({
      where: { transactionId, status: { in: ["active", "completed", "cancelled"] } },
      select: {
        id: true,
        status: true,
        nextDueDate: true,
        snoozedUntil: true,
        statusReason: true,
        createdAt: true,
        updatedAt: true,
        reminderRule: {
          select: { name: true, targetMilestoneCode: true, graceDays: true, repeatEveryDays: true, escalateAfterChases: true },
        },
        chaseTasks: {
          select: {
            id: true, status: true, priority: true, chaseCount: true, manualChaseCount: true,
            lastChasedAt: true, fallbackKind: true, escalatedAt: true, updatedAt: true,
            escalatedBy: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    prisma.contact.findMany({
      where: { propertyTransactionId: transactionId },
      select: { id: true, name: true, roleType: true, exchangeAuthorityGivenAt: true },
    }),
    prisma.clientChaseState.findMany({
      where: { transactionId },
      select: { contactId: true, milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, status: true, statusReason: true },
    }),
    prisma.outboundMessage.findMany({
      where: { transactionId, purpose: "chase", isAutomated: false },
      select: { chaseTaskId: true, createdAt: true, recipientName: true, deliveredAt: true, openedAt: true, subject: true, createdByRole: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.solicitorChaseState.findMany({
      where: { transactionId },
      select: { side: true, milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, resolvedAt: true, status: true, statusReason: true, createdAt: true },
    }),
    // Enquiries run on their own trackers (not ReminderLogs): the raise-chase
    // (get enquiries raised) then the reply-loop tracker (whose court is it in).
    prisma.enquiryRaiseChase.findUnique({
      where: { transactionId },
      select: { openedAt: true, lastNudgedAt: true, lastTarget: true, nudgeCount: true, escalatedAt: true, closedAt: true },
    }),
    prisma.enquiryTracker.findUnique({
      where: { transactionId },
      select: { currentlyWith: true, openedAt: true, lastChasedAt: true, chaseCount: true, escalatedAt: true, snoozedUntil: true, closedAt: true, outstandingNote: true },
    }),
    // Active-round milestone completions — the source of truth for whether a
    // solicitor step is still outstanding (SolicitorChaseState.status is stale:
    // confirming a step never closes the row) and for the solicitor snooze
    // (expectedDate), plus the step name for the thread title.
    prisma.milestoneCompletion.findMany({
      where: { transactionId, ...milestoneScopeWhere(forRound(tx.activeBuyerRoundId ?? null, transactionId)) },
      select: { state: true, expectedDate: true, milestoneDefinition: { select: { code: true, side: true, name: true } } },
    }),
  ]);

  // Milestone completion keyed by "side|code" (side matches SolicitorChaseState.side).
  const completionByKey = new Map<string, (typeof completions)[number]>();
  for (const mc of completions) {
    const def = mc.milestoneDefinition;
    if (def) completionByKey.set(`${def.side}|${def.code}`, mc);
  }

  // Agent edit/skip overrides keyed "targetKey|code" (contact:<id>|CODE, sol:<side>|CODE).
  const overrideRows = await getChaseOverridesForTimeline(transactionId);
  const overrideByKey = new Map<string, { edited: boolean; skipped: boolean }>();
  for (const o of overrideRows) {
    overrideByKey.set(`${o.targetKey}|${o.milestoneCode}`, {
      edited: !!(o.subjectOverride || o.bodyOverride),
      skipped: o.skipNext,
    });
  }

  const buyerName = contacts.find((c) => c.roleType === "purchaser")?.name ?? "the buyer";
  const sellerName = contacts.find((c) => c.roleType === "vendor")?.name ?? "the seller";

  // Index client-chase state + manual messages by the thread they belong to.
  const clientByCode = new Map<string, (typeof clientStates)[number]>();
  for (const cs of clientStates) {
    const prev = clientByCode.get(cs.milestoneCode);
    if (!prev || cs.chaseCount > prev.chaseCount) clientByCode.set(cs.milestoneCode, cs);
  }
  const solByCode = new Map<string, (typeof solStates)[number]>();
  for (const s of solStates) {
    const prev = solByCode.get(s.milestoneCode);
    if (!prev || s.chaseCount > prev.chaseCount) solByCode.set(s.milestoneCode, s);
  }
  const msgsByTask = new Map<string, typeof chaseMsgs>();
  for (const m of chaseMsgs) {
    if (!m.chaseTaskId) continue;
    const arr = msgsByTask.get(m.chaseTaskId) ?? [];
    arr.push(m);
    msgsByTask.set(m.chaseTaskId, arr);
  }

  const todayStr = toUKDateStr(new Date());
  const nowMs = Date.now();

  const threads: ChaseThread[] = logs.map((log) => {
    const rule = log.reminderRule;
    const code = rule.targetMilestoneCode;
    const side = sideForCode(code);
    const task = log.chaseTasks[0] ?? null; // most-recently-updated
    const cs = code ? clientByCode.get(code) : undefined;
    const sol = code ? solByCode.get(code) : undefined;
    // A milestone is chased on ONE auto lane: to the solicitor (confirmation
    // steps) or to the client. Solicitor state, when present, owns the thread.
    const track: "client" | "solicitor" = sol ? "solicitor" : "client";
    const autoState = track === "solicitor" ? sol : cs;
    const cap = track === "solicitor" ? SOLICITOR_CHASE_CAP : CLIENT_CHASE_CAP;

    const manualChases = task?.manualChaseCount ?? 0;
    // Auto count reads from whichever auto lane owns this thread (same source as
    // the auto events shown), falling back to the honest total-minus-manual.
    const autoChases = autoState ? autoState.chaseCount : Math.max(0, (task?.chaseCount ?? 0) - manualChases);
    const totalChases = autoChases + manualChases;
    const escalated = task?.priority === "escalated";

    // Snooze can come from the solicitor's expected date (on the milestone
    // completion — the real solicitor snooze; SolicitorChaseState.snoozeUntil is
    // dead/never written) or the reminder log (client "set a date").
    const solSnooze = sol && code ? (completionByKey.get(`${side}|${code}`)?.expectedDate ?? null) : null;
    const snoozeAt = solSnooze && new Date(solSnooze).getTime() > nowMs ? solSnooze
      : log.snoozedUntil && new Date(log.snoozedUntil).getTime() > nowMs ? log.snoozedUntil
      : null;
    const snoozedActive = !!snoozeAt;

    // Autopilot sends next only while its lane is still active and under cap;
    // otherwise "next" is a reminder for the team to act.
    const nextIsAutomated = !!autoState && autoState.status === "active" && autoState.chaseCount < cap;
    const autoHandedOff = !!autoState && autoState.status !== "active" && autoState.chaseCount >= cap;

    let state: ChaseThreadState;
    if (log.status === "completed") state = "completed";
    else if (log.status === "cancelled") state = "cancelled";
    else if (snoozedActive) state = "snoozed";
    else if (escalated) state = "escalated";
    else if (manualChases > 0) state = "manual_chasing";
    else if (task?.fallbackKind || autoHandedOff) state = "handed_to_team";
    else if (autoChases > 0 || nextIsAutomated) state = "auto_chasing";
    else state = "scheduled";

    const clientName = side === "vendor" ? sellerName : buyerName;
    const waitingOn = track === "solicitor"
      ? (side === "vendor" ? "the seller's solicitor" : "the buyer's solicitor")
      : clientName;
    const trackLabel = track === "solicitor"
      ? (side === "vendor" ? "Seller's solicitor" : "Buyer's solicitor")
      : (side === "vendor" ? "Seller" : "Buyer");

    // ── Events (most-recent first) ──
    const events: ChaseThreadEvent[] = [];
    events.push({
      at: log.createdAt.toISOString(),
      kind: "scheduled",
      title: "Chase scheduled",
      detail: rule.graceDays ? `Grace period of ${rule.graceDays} day${rule.graceDays === 1 ? "" : "s"} after the previous step.` : undefined,
      actor: "System",
    });

    // Auto-chases from the owning lane (client or solicitor state, capped at 2).
    // Delivery detail on the auto lane is deferred (opens not tracked there).
    if (autoState && autoState.chaseCount > 0) {
      const autoDates = [autoState.firstChasedAt, autoState.chaseCount >= 2 ? autoState.lastChasedAt : null].filter(Boolean) as Date[];
      autoDates.forEach((d, i) => {
        events.push({
          at: d.toISOString(),
          kind: "auto_chase",
          title: `Auto-chased ${waitingOn}`,
          detail: "Reminder email sent automatically.",
          actor: "System",
          delivery: "sent",
          ordinal: { n: i + 1, of: Math.min(autoState.chaseCount, cap), by: "auto" },
        });
      });
      if (state !== "auto_chasing" && state !== "scheduled" && autoState.chaseCount >= cap && autoState.lastChasedAt) {
        events.push({
          at: autoState.lastChasedAt.toISOString(),
          kind: "handed",
          title: "Autopilot done, handed to your team",
          detail: `${track === "solicitor" ? "Solicitor" : "Client"} auto-chase reached its limit of ${cap}. Now in your work queue.`,
          actor: "System",
        });
      }
    }

    // Manual chases (from OutboundMessage on this thread's task).
    const msgs = task ? msgsByTask.get(task.id) ?? [] : [];
    msgs.forEach((m, i) => {
      events.push({
        at: m.createdAt.toISOString(),
        kind: "manual_chase",
        title: `You chased ${waitingOn}`,
        detail: m.subject ?? undefined,
        actor: m.createdByRole ? `By ${m.createdByRole}` : "Manual chase",
        delivery: m.openedAt ? "opened" : m.deliveredAt ? "delivered" : "sent",
        ordinal: { n: i + 1, of: msgs.length, by: "you" },
      });
    });

    if (escalated && task?.escalatedAt) {
      events.push({
        at: task.escalatedAt.toISOString(),
        kind: "escalated",
        title: "Escalated to file owner",
        detail: `${manualChases} chase${manualChases === 1 ? "" : "s"} by the team with no response.`,
        actor: task.escalatedBy?.name ? `By ${task.escalatedBy.name}` : "System",
      });
    }
    if (state === "completed") {
      events.push({ at: log.updatedAt.toISOString(), kind: "resolved", title: "Confirmed", detail: "Milestone confirmed. Chase closed.", actor: "System" });
    }
    if (state === "cancelled") {
      events.push({ at: log.updatedAt.toISOString(), kind: "cancelled", title: "Stopped", detail: log.statusReason ?? "Chase no longer needed.", actor: "System" });
    }
    if (snoozedActive && snoozeAt) {
      events.push({ at: snoozeAt.toISOString(), kind: "snoozed", title: `Paused until ${toUKDateStr(snoozeAt)}`, detail: (track === "solicitor" ? sol?.statusReason : log.statusReason) ?? "A date was provided.", actor: "System" });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // Override target for edit/skip-the-next-chase from the timeline.
    const clientContactId = cs?.contactId ?? contacts.find((c) => c.roleType === side)?.id ?? null;
    const overrideTarget: ChaseThread["overrideTarget"] =
      !code ? null
      : track === "solicitor" ? { kind: "solicitor", side, milestoneCode: code }
      : clientContactId ? { kind: "client", contactId: clientContactId, milestoneCode: code }
      : null;
    const ovKey = overrideTarget
      ? `${overrideTarget.kind === "solicitor" ? `sol:${overrideTarget.side}` : `contact:${overrideTarget.contactId}`}|${code}`
      : null;
    const ov = ovKey ? overrideByKey.get(ovKey) : undefined;

    return {
      id: log.id,
      title: stripChase(rule.name),
      side,
      track,
      trackLabel,
      state,
      waitingOn,
      autoChases,
      manualChases,
      totalChases,
      lastChasedAt: task?.lastChasedAt?.toISOString() ?? null,
      nextDueAt: log.status === "active" ? log.nextDueDate.toISOString() : null,
      nextIsAutomated,
      escalatesAfter: rule.escalateAfterChases,
      escalated,
      snoozedUntil: snoozeAt ? snoozeAt.toISOString() : null,
      startedAt: log.createdAt.toISOString(),
      events,
      overrideTarget,
      overrideEdited: ov?.edited ?? false,
      overrideSkipped: ov?.skipped ?? false,
    };
  });

  // ── Enquiry threads (their own trackers, not ReminderLogs) ──
  const buyerSolLabel = "the buyer's solicitor";
  const sellerSolLabel = "the seller's solicitor";

  if (raiseChase) {
    const closed = !!raiseChase.closedAt;
    const esc = !!raiseChase.escalatedAt;
    const n = raiseChase.nudgeCount;
    const state: ChaseThreadState = closed ? "completed" : esc ? "escalated" : n > 0 ? "auto_chasing" : "scheduled";
    const events: ChaseThreadEvent[] = [{
      at: raiseChase.openedAt.toISOString(), kind: "scheduled", title: "Chase opened",
      detail: "Chasing to get enquiries raised, from when searches were ordered.", actor: "System",
    }];
    if (raiseChase.lastNudgedAt && n > 0) {
      const tgt = raiseChase.lastTarget === "buyer" ? "the buyer" : buyerSolLabel;
      events.push({ at: raiseChase.lastNudgedAt.toISOString(), kind: "auto_chase", title: `Nudged ${tgt} to get enquiries raised`, detail: `${n} nudge${n === 1 ? "" : "s"} so far.`, actor: "System", delivery: "sent", ordinal: { n, of: n, by: "auto" } });
    }
    if (raiseChase.escalatedAt) events.push({ at: raiseChase.escalatedAt.toISOString(), kind: "escalated", title: "Escalated to file owner", detail: "Enquiries still not raised after repeated nudges.", actor: "System" });
    if (raiseChase.closedAt) events.push({ at: raiseChase.closedAt.toISOString(), kind: "resolved", title: "Enquiries raised", detail: "The reply loop takes over from here.", actor: "System" });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    threads.push({
      id: "enquiry-raise", title: "Getting enquiries raised", side: "purchaser", track: "enquiry",
      trackLabel: "Buyer's solicitor", state, waitingOn: buyerSolLabel,
      autoChases: n, manualChases: 0, totalChases: n,
      lastChasedAt: raiseChase.lastNudgedAt?.toISOString() ?? null,
      nextDueAt: null, nextIsAutomated: !closed && !esc,
      escalatesAfter: 0, escalated: esc, snoozedUntil: null,
      startedAt: raiseChase.openedAt.toISOString(), events,
      overrideTarget: null, overrideEdited: false, overrideSkipped: false,
    });
  }

  if (enquiryTracker) {
    const et = enquiryTracker;
    const closed = !!et.closedAt;
    const esc = !!et.escalatedAt;
    const snoozeAt = et.snoozedUntil && new Date(et.snoozedUntil).getTime() > nowMs ? et.snoozedUntil : null;
    const withSeller = et.currentlyWith === "seller_solicitor";
    const side: "vendor" | "purchaser" = withSeller ? "vendor" : "purchaser";
    const who = withSeller ? sellerSolLabel : buyerSolLabel;
    const n = et.chaseCount;
    const state: ChaseThreadState = closed ? "completed" : snoozeAt ? "snoozed" : esc ? "escalated" : n > 0 ? "auto_chasing" : "scheduled";
    const events: ChaseThreadEvent[] = [{
      at: et.openedAt.toISOString(), kind: "scheduled", title: "Enquiries opened",
      detail: et.outstandingNote ? `Waiting on: ${et.outstandingNote}` : "Enquiries raised, awaiting replies.", actor: "System",
    }];
    if (et.lastChasedAt && n > 0) events.push({ at: et.lastChasedAt.toISOString(), kind: "auto_chase", title: `Chased ${who}`, detail: `${n} chase${n === 1 ? "" : "s"} so far.`, actor: "System", delivery: "sent", ordinal: { n, of: n, by: "auto" } });
    if (et.escalatedAt) events.push({ at: et.escalatedAt.toISOString(), kind: "escalated", title: "Escalated to file owner", detail: "Enquiries outstanding after repeated chases.", actor: "System" });
    if (snoozeAt) events.push({ at: snoozeAt.toISOString(), kind: "snoozed", title: `Paused until ${toUKDateStr(snoozeAt)}`, detail: "A date was provided.", actor: "System" });
    if (et.closedAt) events.push({ at: et.closedAt.toISOString(), kind: "resolved", title: "Enquiries satisfied", detail: "All enquiries answered. Nothing left to chase.", actor: "System" });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    threads.push({
      id: "enquiry-tracker", title: "Outstanding enquiries", side, track: "enquiry",
      trackLabel: withSeller ? "Seller's solicitor" : "Buyer's solicitor", state, waitingOn: who,
      autoChases: n, manualChases: 0, totalChases: n,
      lastChasedAt: et.lastChasedAt?.toISOString() ?? null,
      nextDueAt: null, nextIsAutomated: !closed && !esc && !snoozeAt,
      escalatesAfter: 0, escalated: esc, snoozedUntil: snoozeAt?.toISOString() ?? null,
      startedAt: et.openedAt.toISOString(), events,
      overrideTarget: null, overrideEdited: false, overrideSkipped: false,
    });
  }

  // ── Exchange-day thread (an overlay, not a milestone chase) ──
  // Derived purely from the transaction's stamp columns + per-contact authority
  // timestamps, exactly like the enquiry trackers above — no ReminderLog, no
  // ChaseTask, no writes. Appears whenever exchange day was ever started, and
  // stays on as history (under "Resolved & stopped") once the day passes.
  if (tx.exchangeDayStartedAt) {
    const startedAt = tx.exchangeDayStartedAt;
    const active = isExchangeDayActive({
      exchangeDayStartedAt: tx.exchangeDayStartedAt,
      exchangeDayCancelledAt: tx.exchangeDayCancelledAt,
      exchangedAt: tx.exchangedAt,
    });
    const exchanged = !!tx.exchangedAt;
    const cancelledThisRun = !!tx.exchangeDayCancelledAt && tx.exchangeDayCancelledAt >= startedAt;

    const events: ChaseThreadEvent[] = [];
    const compDate = tx.completionDate ? toUKDateStr(tx.completionDate) : null;
    events.push({
      at: startedAt.toISOString(),
      kind: "scheduled",
      title: "Exchange day started",
      detail: compDate ? `Aiming to exchange today, with completion agreed for ${compDate}.` : "Aiming to exchange contracts today.",
      actor: "System",
    });

    const emailEvent = (stamp: Date | null, title: string) => {
      if (!stamp) return;
      events.push({ at: stamp.toISOString(), kind: "auto_chase", title, detail: "Sent automatically.", actor: "System", delivery: "sent" });
    };
    emailEvent(tx.exchangeDayMorningEmailAt, "Emailed both solicitors, morning check-in");
    emailEvent(tx.exchangeDayClientMorningEmailAt, "Emailed the buyer and seller, what today means");
    emailEvent(tx.exchangeDayClientAuthorityEmailAt, "Asked the buyer and seller for authority to exchange");
    emailEvent(tx.exchangeDayMiddayEmailAt, "Emailed both solicitors, midday push");
    emailEvent(tx.exchangeDayAfternoonEmailAt, "Emailed both solicitors, afternoon push");

    // Authority given (only counts for the current activation).
    for (const c of contacts) {
      if ((c.roleType === "vendor" || c.roleType === "purchaser") && c.exchangeAuthorityGivenAt && c.exchangeAuthorityGivenAt >= startedAt) {
        const who = c.roleType === "vendor" ? "Seller" : "Buyer";
        events.push({ at: c.exchangeAuthorityGivenAt.toISOString(), kind: "resolved", title: `${who} gave authority to exchange`, detail: `${c.name} confirmed we can proceed.`, actor: c.name });
      }
    }

    if (exchanged && tx.exchangedAt) {
      events.push({ at: tx.exchangedAt.toISOString(), kind: "resolved", title: "Exchanged", detail: "Contracts exchanged. Completion is next.", actor: "System" });
    } else if (cancelledThisRun && tx.exchangeDayCancelledAt) {
      events.push({ at: tx.exchangeDayCancelledAt.toISOString(), kind: "cancelled", title: "Exchange day ended", detail: "No longer aiming to exchange today.", actor: "System" });
    }

    const emailStamps = [
      tx.exchangeDayMorningEmailAt, tx.exchangeDayMiddayEmailAt, tx.exchangeDayAfternoonEmailAt,
      tx.exchangeDayClientMorningEmailAt, tx.exchangeDayClientAuthorityEmailAt,
    ].filter((d): d is Date => !!d);
    const autoChases = emailStamps.length;
    const lastEmailAt = emailStamps.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const state: ChaseThreadState = exchanged ? "completed" : active ? "auto_chasing" : "cancelled";
    const waitingOn = active ? "both solicitors and the clients" : exchanged ? "no one, contracts exchanged" : "no one, exchange day has ended";

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    threads.push({
      id: "exchange-day",
      title: "Exchange day",
      side: "purchaser",
      track: "exchange",
      trackLabel: "Both sides",
      state,
      waitingOn,
      autoChases,
      manualChases: 0,
      totalChases: autoChases,
      lastChasedAt: lastEmailAt ? lastEmailAt.toISOString() : null,
      nextDueAt: null,
      nextIsAutomated: active,
      escalatesAfter: 0,
      escalated: false,
      snoozedUntil: null,
      startedAt: startedAt.toISOString(),
      events,
      overrideTarget: null, overrideEdited: false, overrideSkipped: false,
    });
  }

  // ── Solicitor threads for solicitor-owned steps with NO client ReminderLog
  //    (VM5/VM7/VM8/PM7/PM13/… — chased to the solicitor, not the client). The
  //    logs.map above only surfaces a solicitor thread when a client ReminderLog
  //    happens to share the code; these steps have none, so project them here
  //    from SolicitorChaseState. Completion + snooze truth come from the active-
  //    round MilestoneCompletion (the state row's `status` is stale — confirming
  //    a step never closes it). Read-only; no writes, no sends.
  const codesWithThread = new Set(
    logs.map((l) => l.reminderRule.targetMilestoneCode).filter((c): c is string => !!c),
  );
  for (const row of solStates) {
    if (codesWithThread.has(row.milestoneCode)) continue; // already threaded via a client log
    const mc = completionByKey.get(`${row.side}|${row.milestoneCode}`);
    if (!mc?.milestoneDefinition) continue; // no active-round completion → stale cross-round state
    const side: "vendor" | "purchaser" = row.side === "vendor" ? "vendor" : "purchaser";
    const done = mc.state === "complete" || mc.state === "not_required" || row.status === "resolved";
    const snoozeAt = !done && mc.expectedDate && mc.expectedDate.getTime() > nowMs ? mc.expectedDate : null;
    const escalated = row.status === "escalated";
    const n = row.chaseCount;
    const capped = n >= SOLICITOR_CHASE_CAP;
    const state: ChaseThreadState = done ? "completed"
      : snoozeAt ? "snoozed"
      : escalated ? "escalated"
      : capped ? "handed_to_team"
      : n > 0 ? "auto_chasing"
      : "scheduled";
    const who = side === "vendor" ? "the seller's solicitor" : "the buyer's solicitor";

    const events: ChaseThreadEvent[] = [{
      at: row.createdAt.toISOString(), kind: "scheduled", title: "Chase scheduled",
      detail: "Chasing the solicitor to confirm this step.", actor: "System",
    }];
    const autoDates = [row.firstChasedAt, n >= 2 ? row.lastChasedAt : null].filter(Boolean) as Date[];
    autoDates.forEach((d, i) => events.push({
      at: d.toISOString(), kind: "auto_chase", title: `Auto-chased ${who}`,
      detail: "Reminder email sent automatically.", actor: "System", delivery: "sent",
      ordinal: { n: i + 1, of: Math.min(n, SOLICITOR_CHASE_CAP), by: "auto" },
    }));
    if (capped && !done && row.lastChasedAt) events.push({
      at: row.lastChasedAt.toISOString(), kind: "handed", title: "Autopilot done, handed to your team",
      detail: `Solicitor auto-chase reached its limit of ${SOLICITOR_CHASE_CAP}. Now in your work queue.`, actor: "System",
    });
    if (escalated && row.lastChasedAt) events.push({
      at: row.lastChasedAt.toISOString(), kind: "escalated", title: "Escalated to file owner",
      detail: "Solicitor unresponsive after repeated chases.", actor: "System",
    });
    if (done) events.push({
      at: (row.resolvedAt ?? row.lastChasedAt ?? row.createdAt).toISOString(), kind: "resolved",
      title: "Confirmed", detail: "Step confirmed. Chase closed.", actor: "System",
    });
    if (snoozeAt) events.push({
      at: snoozeAt.toISOString(), kind: "snoozed", title: `Paused until ${toUKDateStr(snoozeAt)}`,
      detail: "The solicitor gave an expected date.", actor: "System",
    });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    threads.push({
      id: `sol-${row.side}-${row.milestoneCode}`,
      title: stripChase(mc.milestoneDefinition.name),
      side, track: "solicitor",
      trackLabel: side === "vendor" ? "Seller's solicitor" : "Buyer's solicitor",
      state, waitingOn: who,
      autoChases: n, manualChases: 0, totalChases: n,
      lastChasedAt: row.lastChasedAt?.toISOString() ?? null,
      nextDueAt: null, // precise next-due prediction lands with the next-email work
      nextIsAutomated: !done && !snoozeAt && !escalated && n < SOLICITOR_CHASE_CAP,
      escalatesAfter: SOLICITOR_CHASE_CAP,
      escalated, snoozedUntil: snoozeAt?.toISOString() ?? null,
      startedAt: row.createdAt.toISOString(), events,
      overrideTarget: { kind: "solicitor", side, milestoneCode: row.milestoneCode },
      overrideEdited: overrideByKey.get(`sol:${side}|${row.milestoneCode}`)?.edited ?? false,
      overrideSkipped: overrideByKey.get(`sol:${side}|${row.milestoneCode}`)?.skipped ?? false,
    });
  }

  // Sort: state precedence, then soonest next-due.
  threads.sort((a, b) => {
    const s = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (s !== 0) return s;
    const an = a.nextDueAt ? new Date(a.nextDueAt).getTime() : Infinity;
    const bn = b.nextDueAt ? new Date(b.nextDueAt).getTime() : Infinity;
    return an - bn;
  });

  const activeStates: ChaseThreadState[] = ["scheduled", "auto_chasing", "handed_to_team", "manual_chasing", "escalated"];
  // Stat cards count the milestone + enquiry chase engine only. The exchange-day
  // overlay shows as its own thread but is deliberately excluded from these
  // counters so "Active chases" stays a clean count of real chases.
  const statThreads = threads.filter((t) => t.track !== "exchange");
  const stats: ChaseTimelineStats = {
    active: statThreads.filter((t) => activeStates.includes(t.state)).length,
    dueToday: statThreads.filter((t) => t.nextDueAt && toUKDateStr(new Date(t.nextDueAt)) === todayStr && activeStates.includes(t.state)).length,
    escalating: statThreads.filter((t) => t.state === "escalated").length,
    completed: statThreads.filter((t) => t.state === "completed").length,
  };

  // Pause pill (D4): honest client-chase pause state, global > agency > file.
  // Anything other than the literal string "true" leaves chases globally dormant.
  const pause: ChasePauseState =
    process.env.CLIENT_CHASE_ENABLED !== "true"
      ? { reason: "global", agencyName: tx.agency?.name ?? null }
      : tx.agency?.chaseEmailsEnabled === false
        ? { reason: "agency", agencyName: tx.agency?.name ?? null }
        : tx.clientEmailsPaused === true
          ? { reason: "file", agencyName: tx.agency?.name ?? null }
          : null;

  return { stats, threads, pause };
}
