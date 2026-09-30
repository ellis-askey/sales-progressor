import "server-only";

import { prisma } from "@/lib/prisma";
import type { ProgressionBusiness } from "@prisma/client";

// Progression-business identity resolution (docs/active/progression-businesses/,
// Phase 1). The transaction is the access boundary; this module answers "which
// progression business is responsible for this file, and what is its
// client-facing identity" — defaulting a null progressionBusinessId to TSP
// (progression business #1) WITHOUT ever falling back to TSP for an explicit
// external id.

/**
 * The platform operator's own progression business (The Sales Progressor,
 * isTsp = true). This is the fallback identity for every transaction whose
 * progressionBusinessId is null. Seeded by the migration's idempotent INSERT and
 * by scripts/seed-progression-tsp.ts / prisma/seed.ts.
 *
 * Throws if the row is missing so a mis-seeded environment fails loudly rather
 * than silently mis-attributing files.
 */
export async function getTspBusiness(): Promise<ProgressionBusiness> {
  const tsp = await prisma.progressionBusiness.findFirst({ where: { isTsp: true } });
  if (!tsp) {
    throw new Error(
      "No TSP ProgressionBusiness row found. Seed it with scripts/seed-progression-tsp.ts " +
        "(staging/local) — production gets it from the Phase 1 migration.",
    );
  }
  return tsp;
}

/**
 * Resolve the progression business responsible for a transaction.
 *
 * - A null progressionBusinessId means TSP (legacy/self-run files were never
 *   backfilled) → resolves to the TSP row.
 * - An explicit id always resolves to THAT business and NEVER falls back to TSP.
 *   An unknown explicit id is a data-integrity fault and throws — silently
 *   returning TSP here would leak an external file's identity to TSP.
 */
export async function getProgressionBusinessForTransaction(tx: {
  progressionBusinessId: string | null;
}): Promise<ProgressionBusiness> {
  if (tx.progressionBusinessId == null) {
    return getTspBusiness();
  }
  const business = await prisma.progressionBusiness.findUnique({
    where: { id: tx.progressionBusinessId },
  });
  if (!business) {
    throw new Error(
      `Transaction references unknown progressionBusinessId ${tx.progressionBusinessId}.`,
    );
  }
  return business;
}

/**
 * True iff the given business id is the platform operator's (TSP) business.
 * Null is TSP by definition (a null progressionBusinessId means TSP), so
 * external progression-business members are exactly those with a non-null id
 * that is not this one.
 */
export async function isTspBusiness(
  businessId: string | null | undefined,
): Promise<boolean> {
  if (businessId == null) return true;
  const tsp = await getTspBusiness();
  return businessId === tsp.id;
}
