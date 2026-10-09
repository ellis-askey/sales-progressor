// lib/progression/business-dunning.ts
//
// Failed-payment dunning for an external progression business. Mirrors the agency
// model (lib/billing/payment-block.ts) but on ProgressionBusiness:
//
//   - Day 0: invoice.payment_failed webhook → ProgressionBusiness.paymentFailedAt = now
//            → state "warning" (grace; can still add sales).
//   - Day 0..7: Stripe retries; paymentFailedAt unchanged (grace runs from the FIRST
//            failure, not each retry).
//   - Day 7+: the daily business-billing cron sets newFileCreationBlockedAt
//            → state "blocked": adding NEW sales is refused until the card is fixed.
//   - invoice.payment_succeeded (any time) → webhook clears both flags → "ok".
//   - customer.subscription.deleted → webhook clears the flags + the subscription id.
//
// Files already in progress keep running regardless — the block is only on adding
// new sales. Owner-facing in the UI; a teammate is told to ask the owner.

import { prisma } from "@/lib/prisma";
import { PAYMENT_FAILURE_GRACE_MS } from "@/lib/billing/payment-block";

export type BusinessPaymentState =
  | { kind: "ok" }
  | { kind: "warning"; paymentFailedAt: Date; gracePeriodEndsAt: Date }
  | { kind: "blocked"; paymentFailedAt: Date; blockedAt: Date };

/** Current dunning state for a business. Used by the add-sale gate (server + UI)
 *  and the billing-page banner. */
export async function getBusinessPaymentState(businessId: string): Promise<BusinessPaymentState> {
  const biz = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { paymentFailedAt: true, newFileCreationBlockedAt: true },
  });
  if (!biz || biz.paymentFailedAt === null) return { kind: "ok" };
  if (biz.newFileCreationBlockedAt !== null) {
    return { kind: "blocked", paymentFailedAt: biz.paymentFailedAt, blockedAt: biz.newFileCreationBlockedAt };
  }
  return {
    kind: "warning",
    paymentFailedAt: biz.paymentFailedAt,
    gracePeriodEndsAt: new Date(biz.paymentFailedAt.getTime() + PAYMENT_FAILURE_GRACE_MS),
  };
}

/** Thrown by createTransaction when a business is past its grace window. The action
 *  layer catches it and surfaces the "adding sales is paused" UX. */
export class BusinessPaymentBlockedError extends Error {
  readonly code = "BUSINESS_PAYMENT_BLOCKED";
  constructor() {
    super("A payment is overdue — update your card to add sales.");
    this.name = "BusinessPaymentBlockedError";
  }
}

/** Daily cron: any business whose first failure is 7+ days old and isn't blocked
 *  yet gets newFileCreationBlockedAt set. Idempotent via the WHERE guard. */
export async function markOverdueBusinessesBlocked(now: Date = new Date()): Promise<{ blockedCount: number }> {
  const threshold = new Date(now.getTime() - PAYMENT_FAILURE_GRACE_MS);
  const r = await prisma.progressionBusiness.updateMany({
    where: { paymentFailedAt: { lte: threshold, not: null }, newFileCreationBlockedAt: null },
    data: { newFileCreationBlockedAt: now },
  });
  return { blockedCount: r.count };
}
