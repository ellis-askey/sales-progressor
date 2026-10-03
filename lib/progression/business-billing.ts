// What an EXTERNAL progression business owes TSP for using the platform.
//
// Model (founder, 2026-10-03): a monthly subscription of £59 for the owner +
// £39 per additional active team member, PLUS £5 per completed sale (recorded at
// exchange on PropertyTransaction.businessBilledAtExchange by maybeStampExchange).
//
// This is DISPLAY + ACCRUAL only — it computes the bill; it does NOT take money.
// Collection (the Stripe subscription + charging) lands behind a billing switch
// (Arc B4), dark until flipped, exactly like the agency billing (BILLING_AUTO_
// ISSUE_ENABLED). TSP is not VAT-registered, so these are flat, no VAT shown.
//
// Separate from the agency billing (lib/billing/*, keyed on agencyId) by design —
// nothing here touches an agency's bill.

import { prisma } from "@/lib/prisma";
import { billingMonthRange } from "@/lib/billing/period";

export const BUSINESS_BASE_PENCE = 5900;        // £59 — the owner / main user
export const BUSINESS_PER_MEMBER_PENCE = 3900;  // £39 — each additional active member
export const BUSINESS_PER_SALE_PENCE = 500;     // £5  — each completed (exchanged) sale

export type BusinessBillingLine = {
  kind: "subscription_base" | "subscription_seat" | "per_sale";
  description: string;
  amountPence: number;
};

export type BusinessBillingSummary = {
  monthStart: Date;
  monthEnd: Date;
  // Subscription
  memberCount: number;         // active members incl. owner
  extraMembers: number;        // billable seats beyond the owner
  basePence: number;
  seatsPence: number;
  // Per-sale
  saleCount: number;
  perSalePence: number;        // total for all sales this month
  // Rolled up
  lines: BusinessBillingLine[];
  subtotalPence: number;       // == totalPence (no VAT, no credits yet)
  totalPence: number;
};

/**
 * The current-month bill for a progression business. Subscription (base + seats)
 * is always present; per-sale lines are this month's exchanged files for the
 * business. Pure read — no writes, no Stripe.
 */
export async function getBusinessBillingSummary(businessId: string, now: Date = new Date()): Promise<BusinessBillingSummary> {
  const { start, end } = billingMonthRange(now);

  const [memberCount, sales] = await Promise.all([
    // Active members (owner + progressors); deactivated members don't count.
    prisma.user.count({
      where: { progressionBusinessId: businessId, deactivatedAt: null },
    }),
    // This month's completed sales for the business (the £5-per-sale lines).
    prisma.propertyTransaction.findMany({
      where: { progressionBusinessId: businessId, businessBilledAtExchange: { gte: start, lt: end } },
      select: { id: true, propertyAddress: true, businessBilledAtExchange: true },
      orderBy: { businessBilledAtExchange: "asc" },
    }),
  ]);

  const extraMembers = Math.max(0, memberCount - 1); // the owner is the base
  const basePence = BUSINESS_BASE_PENCE;
  const seatsPence = extraMembers * BUSINESS_PER_MEMBER_PENCE;
  const saleCount = sales.length;
  const perSalePence = saleCount * BUSINESS_PER_SALE_PENCE;

  const lines: BusinessBillingLine[] = [
    { kind: "subscription_base", description: "Subscription — main user", amountPence: basePence },
  ];
  if (extraMembers > 0) {
    lines.push({
      kind: "subscription_seat",
      description: `Team members — ${extraMembers} × £${(BUSINESS_PER_MEMBER_PENCE / 100).toFixed(0)}`,
      amountPence: seatsPence,
    });
  }
  for (const s of sales) {
    lines.push({ kind: "per_sale", description: `Sale — ${s.propertyAddress}`, amountPence: BUSINESS_PER_SALE_PENCE });
  }

  const totalPence = basePence + seatsPence + perSalePence;
  return {
    monthStart: start, monthEnd: end,
    memberCount, extraMembers, basePence, seatsPence,
    saleCount, perSalePence,
    lines, subtotalPence: totalPence, totalPence,
  };
}
