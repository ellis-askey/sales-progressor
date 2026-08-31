// lib/services/trial.ts
//
// Create-time "free on exchange" stamp for the 2026-08 pricing model.
//
// The 14-day onboarding trial has been REMOVED. Self-progress is now free by
// service type (enforced at the exchange trigger, lib/services/billing-trigger
// .ts), and an outsourced file bills unless it turns out to be the agency's
// free first one (also decided at exchange). So a new file is not "free on
// exchange" via any trial window.
//
// This helper now only:
//   - sets Agency.firstSubmissionAt on the agency's first-ever file (kept as an
//     analytics / activation / retention anchor, used well beyond billing), and
//   - returns true only for a comped agency (feeTier = "free"), whose every
//     file is free regardless of service type. Everyone else returns false;
//     their free-ness (self-progress, or a free first outsourced file) is
//     decided at exchange, not here.
//
// Existing rows are never re-stamped — historical PropertyTransaction.
// freeOnExchange values stay as written.
//
// (The name stampTrialState + its two call sites are kept for now; renaming to
// something like stampCreateTimeFreeState is a Phase-2 cleanup.)

import type { Prisma } from "@prisma/client";

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

  // First-ever file: set the activation anchor (analytics, retention, the hub's
  // timing math, etc.) — independent of any pricing decision.
  if (agency.firstSubmissionAt === null) {
    await tx.agency.update({
      where: { id: agencyId },
      data: { firstSubmissionAt: new Date() },
    });
  }

  // Comped agencies (feeTier = "free"): every file is free on exchange,
  // regardless of service type. The deliberate all-free escape hatch — distinct
  // from the removed 14-day trial and from the default self-progress-free-by-
  // type behaviour.
  if (agency.feeTier === "free") return true;

  // No trial. Self-progress is free at the exchange trigger; an outsourced file
  // bills unless it is the free first one (decided at exchange). Nothing is free
  // on exchange by a create-time window any more.
  return false;
}
