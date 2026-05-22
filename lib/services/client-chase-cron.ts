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
import type { ContactRole } from "@prisma/client";

export const CLIENT_CHASE_GRACE_FLOOR_DAYS = 1;
export const CLIENT_CHASE_COUNT_CAP = 2;
export const CLIENT_CHASE_SILENCE_DAYS = 14;

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
  const transactions = await prisma.propertyTransaction.findMany({
    where: { status: "active" },
    select: { id: true, createdAt: true },
  });
  if (transactions.length === 0) return [];
  const txIds = transactions.map((t) => t.id);

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

      // First-due-date = anchor + max(graceDays, floor)
      const grace = Math.max(rule.graceDays, CLIENT_CHASE_GRACE_FLOOR_DAYS);
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
            const nextDue = addDays(state.lastChasedAt, rule.repeatEveryDays);
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
  // window must close" gate. One bulk query.
  const codes = Array.from(new Set(rows.map((r) => r.milestoneCode)));
  const rules = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { in: codes } },
    select: { targetMilestoneCode: true, repeatEveryDays: true },
  });
  const repeatByCode = new Map<string, number>();
  for (const r of rules) {
    if (r.targetMilestoneCode) repeatByCode.set(r.targetMilestoneCode, r.repeatEveryDays);
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
      const repeat = repeatByCode.get(row.milestoneCode);
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
  byReason: { first_chase: number; repeat_due: number; chase_count: number; silence_14d: number };
}> {
  const due = await findDueClientChases(now);

  // Group by contact for one-digest-per-contact-per-day.
  const byContact = new Map<string, DueChaseTuple[]>();
  for (const d of due) {
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
    byReason: {
      first_chase: firstChaseCount,
      repeat_due: repeatDueCount,
      chase_count: chaseCountReason,
      silence_14d: silenceReason,
    },
  };
}
