// What an EXTERNAL progression business owes TSP for using the platform.
//
// Model (founder, 2026-10-03): a monthly subscription of £59 for the owner +
// £39 per additional active team member, PLUS £5 per sale ADDED (recorded at sale
// creation on PropertyTransaction.businessPerSaleChargedAt — NOT at exchange).
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
export const BUSINESS_PER_SALE_PENCE = 500;     // £5  — each sale added for the business

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
  // Per-sale (sales ADDED this month)
  saleCount: number;
  perSalePence: number;        // total for all sales added this month
  // Rolled up
  lines: BusinessBillingLine[];
  subtotalPence: number;       // == totalPence (no VAT, no credits yet)
  totalPence: number;
};

export type BusinessFirstChargePreview = {
  dueTodayPence: number;    // pro-rated subscription for the rest of this month, taken on card-save
  daysLeft: number;         // whole days remaining this month, incl. today
  monthLabel: string;       // "October"
  nextPaymentLabel: string; // "1 November"
  basePence: number;        // 5900
  perSalePence: number;     // 500
  perMemberPence: number;   // 3900
};

/**
 * What the business is charged THE MOMENT they add a card: the subscription
 * (base + any extra seats) pro-rated for the remainder of the current month, so
 * the modal can show "Due today" honestly. Mirrors Stripe's own proration maths
 * (by the second, against the current month window) so the figure matches the
 * charge without an extra Stripe round-trip. The recurring £59 then lands on the
 * 1st, anchored exactly as syncBusinessSubscription sets billing_cycle_anchor.
 */
export async function getBusinessFirstChargePreview(businessId: string, now: Date = new Date()): Promise<BusinessFirstChargePreview> {
  const { start, end } = billingMonthRange(now);
  const nowMs = now.getTime();
  const anchorMs = end.getTime();      // midnight on the 1st of next month (London)
  const prevAnchorMs = start.getTime(); // midnight on the 1st of this month (London)
  const ratio = anchorMs > prevAnchorMs ? Math.max(0, Math.min(1, (anchorMs - nowMs) / (anchorMs - prevAnchorMs))) : 1;

  const memberCount = await prisma.user.count({ where: { progressionBusinessId: businessId, deactivatedAt: null } });
  const extraMembers = Math.max(0, memberCount - 1);
  // Each subscription line pro-rates (and rounds) separately in Stripe.
  const dueTodayPence = Math.round(BUSINESS_BASE_PENCE * ratio) + Math.round(extraMembers * BUSINESS_PER_MEMBER_PENCE * ratio);

  const londonDay = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric" }).format(now));
  const daysInMonth = Math.round((anchorMs - prevAnchorMs) / 86400000);
  const daysLeft = Math.max(1, daysInMonth - londonDay + 1);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long" }).format(now);
  const nextPaymentLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long" }).format(end);

  return {
    dueTodayPence, daysLeft, monthLabel, nextPaymentLabel,
    basePence: BUSINESS_BASE_PENCE, perSalePence: BUSINESS_PER_SALE_PENCE, perMemberPence: BUSINESS_PER_MEMBER_PENCE,
  };
}

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
    // This month's ADDED sales for the business (the £5-per-sale lines).
    prisma.propertyTransaction.findMany({
      where: { progressionBusinessId: businessId, businessPerSaleChargedAt: { gte: start, lt: end } },
      select: { id: true, propertyAddress: true, businessPerSaleChargedAt: true },
      orderBy: { businessPerSaleChargedAt: "asc" },
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
