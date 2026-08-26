// lib/services/trial.ts
//
// Frozen-trial stamp for the payments model. Called from inside the canonical
// PropertyTransaction-create paths (lib/services/transactions.ts and
// app/api/claim/route.ts) so manual creates and claim-signup creates both
// route through the same logic.
//
// Behaviour:
//   - On the agency's first-ever PropertyTransaction create:
//       Agency.firstSubmissionAt is set to now AND we return true (the new
//       transaction is the trial-anchor file, definitionally free-on-exchange).
//   - On subsequent creates:
//       We compute (now - firstSubmissionAt) <= 14 days and return that.
//
// The returned boolean is the value the caller stamps onto
// PropertyTransaction.freeOnExchange — which is then NEVER recomputed.
// Billing at exchange time reads the row's stamped flag directly, months or
// years later, ignoring agency.firstSubmissionAt entirely.
//
// MUST be called inside the same Prisma transaction as the
// propertyTransaction.create so the firstSubmissionAt write (when it happens)
// and the freeOnExchange stamp are atomic — otherwise two parallel creates
// from the same agency could both observe firstSubmissionAt as null and both
// claim to be the anchor file.
//
// Trial window: bumped 7 → 14 days (2026-05-24). Two weeks is still trivial
// in property-transaction time, but gives agencies a meaningful runway to
// add several sales and feel the product working before any of them become
// billable. Constant change only — does NOT retroactively re-stamp existing
// rows; existing PropertyTransaction.freeOnExchange values stay as written.
//
// Legacy-tier exception: legacy agencies are on a fixed fee per their
// pre-existing contract and explicitly get no onboarding trial. We always
// return false for them — every legacy sale is billable from sale 1. The
// firstSubmissionAt timestamp is still set on their first create (it's
// referenced by other surfaces — analytics, the hub banner's elapsed-time
// math for standard-tier agencies, etc.), but the trial verdict ignores
// it. Pre-existing legacy transactions stamped freeOnExchange=true during
// the previous behaviour stay stamped (audit constant) — see commit log
// for the historical-data audit that ran alongside this change.

import type { Prisma } from "@prisma/client";

const TRIAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export async function stampTrialState(
  agencyId: string,
  tx: Prisma.TransactionClient,
): Promise<boolean> {
  const agency = await tx.agency.findUnique({
    where: { id: agencyId },
    select: { firstSubmissionAt: true, feeTier: true },
  });
  if (!agency) {
    throw new Error(`stampTrialState: Agency ${agencyId} not found`);
  }

  // Free-tier agencies: every file is free-on-exchange, forever — this is the
  // permanent free self-managed plan, not the 14-day trial. Still stamp
  // firstSubmissionAt so analytics have the anchor.
  if (agency.feeTier === "free") {
    if (agency.firstSubmissionAt === null) {
      await tx.agency.update({ where: { id: agencyId }, data: { firstSubmissionAt: new Date() } });
    }
    return true;
  }

  // Legacy agencies: no trial, ever. Still stamp firstSubmissionAt on the
  // first create so downstream surfaces that key off it (analytics etc.)
  // see the correct anchor — but the trial verdict is always false.
  if (agency.feeTier === "legacy") {
    if (agency.firstSubmissionAt === null) {
      await tx.agency.update({
        where: { id: agencyId },
        data: { firstSubmissionAt: new Date() },
      });
    }
    return false;
  }

  if (agency.firstSubmissionAt === null) {
    await tx.agency.update({
      where: { id: agencyId },
      data: { firstSubmissionAt: new Date() },
    });
    return true;
  }

  const elapsedMs = Date.now() - agency.firstSubmissionAt.getTime();
  return elapsedMs <= TRIAL_WINDOW_MS;
}
