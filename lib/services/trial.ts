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
//       We compute (now - firstSubmissionAt) <= 7 days and return that.
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

import type { Prisma } from "@prisma/client";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function stampTrialState(
  agencyId: string,
  tx: Prisma.TransactionClient,
): Promise<boolean> {
  const agency = await tx.agency.findUnique({
    where: { id: agencyId },
    select: { firstSubmissionAt: true },
  });
  if (!agency) {
    throw new Error(`stampTrialState: Agency ${agencyId} not found`);
  }

  if (agency.firstSubmissionAt === null) {
    await tx.agency.update({
      where: { id: agencyId },
      data: { firstSubmissionAt: new Date() },
    });
    return true;
  }

  const elapsedMs = Date.now() - agency.firstSubmissionAt.getTime();
  return elapsedMs <= SEVEN_DAYS_MS;
}
