// lib/services/chase-timeline.ts
//
// Read-only assembler for the Chase Timeline tab (docs/active/chase-timeline-SPEC.md).
// Merges the client auto-chase track (ClientChaseState) and the manual/agent
// track (ChaseTask + OutboundMessage) into one per-file view organised by
// THREAD (one ReminderLog = one thread). Solicitor track + enquiries land in v2.
//
// Pure read: no writes, no schema of its own. The file page already enforces
// access (getTransactionByScope / agencyId), so this scopes by transactionId.

import { prisma } from "@/lib/prisma";
import { toUKDateStr } from "@/lib/utils";

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
  track: "client" | "solicitor" | "enquiry"; // which auto-chase lane owns this thread
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
};

export type ChaseTimelineStats = {
  active: number;
  dueToday: number;
  escalating: number;
  completed: number;
};

export type ChaseTimeline = {
  stats: ChaseTimelineStats;
  threads: ChaseThread[];
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
    select: { id: true },
  });
  if (!tx) throw new Error("Transaction not found");

  const [logs, contacts, clientStates, chaseMsgs, solStates, raiseChase, enquiryTracker] = await Promise.all([
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
      select: { name: true, roleType: true },
    }),
    prisma.clientChaseState.findMany({
      where: { transactionId },
      select: { milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, status: true, statusReason: true },
    }),
    prisma.outboundMessage.findMany({
      where: { transactionId, purpose: "chase", isAutomated: false },
      select: { chaseTaskId: true, createdAt: true, recipientName: true, deliveredAt: true, openedAt: true, subject: true, createdByRole: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.solicitorChaseState.findMany({
      where: { transactionId },
      select: { milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, snoozeUntil: true, status: true, statusReason: true },
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
  ]);

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

    // Snooze can come from the solicitor state (a date the firm gave) or the
    // reminder log (client "set a date").
    const solSnooze = sol?.snoozeUntil ?? null;
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
      at: et.openedAt.toISOString(), kind: "scheduled", title: "Reply loop opened",
      detail: et.outstandingNote ? `Waiting on: ${et.outstandingNote}` : "Enquiries raised, awaiting replies.", actor: "System",
    }];
    if (et.lastChasedAt && n > 0) events.push({ at: et.lastChasedAt.toISOString(), kind: "auto_chase", title: `Chased ${who}`, detail: `${n} chase${n === 1 ? "" : "s"} so far.`, actor: "System", delivery: "sent", ordinal: { n, of: n, by: "auto" } });
    if (et.escalatedAt) events.push({ at: et.escalatedAt.toISOString(), kind: "escalated", title: "Escalated to file owner", detail: "Enquiries outstanding after repeated chases.", actor: "System" });
    if (snoozeAt) events.push({ at: snoozeAt.toISOString(), kind: "snoozed", title: `Paused until ${toUKDateStr(snoozeAt)}`, detail: "A date was provided.", actor: "System" });
    if (et.closedAt) events.push({ at: et.closedAt.toISOString(), kind: "resolved", title: "Enquiries satisfied", detail: "All enquiries answered. Loop closed.", actor: "System" });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    threads.push({
      id: "enquiry-tracker", title: "Outstanding enquiries", side, track: "enquiry",
      trackLabel: withSeller ? "Seller's solicitor" : "Buyer's solicitor", state, waitingOn: who,
      autoChases: n, manualChases: 0, totalChases: n,
      lastChasedAt: et.lastChasedAt?.toISOString() ?? null,
      nextDueAt: null, nextIsAutomated: !closed && !esc && !snoozeAt,
      escalatesAfter: 0, escalated: esc, snoozedUntil: snoozeAt?.toISOString() ?? null,
      startedAt: et.openedAt.toISOString(), events,
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
  const stats: ChaseTimelineStats = {
    active: threads.filter((t) => activeStates.includes(t.state)).length,
    dueToday: threads.filter((t) => t.nextDueAt && toUKDateStr(new Date(t.nextDueAt)) === todayStr && activeStates.includes(t.state)).length,
    escalating: threads.filter((t) => t.state === "escalated").length,
    completed: threads.filter((t) => t.state === "completed").length,
  };

  return { stats, threads };
}
