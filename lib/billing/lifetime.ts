// lib/billing/lifetime.ts
//
// "Billed lifetime" + "Saved via trial" metrics for the billing hub.
//
// Per Ellis's call (2026-05-25): billed-lifetime reads the INVOICE TRAIL,
// not a live recompute from current PropertyTransaction state. The running
// total stays live-read (it's provisional, that's correct). But the
// lifetime total is a statement about money that actually changed hands —
// it should reflect what was invoiced, which is the historical record a
// director could reconcile against their bank. Reversals, credits, and
// price edits make live-recompute and invoice-sum diverge; this lifetime
// figure intentionally tracks the invoice trail.
//
// "Given free" is summed across all PropertyTransaction rows on the agency
// that were given away and have exchangedAt set: legacy trial files
// (freeOnExchange = true) AND first-outsourced-file giveaways under the free
// model (firstOutsourcedFree = true). Each is run through computeFee for the
// £ value that would otherwise have been billed.

import { prisma } from "@/lib/prisma";
import { computeFee } from "@/lib/billing/fee";

export type LifetimeMetrics = {
  /** Sum of totalPence across all this agency's InvoiceLines on non-building invoices. */
  billedLifetimePence: number;
  /** Count of exchanges given away: legacy trial (freeOnExchange) + first-outsourced-free. */
  trialExchangeCountLifetime: number;
  /** Sum of what those given-away exchanges WOULD have charged at gross rates. */
  savedViaTrialLifetimePence: number;
};

export async function getLifetimeMetrics(agencyId: string): Promise<LifetimeMetrics> {
  // Billed lifetime: sum of all InvoiceLine.totalPence across this agency's
  // invoices, excluding building (it's provisional) and void. credit_applied
  // lines are negative so they naturally net out.
  const billedAgg = await prisma.invoiceLine.aggregate({
    where: {
      invoice: { agencyId, status: { in: ["issued", "paid", "failed"] } },
    },
    _sum: { totalPence: true },
  });
  const billedLifetimePence = billedAgg._sum.totalPence ?? 0;

  // Given-away: lifetime sum. Reads PropertyTransaction directly. Legacy trial
  // files never appear on invoices; first-outsourced-free files appear at £0
  // net, so computeFee gives the gross value that was waived. Fee tier override
  // applies so a legacy agency's figure reflects what they ACTUALLY would have
  // paid (their flat fee), not the standard sliding scale.
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      vatRegisteredAt: true,
      vatRateBps: true,
      feeTier: true,
      legacyOutsourcedFeePence: true,
    },
  });
  const vat = agency ?? null;
  const feeOverride = agency
    ? { feeTier: agency.feeTier, legacyOutsourcedFeePence: agency.legacyOutsourcedFeePence }
    : null;
  const trials = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      exchangedAt: { not: null },
      OR: [{ freeOnExchange: true }, { firstOutsourcedFree: true }],
    },
    select: { serviceType: true, priceAtExchange: true, purchasePrice: true },
  });
  let savedViaTrialLifetimePence = 0;
  for (const t of trials) {
    const fee = computeFee(t.serviceType, t.priceAtExchange ?? t.purchasePrice, vat, feeOverride);
    savedViaTrialLifetimePence += fee.totalPence;
  }

  return {
    billedLifetimePence,
    trialExchangeCountLifetime: trials.length,
    savedViaTrialLifetimePence,
  };
}
