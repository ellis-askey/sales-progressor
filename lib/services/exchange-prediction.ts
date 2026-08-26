// Persist the live phase-aware exchange prediction to the stored
// expectedExchangeDate column.
//
// Background: calculatePhaseAwarePrediction() (lib/services/fees.ts) already
// produces a self-adjusting predicted exchange date on every file/portal/chain
// render — it walks the remaining vendor + purchaser critical path and shrinks
// as milestones complete. But the hub, diary and "exchanging soon" surfaces
// read the stored `expectedExchangeDate` column (default createdAt + 84 days),
// NOT that live computation. So the good prediction was invisible on the hub
// and the stored date never moved with the file.
//
// This helper closes that gap: recompute the prediction whenever milestones
// change and write it to expectedExchangeDate, so the hub shows a realistic
// date that self-adjusts. Overrides stay independent — every display surface
// reads `overridePredictedDate ?? expectedExchangeDate`, so a manual agent
// override still wins; we deliberately pass null override here so the stored
// column holds the pure system prediction.
//
// See docs/active/three-notes-distilled-2026-08-26.md (Note 1, Scenarios A/B/C).

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { addWorkingDays } from "@/lib/emails/working-hours";
import {
  calculatePhaseAwarePrediction,
  computeEffectiveStartDate,
  type PhaseAwareInput,
} from "@/lib/services/fees";

// Once either side's exchange is confirmed, expectedExchangeDate holds the REAL
// exchange date (stamped by the VM19/PM26 sync in confirmMilestoneAction) and
// must never be overwritten by a forecast.
const EXCHANGED_CODES = new Set(["VM19", "PM26"]);

type Client = Prisma.TransactionClient | typeof prisma;

/**
 * Recompute the phase-aware predicted exchange date for a transaction and
 * persist it to expectedExchangeDate.
 *
 * No-op once the file has exchanged (the confirmed real date stands). Best
 * effort: callers should treat a rejection as non-fatal — a missed refresh
 * only means the stored date is briefly stale, not that the milestone write
 * failed. Returns the date it wrote, or null when it made no change.
 */
export async function refreshExpectedExchangeDate(
  transactionId: string,
  client: Client = prisma,
): Promise<Date | null> {
  const txn = await client.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      createdAt: true,
      purchaseType: true,
      tenure: true,
      isShareOfFreehold: true,
      milestoneCompletions: {
        where: { state: "complete" },
        select: {
          eventDate: true,
          reconciledAtClaim: true,
          milestoneDefinition: { select: { code: true } },
        },
      },
    },
  });
  if (!txn) return null;

  const completedCodes = txn.milestoneCompletions
    .map((c) => c.milestoneDefinition?.code)
    .filter((c): c is string => !!c);

  // File has exchanged → real date stands, don't overwrite with a forecast.
  if (completedCodes.some((c) => EXCHANGED_CODES.has(c))) return null;

  const effectiveStartDate = computeEffectiveStartDate(
    txn.createdAt,
    txn.milestoneCompletions.map((c) => ({
      eventDate: c.eventDate,
      reconciledAtClaim: c.reconciledAtClaim,
    })),
  );

  const phaseAware: PhaseAwareInput = {
    completedMilestoneCodes: completedCodes,
    purchaseType: txn.purchaseType as PhaseAwareInput["purchaseType"],
    tenure: txn.tenure as PhaseAwareInput["tenure"],
    isShareOfFreehold: txn.isShareOfFreehold,
    effectiveStartDate,
  };

  // null override: the stored column holds the pure system prediction;
  // overridePredictedDate remains the separate agent-set layer that wins on
  // every display surface.
  const predicted = calculatePhaseAwarePrediction(phaseAware, txn.createdAt, null);

  await client.propertyTransaction.update({
    where: { id: transactionId },
    data: { expectedExchangeDate: predicted },
  });

  return predicted;
}

// ─── Scenario D: overdue-and-stuck detection ─────────────────────────────────
// See docs/active/three-notes-distilled-2026-08-26.md (Note 1, Scenario D).

// Grace before an overdue exchange nags. A file exchanging a couple of days
// later than predicted is normal, so we only flag once it's this many working
// days past AND the file has gone quiet. Single tunable constant — retune here
// after watching it behave.
export const OVERDUE_GRACE_WD = 2;

/**
 * Is this file's exchange overdue *and stuck*?
 *
 * Overdue: the effective predicted date (a manual override if set, else the
 * stored prediction) is more than OVERDUE_GRACE_WD working days in the past and
 * the file hasn't exchanged.
 *
 * Stuck: no milestone has been confirmed on or after that date. A file that is
 * still moving self-heals — each confirm calls refreshExpectedExchangeDate,
 * pushing expectedExchangeDate to a future prediction, so it never reaches the
 * overdue window. The silence test still matters for the manual-override case,
 * where a past override is NOT refreshed by ongoing confirmations.
 *
 * Shared by the hub attention list (getHubAttentionItems) and the file-level
 * revise banner so both agree on exactly when to nag.
 */
export function isExchangeOverdueStuck(args: {
  exchangedAt: Date | null;
  expectedExchangeDate: Date | null;
  overridePredictedDate: Date | null;
  lastMilestoneConfirmedAt: Date | null;
  now?: Date;
}): { stuck: boolean; passedDate: Date | null } {
  const now = args.now ?? new Date();
  if (args.exchangedAt) return { stuck: false, passedDate: null };

  const effective = args.overridePredictedDate ?? args.expectedExchangeDate;
  if (!effective) return { stuck: false, passedDate: null };

  // Not yet past the working-day grace → not overdue.
  if (now < addWorkingDays(effective, OVERDUE_GRACE_WD)) {
    return { stuck: false, passedDate: effective };
  }

  // Confirmed activity on/after the date → still moving, not stuck.
  if (args.lastMilestoneConfirmedAt && args.lastMilestoneConfirmedAt >= effective) {
    return { stuck: false, passedDate: effective };
  }

  return { stuck: true, passedDate: effective };
}
