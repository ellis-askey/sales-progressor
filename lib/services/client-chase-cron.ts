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
import { isExchangeDayActive } from "@/lib/services/exchange-day";
import { enqueueClientChaseDigest } from "@/lib/email/client-chase-digest";
import { createAgentChaseTaskForMilestone, clearFallbackForMilestone } from "@/lib/services/reminders";
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
  // When set, this chase is being SKIPPED because emails are paused (for
  // this contact, per-file, or agency-wide). The cron caller routes these
  // to the fallback path (manual-handoff ChaseTask with the
  // "client_emails_paused" chip) instead of enqueueing a digest. The chase
  // clock stays where it was, so unpausing picks up the schedule from
  // there.
  pausedScope?: "agency" | "file" | "contact";
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
  const allActive = await prisma.propertyTransaction.findMany({
    // isDemo excluded: demo files carry portal-eligible @example.com contacts
    // and old milestone anchors, so they'd otherwise qualify for real client
    // chase emails at rest. Demo sales never chase anyone.
    where: { status: "active", isDemo: false },
    select: {
      id: true,
      createdAt: true,
      agencyId: true,
      // Exchange-day suppression: a file aiming to exchange today is dropped
      // from the whole chase pass, so no automated client chase goes out on
      // exchange morning. See docs/active/exchange-day-SPEC.md.
      exchangeDayStartedAt: true,
      exchangeDayCancelledAt: true,
      exchangedAt: true,
      // Whole-file pause (AutomationStopModal "pause" choice + legacy
      // sync). Per-PERSON pausing moved to Contact.emailsPausedAt
      // (2026-08-11 email-settings drawer) — the per-side
      // vendorEmailsPaused / purchaserEmailsPaused columns are no longer
      // read here.
      clientEmailsPaused: true,
      chaseRuleSnapshot: true,
      // Needed for the purchaser contact-scoping below. After a relist,
      // old buyers stay attached to the file (Contact.propertyTransactionId
      // doesn't change) but on the archived round. Without this filter,
      // findDueClientChases would treat them as eligible purchasers and
      // fire chases at the wrong person (Bug uncovered 2026-06-17 on
      // cmpmjsnfd0052ltxowy2ss249 — Nick Poole was chased twice after
      // Hiranya's relist landed).
      activeBuyerRoundId: true,
    },
  });
  const transactions = allActive.filter((t) => !isExchangeDayActive(t));
  if (transactions.length === 0) return [];
  const txIds = transactions.map((t) => t.id);
  const activeRoundByTx = new Map(transactions.map((t) => [t.id, t.activeBuyerRoundId]));

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
  //
  // PHASE 1 (b)-CLASS: this is the client-chase cron. Reading archived
  // rounds' PMs here would mis-fire chase emails to real clients
  // post-relist (e.g. a previous buyer's PM26 complete would suppress
  // a chase that the new buyer should receive; a previous buyer's
  // incomplete PM would re-chase the new buyer for work already done).
  // Round-scoped via raw SQL with the OR clause that the Prisma cross-
  // tx limitation prevents in a single nested-where include.
  const completions = await prisma.$queryRaw<
    Array<{
      transactionId: string;
      milestoneDefinitionId: string;
      state: string;
      completedAt: Date | null;
      eventDate: Date | null;
      reconciledAtClaim: boolean;
    }>
  >`
    SELECT
      mc."transactionId",
      mc."milestoneDefinitionId",
      mc.state::text AS state,
      mc."completedAt",
      mc."eventDate",
      mc."reconciledAtClaim"
    FROM "MilestoneCompletion" mc
    JOIN "PropertyTransaction" pt ON mc."transactionId" = pt.id
    WHERE mc."transactionId" = ANY(${txIds})
      AND (
        mc."buyerRoundId" IS NULL
        OR mc."buyerRoundId" = pt."activeBuyerRoundId"
      )
  `;
  const rawContacts = await prisma.contact.findMany({
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
      buyerRoundId: true,
      // Per-contact chase pause (2026-08-11 email-settings drawer).
      emailsPausedAt: true,
      // Client-set timed pause (audit #11 / #15). Future date = skip chases.
      chasesPausedUntil: true,
    },
  });
  // Purchaser scoping: vendors are file-level (buyerRoundId IS NULL), but
  // purchasers belong to a specific buyer round. After a relist, the old
  // buyer's contact row stays attached to the file with the archived
  // round's id — those contacts must NOT be chased. Vendor side is
  // unaffected (vendors carry across rounds).
  const contacts = rawContacts.filter((c) => {
    if (c.roleType !== "purchaser") return true;
    return c.buyerRoundId === activeRoundByTx.get(c.propertyTransactionId);
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

  // Snooze suppression: if an agent has snoozed the ReminderLog for a
  // milestone, suppress client chases on that milestone too. Snooze =
  // "leave this alone until X" — applies symmetrically to agent reminders
  // and client chases. Once snoozedUntil passes, normal chase resumes.
  const snoozedReminders = await prisma.reminderLog.findMany({
    where: {
      transactionId: { in: txIds },
      status: "active",
      snoozedUntil: { gt: now },
      reminderRule: { targetMilestoneCode: { in: Array.from(allCodes) } },
    },
    select: {
      transactionId: true,
      reminderRule: { select: { targetMilestoneCode: true } },
    },
  });
  const snoozedTxCodes = new Set<string>();
  for (const r of snoozedReminders) {
    if (r.reminderRule.targetMilestoneCode) {
      snoozedTxCodes.add(`${r.transactionId}:${r.reminderRule.targetMilestoneCode}`);
    }
  }

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
    // File-level pause is now resolved per side (below, once we know the
    // chase's side) so seller-only / buyer-only toggles take effect
    // independently. agencyOff is file-wide and computed here.

    const txContacts = contactsByTx.get(transaction.id) ?? [];
    if (txContacts.length === 0) continue;

    for (const rule of chaseableRules) {
      const targetCode = rule.targetMilestoneCode!;
      const targetDefId = defByCode.get(targetCode);
      if (!targetDefId) continue;

      // Skip if rule.requiresExchangeReady and transaction isn't ready.
      if (rule.requiresExchangeReady && !exchangeReadyByTx.get(transaction.id)) continue;

      // Snooze suppression — agent has paused this milestone's reminder,
      // don't chase clients about it until snooze expires.
      if (snoozedTxCodes.has(`${transaction.id}:${targetCode}`)) continue;

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

      // Pause gates, most-specific last (2026-08-11 email-settings drawer):
      // agency-wide master toggle, whole-file pause (clientEmailsPaused,
      // the AutomationStopModal "pause" choice), then per-CONTACT pause
      // (Contact.emailsPausedAt) checked inside the loop. The old per-side
      // vendorEmailsPaused / purchaserEmailsPaused reads are replaced by
      // the per-contact flag (backfilled at migration time).
      const fileOff = transaction.clientEmailsPaused;

      for (const contact of recipients) {
        if (!contact.email) continue; // belt+braces

        // Client's own timed pause (audit #11 / #15): a future date means they
        // asked to hold reminders; auto-resumes once it passes.
        const clientPaused =
          contact.chasesPausedUntil != null && contact.chasesPausedUntil > new Date();

        const pausedScope: "agency" | "file" | "contact" | undefined = agencyOff
          ? "agency"
          : fileOff
            ? "file"
            : contact.emailsPausedAt != null || clientPaused
              ? "contact"
              : undefined;

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
    // 2026-07-13 fix (Chunk 1d): clamp any future-dated anchor to `now`
    // before doing the silence math. If bad data (clock skew, browser
    // clock drift, test fixture, manual data patch) puts lastEngagedAt
    // or firstChasedAt in the future, daysBetween(now, futureDate)
    // returns negative and the silence check (>= 14) silently passes as
    // false forever - the row escapes escalation. Clamp so future dates
    // read as "now" and the check behaves as if there was engagement
    // right this moment. Row still processes normally on subsequent
    // cron runs once real time catches up.
    const lastEngagedAt = row.lastEngagedAt && row.lastEngagedAt > now ? now : row.lastEngagedAt;
    const firstChasedAt = row.firstChasedAt && row.firstChasedAt > now ? now : row.firstChasedAt;

    // 14-day silence path. Anchor = max(lastEngagedAt, firstChasedAt).
    // If no engagement ever, anchor = firstChasedAt.
    const silenceAnchor = lastEngagedAt && firstChasedAt && lastEngagedAt > firstChasedAt
      ? lastEngagedAt
      : firstChasedAt;
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
    //
    // 2026-07-13 fix (Chunk 1d): also clamp lastChasedAt to `now` if
    // it's future-dated - otherwise addDays(future, repeat) pushes
    // windowEnd even further into the future and the row never escalates.
    const lastChasedAt = row.lastChasedAt && row.lastChasedAt > now ? now : row.lastChasedAt;
    if (row.chaseCount >= CLIENT_CHASE_COUNT_CAP && lastChasedAt) {
      const repeat = repeatFor(row.transactionId, row.milestoneCode);
      if (repeat == null) continue; // no rule for this code (data hygiene)
      const windowEnd = addDays(lastChasedAt, repeat);
      if (now < windowEnd) continue;
      // Engagement gate: if engaged AFTER last chase, NOT a silence event.
      if (lastEngagedAt && lastEngagedAt > lastChasedAt) continue;
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
  // 2026-07-13 (Chunk 6f/7): stamp a plain-English reason on the flip so
  // the chase-history panel reads WYSIWYG - no per-key lookup table needed
  // at the read site. Matches the existing ReminderLog.statusReason
  // convention (also plain English).
  const reasonCopy = candidate.reason === "chase_count"
    ? "Client chased twice with no reply"
    : "Client went 14 days without a reply";
  const result = await prisma.clientChaseState.updateMany({
    where: { id: candidate.stateId, status: "active" },
    data: { status: "escalated", statusReason: reasonCopy },
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
  // Manual-handoff markers cleared this pass because the milestone became
  // chaseable again (data added / resubscribed / unpaused). Observable so we
  // can see the fail-soft net self-healing rather than leaving stale chips.
  fallbacksCleared: number;
  // Per-item failures that were caught and skipped so one bad file can't
  // abort the whole pass. Non-zero here means the run completed but N items
  // errored — surfaced in the cron payload + JobRun record, and each is
  // console.error'd with its (transaction, contact/milestone) context. The
  // run itself still returns success; observability lives in this count.
  failures: number;
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
  let failures = 0;
  for (const tuples of byContact.values()) {
    const first = tuples[0];
    try {
      const result = await enqueueClientChaseDigest({
        transactionId: first.transactionId,
        contactId: first.contactId,
        milestoneCodes: tuples.map((t) => t.milestoneCode),
      });
      if (result.enqueued) digestsEnqueued += 1;
    } catch (err) {
      // Per-contact isolation: a single malformed file (bad snapshot, enqueue
      // failure) must not abort the remaining digests. Count + log; continue.
      failures += 1;
      console.error(
        `[client-chase] digest enqueue failed for tx=${first.transactionId} contact=${first.contactId}:`,
        err,
      );
    }
  }

  // Auto-clear stale manual-handoff markers. Any (transaction, milestone) that
  // is chaseable again this pass (contact now reachable / resubscribed / emails
  // unpaused → it's in activeChases) should shed the amber "handed to agent"
  // chip its earlier fallback left behind. Without this, a chip lingers after
  // the agent fixes the data until the milestone closes. Deduped per milestone;
  // clearFallbackForMilestone is a no-op when nothing was flagged.
  const clearedSeen = new Set<string>();
  let fallbacksCleared = 0;
  for (const d of activeChases) {
    const key = `${d.transactionId}:${d.milestoneCode}`;
    if (clearedSeen.has(key)) continue;
    clearedSeen.add(key);
    try {
      const cleared = await clearFallbackForMilestone(d.transactionId, d.milestoneCode);
      if (cleared) fallbacksCleared += 1;
    } catch (err) {
      failures += 1;
      console.error(
        `[client-chase] fallback auto-clear failed for tx=${d.transactionId} milestone=${d.milestoneCode}:`,
        err,
      );
    }
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
    try {
      const result = await createAgentChaseTaskForMilestone({
        kind: "client_emails_paused",
        transactionId: p.transactionId,
        milestoneCode: p.milestoneCode,
        contactName: p.contactName,
        pausedScope: p.pausedScope!,
      });
      if (result) pausedFallbacks += 1;
    } catch (err) {
      failures += 1;
      console.error(
        `[client-chase] paused fallback failed for tx=${p.transactionId} milestone=${p.milestoneCode}:`,
        err,
      );
    }
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
    try {
      const { escalated } = await escalateClientChaseState(c);
      if (escalated) {
        escalations += 1;
        if (c.reason === "chase_count") chaseCountReason += 1;
        else silenceReason += 1;
      }
    } catch (err) {
      failures += 1;
      console.error(
        `[client-chase] escalation failed for state=${c.stateId} tx=${c.transactionId}:`,
        err,
      );
    }
  }

  const firstChaseCount = due.filter((d) => d.reason === "first_chase").length;
  const repeatDueCount = due.filter((d) => d.reason === "repeat_due").length;

  return {
    digestsEnqueued,
    contactsChased: byContact.size,
    escalations,
    pausedFallbacks,
    fallbacksCleared,
    failures,
    byReason: {
      first_chase: firstChaseCount,
      repeat_due: repeatDueCount,
      chase_count: chaseCountReason,
      silence_14d: silenceReason,
    },
  };
}
