// lib/billing/payment-block.ts
//
// New-file-creation block for agencies with overdue failed payments.
//
// Timeline:
//   - Day 0: Stripe webhook receives invoice.payment_failed
//             → Agency.paymentFailedAt = now() (if not already set)
//             → state = "warning" (no creation block yet)
//   - Day 0..7: Stripe's own retry schedule runs, paymentFailedAt unchanged
//   - Day 7+: daily check-failed-payments cron sees paymentFailedAt + 7d <= now
//             → Agency.newFileCreationBlockedAt = now()
//             → state = "blocked" (createTransaction + claim refuse new files)
//   - On invoice.payment_succeeded (any time): webhook clears both flags
//             → state = "ok"
//
// The warning state exists so the UI can flag "a payment failed — fix the
// card before <date>" without blocking the agency from operating during the
// grace window. Director-only visibility.
//
// Existing files keep running regardless of state — chases, comms, milestone
// completions, exchange stamps. The block is strictly on NEW file creation
// (createTransaction + the claim path's /api/claim "create" action).

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Bumped from 7 → 14 (2026-05-24): 7 days was tight for real-world card
// issues (travel, new card in post, holiday banking). 14 still drives a
// resolution timeline but doesn't punish reasonable delays.
const PAYMENT_FAILURE_GRACE_DAYS = 14;
export const PAYMENT_FAILURE_GRACE_MS = PAYMENT_FAILURE_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type PaymentBlockState =
  | { kind: "ok" }
  | { kind: "warning"; paymentFailedAt: Date; gracePeriodEndsAt: Date }
  | { kind: "blocked"; paymentFailedAt: Date; blockedAt: Date };

/**
 * Read the agency's current payment-block state. Used by:
 *   - createTransaction + claim route to reject new files (assertCanCreate)
 *   - hub banner to surface warning/blocked UI to the director
 */
export async function getPaymentBlockState(
  agencyId: string,
  tx?: Prisma.TransactionClient,
): Promise<PaymentBlockState> {
  const db = tx ?? prisma;
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    select: { paymentFailedAt: true, newFileCreationBlockedAt: true },
  });
  if (!agency || agency.paymentFailedAt === null) return { kind: "ok" };
  if (agency.newFileCreationBlockedAt !== null) {
    return {
      kind: "blocked",
      paymentFailedAt: agency.paymentFailedAt,
      blockedAt: agency.newFileCreationBlockedAt,
    };
  }
  return {
    kind: "warning",
    paymentFailedAt: agency.paymentFailedAt,
    gracePeriodEndsAt: new Date(agency.paymentFailedAt.getTime() + PAYMENT_FAILURE_GRACE_MS),
  };
}

/**
 * Thrown by assertCanCreateFile when the agency is in the "blocked" state.
 * The caller (server action / API route) catches this and translates it to
 * a clear "Update your card to add new files" UX surface.
 */
export class PaymentBlockedError extends Error {
  readonly code = "PAYMENT_BLOCKED";
  readonly blockedAt: Date;
  readonly paymentFailedAt: Date;
  constructor(state: Extract<PaymentBlockState, { kind: "blocked" }>) {
    super("A payment failed — update your card to add new files");
    this.blockedAt = state.blockedAt;
    this.paymentFailedAt = state.paymentFailedAt;
  }
}

/**
 * Hard gate on new-file creation. Throws PaymentBlockedError if blocked.
 * No-op for "ok" or "warning" states (warning is informational only —
 * agency can still create during the grace period).
 *
 * Call inside the same prisma.$transaction as the create. The block flag
 * is read at create time and acted on immediately; not race-prone in
 * practice because the flag transitions are infrequent and slow (cron-driven).
 */
export async function assertCanCreateFile(
  agencyId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const state = await getPaymentBlockState(agencyId, tx);
  if (state.kind === "blocked") {
    throw new PaymentBlockedError(state);
  }
}

/**
 * Daily cron logic: for any agency with paymentFailedAt + 14 days < now
 * and newFileCreationBlockedAt still null, set newFileCreationBlockedAt = now.
 * Idempotent — re-runs after the flag is set are no-ops via the WHERE clause.
 */
export async function markOverdueAgenciesBlocked(now: Date = new Date()): Promise<{ blockedCount: number }> {
  const threshold = new Date(now.getTime() - PAYMENT_FAILURE_GRACE_MS);
  const result = await prisma.agency.updateMany({
    where: {
      paymentFailedAt: { lte: threshold, not: null },
      newFileCreationBlockedAt: null,
    },
    data: { newFileCreationBlockedAt: now },
  });
  return { blockedCount: result.count };
}
