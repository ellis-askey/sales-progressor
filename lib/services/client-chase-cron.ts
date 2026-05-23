// B7 of the client-chase arc (Sub-arc B).
//
// Daily cron logic for the automated client chase pipeline. Two passes:
//
//   1. CHASE PASS  — find (transaction, contact, milestone) tuples that
//      should receive a chase today; group by contact; enqueue one digest
//      per contact via B4's enqueueClientChaseDigest. The digest assembler
//      handles tone (DIY / NUDGE / mixed) and solicitor/lender precision.
//
//   2. ESCALATION PASS — find active ClientChaseState rows that should be
//      escalated based on either:
//         - chase-count cap: chaseCount >= 2 AND repeatEveryDays window has
//           closed since lastChasedAt AND no engagement since lastChasedAt
//           (interpretation B from the locked timings — second window must
//           close before declaring silence)
//         - 14-day silence: today - max(lastEngagedAt, firstChasedAt) >= 14
//         - WHICHEVER FIRES FIRST WINS. The atomic status flip with a
//           status="active" precondition guarantees no double-escalation.
//
// Both passes are PURE READS at the top: separate "find" functions return
// candidate rows; the side-effecting "run" wrappers do the writes. This
// lets the verify script exercise the read logic in isolation.
//
// Timings: reuse ReminderRule.graceDays + ReminderRule.repeatEveryDays
// verbatim (locked pre-B7 decision). Client-side overrides:
//   - graceDays floor at 1 (MOS-style 0-day rules don't fire on day 0)
//   - chase-count cap hard-coded at 2 (vs ReminderRule.escalateAfterChases)
//   - 14-day silence ceiling (no equivalent on agent rule)
//
// All bilateral codes (VM18/PM25, VM19/PM26, VM20/PM27) are filtered out
// upstream by isClientChaseable (A6's allowlist).

import { prisma } from "@/lib/prisma";
import { isClientChaseable } from "@/lib/chase/chaseable-milestones";
import { enqueueClientChaseDigest } from "@/lib/email/client-chase-digest";
import { createAgentChaseTaskForMilestone } from "@/lib/services/reminders";
import type { ContactRole } from "@prisma/client";

export const CLIENT_CHASE_GRACE_FLOOR_DAYS = 1;
export const CLIENT_CHASE_COUNT_CAP = 2;
export const CLIENT_CHASE_SILENCE_DAYS = 14;

// Shape of the per-transaction chase-rule snapshot. Settings edits update
// ReminderRule (the template for new files); existing transactions keep
// their snapshot. Snapshot is backfilled at migration time so old files
// behave identically pre/post the snapshot system going live.
type ChaseRuleSnapshotEntry = {
  graceDays?: number;
  repeatEveryDays?: number;
};
type ChaseRuleSnapshot = Record<string, ChaseRuleSnapshotEntry | undefined>;

function readSnapshotTiming(
  snapshot: unknown,
  code: string,
): { graceDays: number; repeatEveryDays: number } | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const entry = (snapshot as ChaseRuleSnapshot)[code];
  if (!entry) return null;
  if (typeof entry.graceDays !== "number" || typeof entry.repeatEveryDays !== "number") return null;
  return { graceDays: entry.graceDays, repeatEveryDays: entry.repeatEveryDays };
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}
function daysBetween(a: Date, b: Date): number {
  // floor((a - b) / day)
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

// Side a milestone code targets. Vendor side = "vendor" contacts;
// purchaser side = "purchaser" contacts. Anything else (defensive) → null.
function sideForMilestoneCode(code: string): ContactRole | null {
  if (code.startsWith("VM")) return "vendor";
  if (code.startsWith("PM")) return "purchaser";
  return null;
}

// Compute the anchor date for a rule + completion lookup. Mirrors the
// agent reminder engine's logic (reminders.ts:274-305) — uses eventDate
// when useEventDate=true OR when reconciledAtClaim=true (the claim-day
// completedAt is misleading for backdated work).
//
// Returns null if the rule can't be anchored today (anchor not yet
// confirmed, or reconciled-at-claim with no eventDate). Callers skip
// those rules until the anchor lands.
type RuleAnchorInput = {
  rule: { anchorMilestoneId: string | null; useEventDate: boolean };
  transaction: { createdAt: Date };
  anchorCompletion: {
    state: string;
    completedAt: Date | null;
    eventDate: Date | null;
    reconciledAtClaim: boolean;
  } | null;
};
export function computeAnchorDate(input: RuleAnchorInput): Date | null {
  const { rule, transaction, anchorCompletion } = input;
  if (!rule.anchorMilestoneId) {
    // No anchor → use transaction createdAt as the silence-clock base.
    return transaction.createdAt;
  }
  if (!anchorCompletion || anchorCompletion.state !== "complete") return null;
  if (anchorCompletion.reconciledAtClaim) {
    return anchorCompletion.eventDate ?? null;
  }
  if (rule.useEventDate && anchorCompletion.eventDate) {
    return anchorCompletion.eventDate;
  }
  return anchorCompletion.completedAt ?? transaction.createdAt;
}

// ─── findDueClientChases — PURE READ ────────────────────────────────────
// Returns a per-contact map of milestone codes that should receive a
// chase today. Caller groups and enqueues; this function does no writes.

export type DueChaseTuple = {
  transactionId: string;
  contactId: string;
  contactEmail: string;
  contactName: string;
  milestoneCode: string;
  // anchorDate + firstDueDate kept for verify-script assertions only.
  anchorDate: Date;
  firstDueDate: Date;
  reason: "first_chase" | "repeat_due";
  // When set, this chase is being SKIPPED because emails are paused (either
  // per-file or agency-wide). The cron caller routes these to the fallback
  // path (manual-handoff ChaseTask with the "client_emails_paused" chip)
  // instead of enqueueing a digest. The chase clock stays where it was, so
  // unpausing picks up the schedule from there.
  pausedScope?: "agency" | "file";
};

export async function findDueClientChases(now: Date): Promise<DueChaseTuple[]> {
  // Pull all active rules with chaseable target codes. Inactive rules are
  // skipped on the agent side too; same here.
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true },
    select: {
      id: true,
      targetMilestoneCode: true,
      anchorMilestoneId: true,
      graceDays: true,
      repeatEveryDays: true,
      useEventDate: true,
      requiresExchangeReady: true,
    },
  });
  const chaseableRules = rules.filter((r) =>
    r.targetMilestoneCode && isClientChaseable(r.targetMilestoneCode),
  );
  if (chaseableRules.length === 0) return [];

  // Pre-load milestone definitions so we can map codes → defIds.
  const allCodes = new Set<string>();
  for (const r of chaseableRules) {
    if (r.targetMilestoneCode) allCodes.add(r.targetMilestoneCode);
  }
  const defs = await prisma.milestoneDefinition.findMany({
    where: { code: { in: Array.from(allCodes) } },
    select: { id: true, code: true },
  });
  const defByCode = new Map(defs.map((d) => [d.code, d.id]));

  // Active transactions only. Closed/declined files don't get chased.
  // Additional automation-control fields pulled in the same query to
  // avoid N+1 in the loop below:
  //   - clientEmailsPaused: per-file pause toggle (skips chase enqueue only;
  //     escalation pass is unaffected — the file must still flag to the team)
  //   - chaseRuleSnapshot: per-transaction grace/repeat values at creation time
  //   - agencyId: needed for the agency-wide master toggle lookup
  const transactions = await prisma.propertyTransaction.findMany({
    where: { status: "active" },
    select: {
      id: true,
      createdAt: true,
      agencyId: true,
      clientEmailsPaused: true,
      chaseRuleSnapshot: true,
    },
  });
  if (transactions.length === 0) return [];
  const txIds = transactions.map((t) => t.id);

  // Per-agency master toggle: if Agency.chaseEmailsEnabled = false, every
  // chase on every file in that agency is skipped (digest-level kill switch).
  const agencyIds = Array.from(new Set(transactions.map((t) => t.agencyId)));
  const agencies = await prisma.agency.findMany({
    where: { id: { in: agencyIds } },
    select: { id: true, chaseEmailsEnabled: true },
  });
  const agencyChaseEnabled = new Map(agencies.map((a) => [a.id, a.chaseEmailsEnabled]));

  // Exchange-readiness map (per-tx). Computed the same way the agent
  // reminder engine does it: all blocksExchange milestones are complete
  // or not_required. Bulk-load the blocker defs once.
  const blockerDefs = await prisma.milestoneDefinition.findMany({
    where: { blocksExchange: true },
    select: { id: true },
  });
  const blockerDefIds = new Set(blockerDefs.map((b) => b.id));

  // Bulk-load all relevant data per transaction in three queries, then
  // we walk in memory. Avoids N+1.
  const completions = await prisma.milestoneCompletion.findMany({
    where: { transactionId: { in: txIds } },
    select: {
      transactionId: true,
      milestoneDefinitionId: true,
      state: true,
      completedAt: true,
      eventDate: true,
      reconciledAtClaim: true,
    },
  });
  const contacts = await prisma.contact.findMany({
    where: {
      propertyTransactionId: { in: txIds },
      roleType: { in: ["vendor", "purchaser"] },
      unsubscribedAt: null,
      email: { not: null },
      portalToken: { not: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      propertyTransactionId: true,
      roleType: true,
    },
  });
  const states = await prisma.clientChaseState.findMany({
    where: { transactionId: { in: txIds } },
    select: {
      id: true,
      transactionId: true,
      contactId: true,
      milestoneCode: true,
      status: true,
      chaseCount: true,
      lastChasedAt: true,
      firstChasedAt: true,
      lastEngagedAt: true,
    },
  });

  // Index lookups
  const completionByTxAndDefId = new Map<string, typeof completions[number]>();
  for (const c of completions) {
    completionByTxAndDefId.set(`${c.transactionId}:${c.milestoneDefinitionId}`, c);
  }
  const contactsByTx = new Map<string, typeof contacts>();
  for (const c of contacts) {
    const arr = contactsByTx.get(c.propertyTransactionId) ?? [];
    arr.push(c);
    contactsByTx.set(c.propertyTransactionId, arr);
  }
  const stateByKey = new Map<string, typeof states[number]>();
  for (const s of states) {
    stateByKey.set(`${s.transactionId}:${s.contactId}:${s.milestoneCode}`, s);
  }

  // Per-transaction exchangeReady computation (in-memory walk over the
  // bulk-loaded completions). All blocksExchange milestones must be
  // complete or not_required.
  const exchangeReadyByTx = new Map<string, boolean>();
  for (const tx of transactions) {
    const ready = Array.from(blockerDefIds).every((defId) => {
      const c = completionByTxAndDefId.get(`${tx.id}:${defId}`);
      return c && (c.state === "complete" || c.state === "not_required");
    });
    exchangeReadyByTx.set(tx.id, ready);
  }

  const due: DueChaseTuple[] = [];

  for (const transaction of transactions) {
    // Automation-control gates (chase pass only — escalation still fires):
    //   1. agency master toggle off → no chase emails on any file in the agency
    //   2. per-file pause on → no chase emails on this file
    // We DON'T `continue` here — we still walk every milestone so that any
    // chase that WOULD have fired today gets stamped with pausedScope on
    // the returned tuple. The cron caller routes those to the fallback
    // path (createAgentChaseTaskForMilestone → "client_emails_paused" chip)
    // instead of enqueueing a digest. ClientChaseState is left untouched,
    // so unpausing/re-enabling picks the schedule back up from where it was.
    const agencyOff = agencyChaseEnabled.get(transaction.agencyId) === false;
    const fileOff = transaction.clientEmailsPaused;
    const pausedScope: "agency" | "file" | undefined =
      agencyOff ? "agency" : fileOff ? "file" : undefined;

    const txContacts = contactsByTx.get(transaction.id) ?? [];
    if (txContacts.length === 0) continue;

    for (const rule of chaseableRules) {
      const targetCode = rule.targetMilestoneCode!;
      const targetDefId = defByCode.get(targetCode);
      if (!targetDefId) continue;

      // Skip if rule.requiresExchangeReady and transaction isn't ready.
      if (rule.requiresExchangeReady && !exchangeReadyByTx.get(transaction.id)) continue;

      // Skip if target milestone already confirmed (or N/R).
      const targetComp = completionByTxAndDefId.get(`${transaction.id}:${targetDefId}`);
      if (!targetComp) continue;
      if (targetComp.state !== "available") continue;

      // Compute anchor date. Reuses agent engine's logic via computeAnchorDate.
      const anchorComp = rule.anchorMilestoneId
        ? completionByTxAndDefId.get(`${transaction.id}:${rule.anchorMilestoneId}`) ?? null
        : null;
      const anchorDate = computeAnchorDate({
        rule,
        transaction,
        anchorCompletion: anchorComp,
      });
      if (!anchorDate) continue;

      // Timing fields (graceDays + repeatEveryDays) come from the
      // per-transaction snapshot; falls back to the live ReminderRule for
      // safety if the snapshot is missing or malformed. Settings edits
      // update ReminderRule (new files) without touching existing snapshots.
      const snapshotTiming = readSnapshotTiming(transaction.chaseRuleSnapshot, targetCode);
      const graceDays = snapshotTiming?.graceDays ?? rule.graceDays;
      const repeatEveryDays = snapshotTiming?.repeatEveryDays ?? rule.repeatEveryDays;

      // First-due-date = anchor + max(graceDays, floor)
      const grace = Math.max(graceDays, CLIENT_CHASE_GRACE_FLOOR_DAYS);
      const firstDueDate = addDays(anchorDate, grace);

      // Route to vendor or purchaser contacts based on code prefix.
      const side = sideForMilestoneCode(targetCode);
      if (!side) continue;
      const recipients = txContacts.filter((c) => c.roleType === side);

      for (const contact of recipients) {
        if (!contact.email) continue; // belt+braces

        const state = stateByKey.get(`${transaction.id}:${contact.id}:${targetCode}`);

        // Status filter: only "active" rows can receive more chases. The
        // "no row" case is the first-chase scenario.
        if (state && state.status !== "active") continue;

        // Chase-count cap (no further chases past 2). Escalation pass
        // handles flipping once the second window closes.
        if (state && state.chaseCount >= CLIENT_CHASE_COUNT_CAP) continue;

        // Is it time to chase?
        let reason: "first_chase" | "repeat_due";
        if (!state) {
          // First chase: today >= firstDueDate
          if (now < firstDueDate) continue;
          reason = "first_chase";
        } else {
          // Repeat chase: today >= lastChasedAt + repeatEveryDays
          // AND no engagement since lastChasedAt (engagement pauses the
          // chase loop — the chip flips green and we don't re-chase until
          // they go quiet again).
          if (!state.lastChasedAt) {
            // Defensive: state exists with chaseCount=0 (shouldn't happen
            // in practice — first send creates with chaseCount=1). Treat
            // as first-chase.
            if (now < firstDueDate) continue;
            reason = "first_chase";
          } else {
            const nextDue = addDays(state.lastChasedAt, repeatEveryDays);
            if (now < nextDue) continue;
            // Engagement gate: if the client engaged AFTER the last chase,
            // pause. The next chase only fires once they've gone quiet
            // (lastEngagedAt < lastChasedAt) again.
            if (state.lastEngagedAt && state.lastEngagedAt > state.lastChasedAt) {
              continue;
            }
            reason = "repeat_due";
          }
        }

        due.push({
          transactionId: transaction.id,
          contactId: contact.id,
          contactEmail: contact.email,
          contactName: contact.name,
          milestoneCode: targetCode,
          anchorDate,
          firstDueDate,
          reason,
          pausedScope,
        });
      }
    }
  }

  return due;
}

// ─── findEscalationCandidates — PURE READ ───────────────────────────────
// Active ClientChaseState rows that have hit either the chase-count cap
// (with the second window closed) or the 14-day silence ceiling.
//
// Whichever-hits-first: both conditions checked independently. If both
// match for the same row, escalateClientChaseStates produces ONE status
// flip (atomic update + status="active" precondition).

export type EscalationCandidate = {
  stateId: string;
  transactionId: string;
  contactId: string;
  milestoneCode: string;
  reason: "chase_count" | "silence_14d";
};

export async function findEscalationCandidates(now: Date): Promise<EscalationCandidate[]> {
  // Pull active rows with at least one chase (chaseCount=0 rows can't
  // escalate — nothing to escalate from).
  const rows = await prisma.clientChaseState.findMany({
    where: { status: "active", chaseCount: { gt: 0 } },
    select: {
      id: true,
      transactionId: true,
      contactId: true,
      milestoneCode: true,
      chaseCount: true,
      firstChasedAt: true,
      lastChasedAt: true,
      lastEngagedAt: true,
    },
  });
  if (rows.length === 0) return [];

  // Need each rule's repeatEveryDays for the chase-count path's "second
  // window must close" gate. Read from per-transaction snapshot (the same
  // value the chase pass used when scheduling those chases) — falling back
  // to the live rule if no snapshot. Keeping chase + escalation timing
  // consistent: if a settings edit shortens repeatEveryDays from 5 to 3,
  // an in-flight file still gets its old 5-day window everywhere.
  const codes = Array.from(new Set(rows.map((r) => r.milestoneCode)));
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { in: codes } },
    select: { targetMilestoneCode: true, repeatEveryDays: true },
  });
  const liveRepeatByCode = new Map<string, number>();
  for (const r of rules) {
    if (r.targetMilestoneCode) liveRepeatByCode.set(r.targetMilestoneCode, r.repeatEveryDays);
  }
  const txIds = Array.from(new Set(rows.map((r) => r.transactionId)));
  const txSnapshots = await prisma.propertyTransaction.findMany({
    where: { id: { in: txIds } },
    select: { id: true, chaseRuleSnapshot: true },
  });
  const snapshotByTx = new Map(txSnapshots.map((t) => [t.id, t.chaseRuleSnapshot]));
  function repeatFor(transactionId: string, code: string): number | undefined {
    const snap = readSnapshotTiming(snapshotByTx.get(transactionId), code);
    return snap?.repeatEveryDays ?? liveRepeatByCode.get(code);
  }

  const candidates: EscalationCandidate[] = [];

  for (const row of rows) {
    // 14-day silence path. Anchor = max(lastEngagedAt, firstChasedAt).
    // If no engagement ever, anchor = firstChasedAt.
    const silenceAnchor = row.lastEngagedAt && row.firstChasedAt && row.lastEngagedAt > row.firstChasedAt
      ? row.lastEngagedAt
      : row.firstChasedAt;
    if (silenceAnchor && daysBetween(now, silenceAnchor) >= CLIENT_CHASE_SILENCE_DAYS) {
      candidates.push({
        stateId: row.id,
        transactionId: row.transactionId,
        contactId: row.contactId,
        milestoneCode: row.milestoneCode,
        reason: "silence_14d",
      });
      continue; // whichever-hits-first → don't also flag chase_count
    }

    // Chase-count cap path. Requires:
    //   - chaseCount >= 2
    //   - last chase happened AND the repeat window has closed since
    //   - no engagement since last chase
    if (row.chaseCount >= CLIENT_CHASE_COUNT_CAP && row.lastChasedAt) {
      const repeat = repeatFor(row.transactionId, row.milestoneCode);
      if (repeat == null) continue; // no rule for this code (data hygiene)
      const windowEnd = addDays(row.lastChasedAt, repeat);
      if (now < windowEnd) continue;
      // Engagement gate: if engaged AFTER last chase, NOT a silence event.
      if (row.lastEngagedAt && row.lastEngagedAt > row.lastChasedAt) continue;
      candidates.push({
        stateId: row.id,
        transactionId: row.transactionId,
        contactId: row.contactId,
        milestoneCode: row.milestoneCode,
        reason: "chase_count",
      });
    }
  }

  return candidates;
}

// Atomic status flip — the precondition status="active" guarantees no
// double-escalation even under concurrent cron runs or retries. updateMany
// returns count=0 if the row already moved out of "active".
export async function escalateClientChaseState(
  candidate: EscalationCandidate,
): Promise<{ escalated: boolean }> {
  const result = await prisma.clientChaseState.updateMany({
    where: { id: candidate.stateId, status: "active" },
    data: { status: "escalated" },
  });
  return { escalated: result.count === 1 };
}

// ─── runClientChaseCron — SIDE-EFFECTING WRAPPER ─────────────────────────
// Orchestrates the chase pass (enqueue digests + ClientChaseState upserts)
// and the escalation pass (atomic status flips). Returns counts for the
// cron route's response payload.

export async function runClientChaseCron(now: Date = new Date()): Promise<{
  digestsEnqueued: number;
  contactsChased: number;
  escalations: number;
  pausedFallbacks: number;
  byReason: { first_chase: number; repeat_due: number; chase_count: number; silence_14d: number };
}> {
  const due = await findDueClientChases(now);

  // Split paused (→ fallback path, manual-handoff chip) from active
  // (→ digest enqueue). Pause leaves ClientChaseState untouched so the
  // schedule resumes from where it was when unpaused.
  const activeChases: DueChaseTuple[] = [];
  const pausedChases: DueChaseTuple[] = [];
  for (const d of due) {
    if (d.pausedScope) pausedChases.push(d);
    else activeChases.push(d);
  }

  // Group ACTIVE chases by contact for one-digest-per-contact-per-day.
  const byContact = new Map<string, DueChaseTuple[]>();
  for (const d of activeChases) {
    const key = `${d.transactionId}:${d.contactId}`;
    const arr = byContact.get(key) ?? [];
    arr.push(d);
    byContact.set(key, arr);
  }

  let digestsEnqueued = 0;
  for (const tuples of byContact.values()) {
    const first = tuples[0];
    const result = await enqueueClientChaseDigest({
      transactionId: first.transactionId,
      contactId: first.contactId,
      milestoneCodes: tuples.map((t) => t.milestoneCode),
    });
    if (result.enqueued) digestsEnqueued += 1;
  }

  // PAUSED tuples → manual-handoff ChaseTask with the "client_emails_paused"
  // chip. Dedupe by (transactionId, milestoneCode) — multiple contacts on the
  // same milestone share one fallback (the chip is per-milestone, per-file).
  // `createAgentChaseTaskForMilestone` is idempotent on the (transaction,
  // rule) tuple, so re-runs across cron passes update the same task.
  const seenPaused = new Set<string>();
  let pausedFallbacks = 0;
  for (const p of pausedChases) {
    const key = `${p.transactionId}:${p.milestoneCode}`;
    if (seenPaused.has(key)) continue;
    seenPaused.add(key);
    const result = await createAgentChaseTaskForMilestone({
      kind: "client_emails_paused",
      transactionId: p.transactionId,
      milestoneCode: p.milestoneCode,
      contactName: p.contactName,
      pausedScope: p.pausedScope!,
    });
    if (result) pausedFallbacks += 1;
  }

  // Escalation pass. Done AFTER the chase pass so that a row chased TODAY
  // (chaseCount incremented from 1→2) doesn't immediately escalate in the
  // same run — its second window must close (repeatEveryDays from today)
  // before escalation can fire on subsequent runs. Interpretation B.
  const candidates = await findEscalationCandidates(now);
  let escalations = 0;
  let chaseCountReason = 0;
  let silenceReason = 0;
  for (const c of candidates) {
    const { escalated } = await escalateClientChaseState(c);
    if (escalated) {
      escalations += 1;
      if (c.reason === "chase_count") chaseCountReason += 1;
      else silenceReason += 1;
    }
  }

  const firstChaseCount = due.filter((d) => d.reason === "first_chase").length;
  const repeatDueCount = due.filter((d) => d.reason === "repeat_due").length;

  return {
    digestsEnqueued,
    contactsChased: byContact.size,
    escalations,
    pausedFallbacks,
    byReason: {
      first_chase: firstChaseCount,
      repeat_due: repeatDueCount,
      chase_count: chaseCountReason,
      silence_14d: silenceReason,
    },
  };
}
