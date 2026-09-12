// Append-only milestone availability history (Data Optionality capture-now, PR3).
//
// Records the genuinely-irrecoverable mid-life availability transitions — a
// milestone becoming actionable (locked → available) or being re-locked
// (available → locked) partway through a file's life. It does NOT define
// availability; it observes the milestone engine and writes one row per
// transition using the SAME Prisma client the state change runs on, so a failed
// insert rolls the transition back (see callers in lib/services/milestones.ts).
//
// Capture-only: no product surface reads MilestoneAvailabilityEvent yet.
//
// Init and relist availability are intentionally NOT recorded here — they
// coincide with the MilestoneCompletion row's createdAt and are reconstructable.

import type { Prisma, PrismaClient, MilestoneSide } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export type AvailabilityTransition = "became_available" | "became_locked";
export type AvailabilityCause =
  | "prereq_satisfied"
  | "not_required_satisfied"
  | "exchange_gate_unlocked"
  | "gate_relock"
  | "reversal";

/** Vendor milestone codes start "VM", purchaser "PM". Anything else → null. */
export function sideForMilestoneCode(code: string): MilestoneSide | null {
  if (code.startsWith("VM")) return "vendor";
  if (code.startsWith("PM")) return "purchaser";
  return null;
}

export type AvailabilityEventInput = {
  transactionId: string;
  milestoneDefinitionId: string;
  milestoneCode: string;
  buyerRoundId: string | null;
  transition: AvailabilityTransition;
  cause: AvailabilityCause;
};

/**
 * Pure builder for the row we persist — extracted so the side-derivation and
 * shape can be unit-tested without a database. `side` is derived from the code
 * so callers don't need an extra lookup.
 */
export function buildAvailabilityEvent(input: AvailabilityEventInput) {
  return {
    transactionId: input.transactionId,
    milestoneDefinitionId: input.milestoneDefinitionId,
    milestoneCode: input.milestoneCode,
    buyerRoundId: input.buyerRoundId,
    side: sideForMilestoneCode(input.milestoneCode),
    transition: input.transition,
    cause: input.cause,
  };
}

/**
 * Append one availability-transition row. MUST be passed the same `db` handle
 * (transaction client) that performed the state change, so the two commit or
 * roll back together. Deliberately NOT wrapped in try/catch — this data is
 * irrecoverable, so a write failure should fail the transition rather than be
 * silently swallowed.
 */
export async function recordAvailabilityTransition(
  db: Db,
  input: AvailabilityEventInput,
): Promise<void> {
  await db.milestoneAvailabilityEvent.create({ data: buildAvailabilityEvent(input) });
}
