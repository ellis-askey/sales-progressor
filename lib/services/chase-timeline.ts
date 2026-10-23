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
import { addWorkingDays } from "@/lib/emails/working-hours";
import { COMPLETION_REMINDER_CODES } from "@/lib/reminders/completion-codes";
import { isActiveRoundContact } from "@/lib/contacts/round-scope";
import { solChasesInRound } from "@/lib/chase/solicitor-round";
import { toUKDateStr } from "@/lib/utils";
import { isExchangeDayActive } from "@/lib/services/exchange-day";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { getChaseOverridesForTimeline, ENQUIRY_OVERRIDE_CODE } from "@/lib/services/chase-overrides";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";
import { solicitorCodesForSide } from "@/lib/solicitor-confirm/codes";
import { resolveConfirmer } from "@/lib/updates-copy";
import { enquiryNextChaseAt, enquiryEscalateAt } from "@/lib/enquiries/tracker";
import { raiseChaseNextNudgeAt, raiseChaseEscalateAt, raiseChaseTargetNext } from "@/lib/enquiries/raise-chase-decision";

// Short "who confirmed this step" label for the timeline's resolved event —
// reuses the canonical resolveConfirmer so it names the agent, the solicitor
// firm, a helper, or the client(s), consistent with the updates feed. Null when
// nobody is attributed (an automatic/system close).
function confirmerLabel(
  completion:
    | {
        confirmedByPortal: boolean;
        confirmedByContactId: string | null;
        confirmedBySolicitorFirmId: string | null;
        confirmedBySolicitorFirm?: { name: string } | null;
        completedBy?: { name: string | null } | null;
      }
    | null
    | undefined,
  sideContacts: { id: string; name: string; isPrincipal: boolean }[],
  side: "vendor" | "purchaser",
): string | null {
  if (!completion) return null;
  const { confirmer, principals } = resolveConfirmer(completion, sideContacts);
  if (!confirmer) return null;
  if (confirmer.kind === "agent") return confirmer.name;
  if (confirmer.kind === "solicitor") return confirmer.firm;
  if (confirmer.kind === "helper") return confirmer.name;
  const names = principals.map((p) => p.name).filter(Boolean);
  return names.length ? names.join(" & ") : side === "vendor" ? "The seller" : "The buyer";
}

// (The private Mon-Fri-only addWorkingDays that lived here ignored bank
// holidays, so its predictions drifted from the senders across holiday weeks —
// replaced by the canonical calendar import above, critique #281 step 3.)
// Solicitor cadence fallback when a code has no SolicitorReminderRule row.
const SOL_FALLBACK = { graceWorkingDays: 5, repeatWorkingDays: 5, maxChases: 2 };

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
  // The stored OutboundMessage this event sent, when there's a true-to-inbox copy
  // to open (the chase-email viewer). Absent on non-email events (replies, opens,
  // movements, resolved) and on legacy sends with no saved message.
  sentEmailId?: string;
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
    | { kind: "enquiry"; scope: "raise" | "reply"; milestoneCode: string }
    | null;
  overrideEdited: boolean;  // a subject/body edit is staged for the next chase
  overrideSkipped: boolean; // the next chase is set to skip
  // The upcoming send(s) for this step, per recipient lane — the "Up next"
  // cards. A step chased on BOTH lanes (e.g. searches: buyer + buyer's
  // solicitor) carries two. Empty when nothing more will send (done / capped
  // with no date / not chaseable). Additive: existing consumers ignore it.
  nextSends: NextSend[];
};

// One upcoming chase for a step, to a specific recipient lane.
export type NextSend = {
  lane: "client" | "solicitor";
  recipientLabel: string; // "Buyer · Mrs Guduri" / "Buyer's solicitor · Elena-Rose"
  dueAt: string | null; // ISO; null = no date (handed to team / capped)
  chaseNumber: number; // 1-based: which chase this will be
  capOf: number; // the lane's auto cap
  isAutomated: boolean; // true = autopilot sends it; false = a nudge for the team
  handedToTeam: boolean; // auto cap reached — it's on the team now
  overrideTarget: ChaseThread["overrideTarget"]; // drives the per-lane edit/skip
  edited: boolean; // a subject/body edit is staged for this lane's next send
  skipped: boolean; // this lane's next send is set to skip
  // Enquiry chases repeat until escalation rather than capping at N — set true so
  // the card shows "Next chase {date}" + an escalation deadline instead of the
  // milestone "chase N of cap" line. Omitted (undefined) on milestone/solicitor sends.
  untilEscalation?: boolean;
  escalatesAt?: string | null; // ISO — when it escalates to the file owner if no reply (enquiry sends)
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
      // Round start = the relist moment. Solicitor chases dated before it belong
      // to the previous buyer and are scoped out below (critique #299).
      activeBuyerRound: { select: { createdAt: true } },
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

  const [logs, contacts, clientStates, chaseMsgs, solStates, raiseChase, enquiryTracker, completions, solRules, chaseSends, autoChaseMsgs] = await Promise.all([
    prisma.reminderLog.findMany({
      // Relist safety: file-level (null) + active-round only, so a previous
      // buyer's cancelled/completed PM logs don't render as "resolved" threads
      // in the new buyer's timeline.
      // Completion steps (VM20/PM27) are excluded outright (critique #299):
      // clients can't confirm completion and the client-chase cron never sends
      // for these codes, so showing a "queued" completion chase here predicted
      // an email that can never exist.
      where: {
        transactionId,
        status: { in: ["active", "completed", "cancelled"] },
        OR: [{ buyerRoundId: null }, { buyerRoundId: tx.activeBuyerRoundId }],
        reminderRule: { targetMilestoneCode: { notIn: [...COMPLETION_REMINDER_CODES] } },
      },
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
      select: { id: true, name: true, roleType: true, isPrincipal: true, exchangeAuthorityGivenAt: true, buyerRoundId: true },
    }),
    prisma.clientChaseState.findMany({
      // Relist safety: file-level (null) + active-round only, so the new buyer's
      // live thread doesn't inherit the previous buyer's chase counts + dates
      // (the clientByCode map below keeps the highest chaseCount per code).
      where: { transactionId, OR: [{ buyerRoundId: null }, { buyerRoundId: tx.activeBuyerRoundId }] },
      select: { contactId: true, milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, status: true, statusReason: true },
    }),
    prisma.outboundMessage.findMany({
      where: { transactionId, purpose: "chase", isAutomated: false },
      select: { id: true, chaseTaskId: true, createdAt: true, recipientName: true, deliveredAt: true, openedAt: true, subject: true, createdByRole: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.solicitorChaseState.findMany({
      where: { transactionId },
      select: { side: true, milestoneCode: true, chaseCount: true, firstChasedAt: true, lastChasedAt: true, resolvedAt: true, status: true, statusReason: true, createdAt: true, snoozeUntil: true },
    }),
    // Enquiries run on their own trackers (not ReminderLogs): the raise-chase
    // (get enquiries raised) then the reply-loop tracker (whose court is it in).
    prisma.enquiryRaiseChase.findUnique({
      where: { transactionId },
      select: { openedAt: true, lastNudgedAt: true, lastTarget: true, nudgeCount: true, escalatedAt: true, closedAt: true },
    }),
    prisma.enquiryTracker.findUnique({
      where: { transactionId },
      select: { currentlyWith: true, openedAt: true, lastMovementAt: true, lastChasedAt: true, lastTouchAt: true, chaseCount: true, escalatedAt: true, snoozedUntil: true, closedAt: true, awaitingPackAt: true, outstandingNote: true,
        // Reply / handover movements, so the timeline shows the ball passing
        // between the two solicitors (e.g. "Replies received, now with the
        // buyer's solicitor") — without it, a same-day chase + handover read as
        // a contradiction (27 Whitebeam Close, 2026-10-19).
        movements: { where: { status: "accepted" }, orderBy: { occurredAt: "asc" }, select: { occurredAt: true, note: true, kind: true, flipsCourtTo: true } } },
    }),
    // Active-round milestone completions — the source of truth for whether a
    // solicitor step is still outstanding (SolicitorChaseState.status is stale:
    // confirming a step never closes the row) and for the solicitor snooze
    // (expectedDate), plus the step name for the thread title.
    prisma.milestoneCompletion.findMany({
      where: { transactionId, ...milestoneScopeWhere(forRound(tx.activeBuyerRoundId ?? null, transactionId)) },
      select: {
        state: true, expectedDate: true, completedAt: true, eventDate: true,
        confirmedByPortal: true, confirmedByContactId: true, confirmedBySolicitorFirmId: true,
        confirmedBySolicitorFirm: { select: { name: true } },
        completedBy: { select: { name: true } },
        milestoneDefinition: { select: { code: true, side: true, name: true } },
      },
    }),
    // Per-code solicitor cadence (grace/repeat/cap) so we can predict the next —
    // and the FIRST — solicitor chase date, mirroring the sender.
    prisma.solicitorReminderRule.findMany({
      select: { milestoneCode: true, graceWorkingDays: true, repeatWorkingDays: true, maxChases: true, anchorMilestoneCode: true, useAnchorEventDate: true, active: true },
    }),
    // Per-send records for the enquiry chases (raise + reply-loop), so the timeline
    // can show ONE row per nudge that actually went, rather than a single
    // "N nudges so far" line synthesised from the tracker's counter.
    prisma.chaseSend.findMany({
      where: { transactionId, kind: { in: ["raise", "reply_loop"] } },
      select: { kind: true, recipient: true, recipientName: true, sentAt: true, openedAt: true },
      orderBy: { sentAt: "asc" },
    }),
    // The AUTOMATED chase emails we sent (client/solicitor auto-chases + every
    // enquiry nudge). Each stores the exact HTML (sentEmailHtml), so the timeline
    // rows that came from chase-state dates / ChaseSend records can be matched to
    // their saved copy by send time and opened. Only metadata here; the body is
    // fetched on click via getSentChaseEmailAction.
    prisma.outboundMessage.findMany({
      where: { transactionId, purpose: "chase", isAutomated: true },
      select: { id: true, sentAt: true, isEnquiryChase: true },
      orderBy: { sentAt: "asc" },
    }),
  ]);

  // Match a "sent" timeline event to its saved email (OutboundMessage) by send
  // time, so the row can be opened. Auto-chase + enquiry events come from
  // chase-state dates / ChaseSend records that don't reference the message, but
  // both are written at the same instant, so a tight time window is exact in
  // practice. `isEnquiry` keeps enquiry nudges and milestone chases from matching
  // each other; claiming prevents two rows sharing one message.
  const autoMsgsClaimed = new Set<string>();
  function matchAutoSentEmail(at: Date | null | undefined, isEnquiry: boolean): string | undefined {
    if (!at) return undefined;
    const t = at.getTime();
    let best: { id: string; dt: number } | null = null;
    for (const m of autoChaseMsgs) {
      if (!m.sentAt || autoMsgsClaimed.has(m.id)) continue;
      if (!!m.isEnquiryChase !== isEnquiry) continue;
      const dt = Math.abs(new Date(m.sentAt).getTime() - t);
      if (dt > 180_000) continue; // within 3 minutes of the recorded send
      if (!best || dt < best.dt) best = { id: m.id, dt };
    }
    if (!best) return undefined;
    autoMsgsClaimed.add(best.id);
    return best.id;
  }

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

  const buyerName = contacts.find((c) => c.roleType === "purchaser" && isActiveRoundContact(c, tx.activeBuyerRoundId))?.name ?? "the buyer";
  const sellerName = contacts.find((c) => c.roleType === "vendor")?.name ?? "the seller";

  // Index client-chase state + manual messages by the thread they belong to.
  const clientByCode = new Map<string, (typeof clientStates)[number]>();
  for (const cs of clientStates) {
    const prev = clientByCode.get(cs.milestoneCode);
    if (!prev || cs.chaseCount > prev.chaseCount) clientByCode.set(cs.milestoneCode, cs);
  }
  // Round-scope the solicitor counter to the CURRENT buyer (critique #299). The
  // row has no buyer tag, so on a relisted file a previous buyer's chases get
  // dropped by the relist-date boundary (solChasesInRound). A stale row is also
  // treated as "active" so an old escalation doesn't read as "with your team".
  const solRoundStart = tx.activeBuyerRound?.createdAt ?? null;
  const solStatesScoped = solStates.map((s) => {
    const sc = solChasesInRound(s, s.side as "vendor" | "purchaser", solRoundStart);
    return sc.stale
      ? { ...s, chaseCount: sc.count, firstChasedAt: sc.firstAt, lastChasedAt: sc.lastAt, status: "active", resolvedAt: null }
      : { ...s, chaseCount: sc.count, firstChasedAt: sc.firstAt, lastChasedAt: sc.lastAt };
  });
  const solByCode = new Map<string, (typeof solStatesScoped)[number]>();
  for (const s of solStatesScoped) {
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

  const solRuleByCode = new Map(solRules.map((r) => [r.milestoneCode, r]));

  // Holds: a future-dated quiet spell (a reschedule from the timeline, the
  // solicitor's expected date, or a reminder snooze). The sender won't fire
  // before it, so every displayed next-send date is the LATER of the natural
  // cadence date and the hold — the date shown is the date it sends.
  const futureDate = (d: Date | null | undefined): Date | null =>
    d && d.getTime() > Date.now() ? d : null;
  const laterDate = (a: Date | null, b: Date | null): Date | null =>
    a && b ? (a > b ? a : b) : (a ?? b);

  // Predict the next solicitor chase for a step: from an existing chase-state
  // (last chased + repeat), or — when never chased yet — the FIRST chase from the
  // step's prerequisite completion + grace (mirrors the sender's working-day
  // cadence). Returns null when the step isn't solicitor-chased, is already done,
  // or its prerequisite isn't complete yet (nothing to anchor on).
  function solicitorNextSend(side: "vendor" | "purchaser", code: string | null): NextSend | null {
    if (!code || !solicitorCodesForSide(side).has(code)) return null;
    const rule = solRuleByCode.get(code);
    if (rule && rule.active === false) return null;
    const mc = completionByKey.get(`${side}|${code}`);
    if (mc && (mc.state === "complete" || mc.state === "not_required")) return null; // done
    const grace = rule?.graceWorkingDays ?? SOL_FALLBACK.graceWorkingDays;
    const repeat = rule?.repeatWorkingDays ?? SOL_FALLBACK.repeatWorkingDays;
    const cap = rule?.maxChases ?? SOL_FALLBACK.maxChases;
    const label = side === "vendor" ? "Seller's solicitor" : "Buyer's solicitor";
    const target = { kind: "solicitor" as const, side, milestoneCode: code };
    const ov = overrideByKey.get(`sol:${side}|${code}`);
    const edited = !!ov?.edited, skipped = !!ov?.skipped;
    const st = solByCode.get(code);
    // Both holds the sender respects: the solicitor's expected date and a
    // timeline reschedule (SolicitorChaseState.snoozeUntil).
    const hold = laterDate(futureDate(mc?.expectedDate), futureDate(st?.snoozeUntil));
    if (st && (st.chaseCount > 0 || st.status !== "active")) {
      const capped = st.chaseCount >= cap || st.status === "escalated";
      const base = !capped && st.lastChasedAt ? addWorkingDays(st.lastChasedAt, repeat) : null;
      const dueAt = capped ? null : laterDate(base, hold);
      return { lane: "solicitor", recipientLabel: label, dueAt: dueAt ? dueAt.toISOString() : null,
        chaseNumber: Math.min(st.chaseCount + 1, cap), capOf: cap, isAutomated: !capped, handedToTeam: capped, overrideTarget: target, edited, skipped };
    }
    // Never chased yet (no state row, or a hold-only row from a reschedule) →
    // project the first chase from the prerequisite (or the rule's explicit
    // anchor) completion + grace.
    const anchorCodes = rule?.anchorMilestoneCode ? [rule.anchorMilestoneCode] : (DIRECT_PREREQUISITES[code] ?? []);
    if (anchorCodes.length === 0) return null;
    let anchor: Date | null = null;
    for (const p of anchorCodes) {
      const pmc = completionByKey.get(`${side}|${p}`);
      const when = pmc && pmc.state === "complete" ? (pmc.eventDate ?? pmc.completedAt) : null;
      if (!when) return null; // a prerequisite isn't done → can't chase yet
      const t = new Date(when);
      if (!anchor || t > anchor) anchor = t;
    }
    if (!anchor) return null;
    const firstDue = laterDate(addWorkingDays(anchor, grace), hold) as Date;
    return { lane: "solicitor", recipientLabel: label, dueAt: firstDue.toISOString(),
      chaseNumber: 1, capOf: cap, isAutomated: true, handedToTeam: false, overrideTarget: target, edited, skipped };
  }

  const todayStr = toUKDateStr(new Date());
  const nowMs = Date.now();

  // Guard against phantom chases: an ACTIVE reminder log only represents a real,
  // live chase if the step it targets is actually OPEN (available). An active log
  // against a locked / already-complete / missing step is a phantom — e.g. a
  // straggler from before the VM7↔PM7 contract-pack auto-complete shipped
  // (2026-09-17) — and must not show as "scheduled / autopilot will send". It
  // reappears automatically once the step opens. Completed/cancelled logs are
  // history and always shown.
  const chaseableLogs = logs.filter((log) => {
    if (log.status !== "active") return true;
    const c = log.reminderRule.targetMilestoneCode;
    if (!c) return true;
    const comp = completionByKey.get(`${sideForCode(c)}|${c}`);
    return comp?.state === "available";
  });

  const threads: ChaseThread[] = chaseableLogs.map((log) => {
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

    // A future-dated hold doesn't pause the thread — it IS the next chase date
    // (the sender resumes by itself once it passes). Per-lane: the client cron
    // respects the reminder log's snoozedUntil; the solicitor cron respects the
    // expected date + SolicitorChaseState.snoozeUntil (handled inside
    // solicitorNextSend). The thread-level hold drives the history event.
    const clientHold = futureDate(log.snoozedUntil);
    const solHold = sol && code
      ? laterDate(futureDate(completionByKey.get(`${side}|${code}`)?.expectedDate), futureDate(sol.snoozeUntil))
      : null;
    const snoozeAt = track === "solicitor" ? (solHold ?? clientHold) : clientHold;

    // Autopilot sends next only while its lane is still active and under cap;
    // otherwise "next" is a reminder for the team to act.
    // Both-lanes hand-off (critique #299). A step can be auto-chased on BOTH the
    // solicitor and the client at once (the solicitor confirms, then forwards the
    // result to the client so they can confirm too). It's only "handed to your
    // team" once EVERY auto lane has used up its chases — while any lane is still
    // sending, autopilot keeps going and the step stays "auto-chasing".
    const solStillAuto = !!sol && sol.status === "active" && sol.chaseCount < SOLICITOR_CHASE_CAP;
    const clientStillAuto = !!cs && cs.status === "active" && cs.chaseCount < CLIENT_CHASE_CAP;
    const anyLaneStillAuto = solStillAuto || clientStillAuto;
    const solCapped = !!sol && (sol.chaseCount >= SOLICITOR_CHASE_CAP || sol.status === "escalated");
    const clientCapped = !!task?.fallbackKind || (!!cs && cs.chaseCount >= CLIENT_CHASE_CAP);
    const nextIsAutomated = anyLaneStillAuto;
    const autoHandedOff = !anyLaneStillAuto && (solCapped || clientCapped);

    let state: ChaseThreadState;
    if (log.status === "completed") state = "completed";
    else if (log.status === "cancelled") state = "cancelled";
    else if (escalated) state = "escalated";
    else if (manualChases > 0) state = "manual_chasing";
    else if (autoHandedOff) state = "handed_to_team";
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
      detail: rule.graceDays
        ? `Waiting on ${waitingOn}. If we don't hear back, we'll follow up in ${rule.graceDays} working day${rule.graceDays === 1 ? "" : "s"}.`
        : `Waiting on ${waitingOn}.`,
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
          sentEmailId: matchAutoSentEmail(d, false),
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
        sentEmailId: m.id,
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
      const comp = completionByKey.get(`${side}|${code}`);
      const sideContacts = contacts
        .filter((c) => (side === "vendor" ? c.roleType === "vendor" : c.roleType === "purchaser") && isActiveRoundContact(c, tx.activeBuyerRoundId))
        .map((c) => ({ id: c.id, name: c.name, isPrincipal: c.isPrincipal }));
      const who = confirmerLabel(comp, sideContacts, side);
      events.push({
        at: (comp?.completedAt ?? log.updatedAt).toISOString(),
        kind: "resolved",
        title: "Confirmed",
        detail: who ? `Confirmed by ${who}. Chase closed.` : "Confirmed. Chase closed.",
        actor: who ? undefined : "System",
      });
    }
    if (state === "cancelled") {
      events.push({ at: log.updatedAt.toISOString(), kind: "cancelled", title: "Stopped", detail: log.statusReason ?? "Chase no longer needed.", actor: "System" });
    }
    if (snoozeAt) {
      events.push({ at: snoozeAt.toISOString(), kind: "snoozed", title: `Next chase moved to ${toUKDateStr(snoozeAt)}`, detail: (track === "solicitor" ? sol?.statusReason : log.statusReason) ?? "A date was provided.", actor: "System" });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // Override target for edit/skip-the-next-chase from the timeline.
    const clientContactId = cs?.contactId ?? contacts.find((c) => c.roleType === side && isActiveRoundContact(c, tx.activeBuyerRoundId))?.id ?? null;
    const overrideTarget: ChaseThread["overrideTarget"] =
      !code ? null
      : track === "solicitor" ? { kind: "solicitor", side, milestoneCode: code }
      : clientContactId ? { kind: "client", contactId: clientContactId, milestoneCode: code }
      : null;
    const ovKey = overrideTarget
      ? `${overrideTarget.kind === "solicitor" ? `sol:${overrideTarget.side}` : `contact:${overrideTarget.contactId}`}|${code}`
      : null;
    const ov = ovKey ? overrideByKey.get(ovKey) : undefined;

    // Up-next cards: the client's next reminder (while the client log is live)
    // AND the solicitor's next chase for the same step (searches, contract pack,
    // etc. are chased on both lanes). Either may be null.
    const clientOverrideTarget = code && clientContactId
      ? { kind: "client" as const, contactId: clientContactId, milestoneCode: code } : null;
    const clientNext: NextSend | null = (log.status === "active")
      ? {
          lane: "client",
          recipientLabel: `${side === "vendor" ? "Seller" : "Buyer"} · ${clientName}`,
          // A hold (reschedule / snooze) pushes the shown date — it's when the
          // chase actually resumes.
          dueAt: (laterDate(log.nextDueDate, clientHold) as Date).toISOString(),
          chaseNumber: Math.min((cs?.chaseCount ?? 0) + 1, CLIENT_CHASE_CAP),
          capOf: CLIENT_CHASE_CAP,
          isAutomated: !cs || (cs.status === "active" && cs.chaseCount < CLIENT_CHASE_CAP),
          handedToTeam: !!cs && cs.chaseCount >= CLIENT_CHASE_CAP,
          overrideTarget: clientOverrideTarget,
          edited: !!(clientContactId && overrideByKey.get(`contact:${clientContactId}|${code}`)?.edited),
          skipped: !!(clientContactId && overrideByKey.get(`contact:${clientContactId}|${code}`)?.skipped),
        }
      : null;
    const solNext = solicitorNextSend(side, code);
    // While any lane is still auto-chasing, don't surface an exhausted lane's
    // "with your team" card — the step isn't handed over yet (critique #299). Only
    // the still-auto lane's "Next: chase" shows; both show once fully handed off.
    const nextSends: NextSend[] = [clientNext, solNext]
      .filter((s): s is NextSend => s != null)
      .filter((s) => !(anyLaneStillAuto && s.handedToTeam));

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
      nextDueAt: log.status === "active" ? (laterDate(log.nextDueDate, clientHold) as Date).toISOString() : null,
      nextIsAutomated,
      escalatesAfter: rule.escalateAfterChases,
      escalated,
      snoozedUntil: snoozeAt ? snoozeAt.toISOString() : null,
      startedAt: log.createdAt.toISOString(),
      events,
      overrideTarget,
      overrideEdited: ov?.edited ?? false,
      overrideSkipped: ov?.skipped ?? false,
      nextSends,
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
    // One row per nudge that actually sent (ChaseSend records). Falls back to a
    // single synthesised row for legacy files predating ChaseSend logging.
    const raiseSends = chaseSends.filter((c) => c.kind === "raise");
    if (raiseSends.length > 0) {
      raiseSends.forEach((cs, i) => {
        const tgt = cs.recipient === "buyer" ? "the buyer" : buyerSolLabel;
        events.push({
          at: cs.sentAt.toISOString(), kind: "auto_chase",
          title: `Nudged ${tgt} to get enquiries raised`,
          detail: cs.recipientName ? `Sent to ${cs.recipientName}.` : "Reminder email sent.",
          actor: "System", delivery: cs.openedAt ? "opened" : "sent",
          ordinal: { n: i + 1, of: raiseSends.length, by: "auto" },
          sentEmailId: matchAutoSentEmail(cs.sentAt, true),
        });
      });
    } else if (raiseChase.lastNudgedAt && n > 0) {
      const tgt = raiseChase.lastTarget === "buyer" ? "the buyer" : buyerSolLabel;
      events.push({ at: raiseChase.lastNudgedAt.toISOString(), kind: "auto_chase", title: `Nudged ${tgt} to get enquiries raised`, detail: `${n} nudge${n === 1 ? "" : "s"} so far.`, actor: "System", delivery: "sent", ordinal: { n, of: n, by: "auto" } });
    }
    if (raiseChase.escalatedAt) events.push({ at: raiseChase.escalatedAt.toISOString(), kind: "escalated", title: "Escalated to file owner", detail: "Enquiries still not raised after repeated nudges.", actor: "System" });
    if (raiseChase.closedAt) events.push({ at: raiseChase.closedAt.toISOString(), kind: "resolved", title: "Enquiries raised", detail: "The reply loop takes over from here.", actor: "System" });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    // Predict the upcoming nudge (date + who) and the escalation deadline, so the
    // raise chase shows the same "Up next" card as milestone chases.
    const rcState = {
      openedAt: raiseChase.openedAt,
      lastNudgedAt: raiseChase.lastNudgedAt,
      lastTarget: raiseChase.lastTarget,
      nudgeCount: raiseChase.nudgeCount,
      escalatedAt: raiseChase.escalatedAt,
      // The raise chaser's hold: PM14's expected date (set by the enquiries
      // page's date control OR a reschedule from this timeline). The cron reads
      // the same field, so the predicted date here matches what actually fires.
      expectedDate: completionByKey.get("purchaser|PM14")?.expectedDate ?? null,
    };
    const rcNextAt = closed ? null : raiseChaseNextNudgeAt(rcState);
    const rcEscalateAt = closed ? null : raiseChaseEscalateAt(rcState);
    const rcTarget = raiseChaseTargetNext(rcState);
    const rcOvTarget = { kind: "enquiry" as const, scope: "raise" as const, milestoneCode: ENQUIRY_OVERRIDE_CODE };
    const rcOv = overrideByKey.get(`enq:raise|${ENQUIRY_OVERRIDE_CODE}`);
    const rcNext: NextSend | null = closed
      ? null
      : {
          lane: rcTarget === "buyer" ? "client" : "solicitor",
          recipientLabel: rcTarget === "buyer" ? "Buyer" : "Buyer's solicitor",
          dueAt: rcNextAt ? rcNextAt.toISOString() : null,
          chaseNumber: n + 1,
          capOf: 0,
          isAutomated: !esc,
          handedToTeam: esc,
          overrideTarget: rcOvTarget,
          edited: !!rcOv?.edited,
          skipped: !!rcOv?.skipped,
          untilEscalation: true,
          escalatesAt: rcEscalateAt ? rcEscalateAt.toISOString() : null,
        };
    threads.push({
      id: "enquiry-raise", title: "Getting enquiries raised", side: "purchaser", track: "enquiry",
      trackLabel: "Buyer's solicitor", state, waitingOn: buyerSolLabel,
      autoChases: n, manualChases: 0, totalChases: n,
      lastChasedAt: raiseChase.lastNudgedAt?.toISOString() ?? null,
      nextDueAt: rcNextAt ? rcNextAt.toISOString() : null, nextIsAutomated: !closed && !esc,
      escalatesAfter: 0, escalated: esc, snoozedUntil: null,
      startedAt: raiseChase.openedAt.toISOString(), events,
      overrideTarget: closed ? null : rcOvTarget, overrideEdited: !!rcOv?.edited, overrideSkipped: !!rcOv?.skipped,
      nextSends: rcNext ? [rcNext] : [],
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
    const state: ChaseThreadState = closed ? "completed" : esc ? "escalated" : n > 0 ? "auto_chasing" : "scheduled";
    const events: ChaseThreadEvent[] = [{
      at: et.openedAt.toISOString(), kind: "scheduled", title: "Enquiries opened",
      detail: et.outstandingNote ? `Waiting on: ${et.outstandingNote}` : "Enquiries raised, awaiting replies.", actor: "System",
    }];
    // One row per reply-loop chase that actually sent (per-send recipient, which
    // can differ from the current court); legacy fallback to the single row.
    const replySends = chaseSends.filter((c) => c.kind === "reply_loop");
    if (replySends.length > 0) {
      replySends.forEach((cs, i) => {
        const chasedWho = cs.recipient === "seller_solicitor" ? sellerSolLabel : buyerSolLabel;
        events.push({
          at: cs.sentAt.toISOString(), kind: "auto_chase",
          title: `Chased ${chasedWho}`,
          detail: cs.recipientName ? `Sent to ${cs.recipientName}.` : "Reminder email sent.",
          actor: "System", delivery: cs.openedAt ? "opened" : "sent",
          ordinal: { n: i + 1, of: replySends.length, by: "auto" },
          sentEmailId: matchAutoSentEmail(cs.sentAt, true),
        });
      });
    } else if (et.lastChasedAt && n > 0) {
      events.push({ at: et.lastChasedAt.toISOString(), kind: "auto_chase", title: `Chased ${who}`, detail: `${n} chase${n === 1 ? "" : "s"} so far.`, actor: "System", delivery: "sent", ordinal: { n, of: n, by: "auto" } });
    }
    // Reply / handover movements — show the ball passing between the two
    // solicitors so a same-day chase + handover reads as the sequence it is
    // ("chased seller at 10am, their replies came in at 3pm, now with the
    // buyer") rather than a contradiction (27 Whitebeam Close, 2026-10-19).
    const MOVE_TITLE: Record<string, string> = {
      raised: "Further enquiries raised",
      replies_sent: "Replies sent",
      replies_received: "Replies received",
      partial_replies: "Some replies in",
      correction: "Court corrected",
      update: "Enquiries update",
    };
    for (const mv of et.movements) {
      if (mv.kind === "chased") continue; // chase sends already have their own rows above
      const progress = mv.kind === "replies_sent" || mv.kind === "replies_received";
      events.push({
        at: mv.occurredAt.toISOString(),
        kind: progress ? "resolved" : "scheduled",
        title: MOVE_TITLE[mv.kind] ?? "Enquiries update",
        detail: mv.note || undefined,
        actor: "System",
      });
    }
    if (et.escalatedAt) events.push({ at: et.escalatedAt.toISOString(), kind: "escalated", title: "Escalated to file owner", detail: "Enquiries outstanding after repeated chases.", actor: "System" });
    if (snoozeAt) events.push({ at: snoozeAt.toISOString(), kind: "snoozed", title: `Next chase moved to ${toUKDateStr(snoozeAt)}`, detail: "A date was provided.", actor: "System" });
    if (et.closedAt) events.push({ at: et.closedAt.toISOString(), kind: "resolved", title: "Enquiries satisfied", detail: "All enquiries answered. Nothing left to chase.", actor: "System" });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    // Predict the next reply-loop chase (to the solicitor holding the ball) + the
    // escalation deadline, matching the sender's cadence so the card is truthful.
    // During a hold the cadence helper returns null — the hold date IS the next
    // chase date (chasing resumes the morning it passes).
    const etNextAt = closed ? null : laterDate(enquiryNextChaseAt(et, new Date(nowMs)), snoozeAt);
    const etEscalateAt = closed ? null : enquiryEscalateAt(et, new Date(nowMs));
    const etOvTarget = { kind: "enquiry" as const, scope: "reply" as const, milestoneCode: ENQUIRY_OVERRIDE_CODE };
    const etOv = overrideByKey.get(`enq:reply|${ENQUIRY_OVERRIDE_CODE}`);
    const etNext: NextSend | null = closed
      ? null
      : {
          lane: "solicitor",
          recipientLabel: withSeller ? "Seller's solicitor" : "Buyer's solicitor",
          dueAt: etNextAt ? etNextAt.toISOString() : null,
          chaseNumber: n + 1,
          capOf: 0,
          isAutomated: !esc,
          handedToTeam: esc,
          overrideTarget: etOvTarget,
          edited: !!etOv?.edited,
          skipped: !!etOv?.skipped,
          untilEscalation: true,
          escalatesAt: etEscalateAt ? etEscalateAt.toISOString() : null,
        };
    threads.push({
      id: "enquiry-tracker", title: "Outstanding enquiries", side, track: "enquiry",
      trackLabel: withSeller ? "Seller's solicitor" : "Buyer's solicitor", state, waitingOn: who,
      autoChases: n, manualChases: 0, totalChases: n,
      lastChasedAt: et.lastChasedAt?.toISOString() ?? null,
      nextDueAt: etNextAt ? etNextAt.toISOString() : null, nextIsAutomated: !closed && !esc,
      escalatesAfter: 0, escalated: esc, snoozedUntil: snoozeAt?.toISOString() ?? null,
      startedAt: et.openedAt.toISOString(), events,
      overrideTarget: closed ? null : etOvTarget, overrideEdited: !!etOv?.edited, overrideSkipped: !!etOv?.skipped,
      nextSends: etNext ? [etNext] : [],
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
      nextSends: [],
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
  for (const row of solStatesScoped) {
    if (codesWithThread.has(row.milestoneCode)) continue; // already threaded via a client log
    const mc = completionByKey.get(`${row.side}|${row.milestoneCode}`);
    if (!mc?.milestoneDefinition) continue; // no active-round completion → stale cross-round state
    const side: "vendor" | "purchaser" = row.side === "vendor" ? "vendor" : "purchaser";
    const done = mc.state === "complete" || mc.state === "not_required" || row.status === "resolved";
    const snoozeAt = !done ? laterDate(futureDate(mc.expectedDate), futureDate(row.snoozeUntil)) : null;
    const escalated = row.status === "escalated";
    const n = row.chaseCount;
    const capped = n >= SOLICITOR_CHASE_CAP;
    const state: ChaseThreadState = done ? "completed"
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
      at: snoozeAt.toISOString(), kind: "snoozed", title: `Next chase moved to ${toUKDateStr(snoozeAt)}`,
      detail: row.statusReason ?? "A date was provided.", actor: "System",
    });
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const solNext = done ? null : solicitorNextSend(side, row.milestoneCode);

    threads.push({
      id: `sol-${row.side}-${row.milestoneCode}`,
      title: stripChase(mc.milestoneDefinition.name),
      side, track: "solicitor",
      trackLabel: side === "vendor" ? "Seller's solicitor" : "Buyer's solicitor",
      state, waitingOn: who,
      autoChases: n, manualChases: 0, totalChases: n,
      lastChasedAt: row.lastChasedAt?.toISOString() ?? null,
      nextDueAt: solNext?.dueAt ?? null, // now predicted (last chased + repeat working days, pushed by any hold)
      nextIsAutomated: !done && !escalated && n < SOLICITOR_CHASE_CAP,
      escalatesAfter: SOLICITOR_CHASE_CAP,
      escalated, snoozedUntil: snoozeAt?.toISOString() ?? null,
      startedAt: row.createdAt.toISOString(), events,
      overrideTarget: { kind: "solicitor", side, milestoneCode: row.milestoneCode },
      overrideEdited: overrideByKey.get(`sol:${side}|${row.milestoneCode}`)?.edited ?? false,
      overrideSkipped: overrideByKey.get(`sol:${side}|${row.milestoneCode}`)?.skipped ?? false,
      nextSends: solNext ? [solNext] : [],
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
