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
  state: ChaseThreadState;
  waitingOn: string; // who owes the action (the buyer/seller by side)
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

  const [logs, contacts, clientStates, chaseMsgs] = await Promise.all([
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
  ]);

  const buyerName = contacts.find((c) => c.roleType === "purchaser")?.name ?? "the buyer";
  const sellerName = contacts.find((c) => c.roleType === "vendor")?.name ?? "the seller";

  // Index client-chase state + manual messages by the thread they belong to.
  const clientByCode = new Map<string, (typeof clientStates)[number]>();
  for (const cs of clientStates) {
    const prev = clientByCode.get(cs.milestoneCode);
    if (!prev || cs.chaseCount > prev.chaseCount) clientByCode.set(cs.milestoneCode, cs);
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

    const manualChases = task?.manualChaseCount ?? 0;
    // Auto count reads from the client-chase track (same source as the auto
    // events) so the badge always matches the events shown. Falls back to the
    // honest total-minus-manual when a thread has no client-chase state.
    const autoChases = cs ? cs.chaseCount : Math.max(0, (task?.chaseCount ?? 0) - manualChases);
    const totalChases = autoChases + manualChases;
    const escalated = task?.priority === "escalated";
    const snoozedActive = !!log.snoozedUntil && new Date(log.snoozedUntil).getTime() > nowMs;

    // Autopilot sends next only while the client track is still active and under
    // its cap; otherwise "next" is a reminder for the team to act.
    const nextIsAutomated = !!cs && cs.status === "active" && cs.chaseCount < CLIENT_CHASE_CAP;

    let state: ChaseThreadState;
    if (log.status === "completed") state = "completed";
    else if (log.status === "cancelled") state = "cancelled";
    else if (snoozedActive) state = "snoozed";
    else if (escalated) state = "escalated";
    else if (manualChases > 0) state = "manual_chasing";
    else if (task?.fallbackKind || (cs && cs.status !== "active" && cs.chaseCount >= CLIENT_CHASE_CAP)) state = "handed_to_team";
    else if (autoChases > 0 || nextIsAutomated) state = "auto_chasing";
    else state = "scheduled";

    const waitingOn = side === "vendor" ? sellerName : buyerName;

    // ── Events (most-recent first) ──
    const events: ChaseThreadEvent[] = [];
    events.push({
      at: log.createdAt.toISOString(),
      kind: "scheduled",
      title: "Chase scheduled",
      detail: rule.graceDays ? `Grace period of ${rule.graceDays} day${rule.graceDays === 1 ? "" : "s"} after the previous step.` : undefined,
      actor: "System",
    });

    // Client auto-chases (from ClientChaseState — capped at 2). Delivery detail
    // on this track is deferred (opens not tracked on the client queue).
    if (cs && cs.chaseCount > 0) {
      const autoDates = [cs.firstChasedAt, cs.chaseCount >= 2 ? cs.lastChasedAt : null].filter(Boolean) as Date[];
      autoDates.forEach((d, i) => {
        events.push({
          at: d.toISOString(),
          kind: "auto_chase",
          title: `Auto-chased ${waitingOn}`,
          detail: "Reminder email sent automatically.",
          actor: "System",
          delivery: "sent",
          ordinal: { n: i + 1, of: Math.min(cs.chaseCount, CLIENT_CHASE_CAP), by: "auto" },
        });
      });
      if (state !== "auto_chasing" && state !== "scheduled" && cs.chaseCount >= CLIENT_CHASE_CAP && cs.lastChasedAt) {
        events.push({
          at: cs.lastChasedAt.toISOString(),
          kind: "handed",
          title: "Autopilot done — handed to your team",
          detail: `Client auto-chase reached its limit of ${CLIENT_CHASE_CAP}. Now in your work queue.`,
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
    if (snoozedActive && log.snoozedUntil) {
      events.push({ at: log.snoozedUntil.toISOString(), kind: "snoozed", title: `Paused until ${toUKDateStr(log.snoozedUntil)}`, detail: log.statusReason ?? "A date was provided.", actor: "System" });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      id: log.id,
      title: stripChase(rule.name),
      side,
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
      snoozedUntil: snoozedActive && log.snoozedUntil ? log.snoozedUntil.toISOString() : null,
      startedAt: log.createdAt.toISOString(),
      events,
    };
  });

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
