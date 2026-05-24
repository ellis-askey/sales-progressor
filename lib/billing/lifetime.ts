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
// "Saved via trial" is summed across all PropertyTransaction rows on the
// agency where freeOnExchange = true and exchangedAt is set — what would
// have been billed if not in trial, run through computeFee for the £ value.

import { prisma } from "@/lib/prisma";
import { computeFee } from "@/lib/billing/fee";

export type LifetimeMetrics = {
  /** Sum of totalPence across all this agency's InvoiceLines on non-building invoices. */
  billedLifetimePence: number;
  /** Count of exchanges that fell within a trial window (freeOnExchange + exchangedAt). */
  trialExchangeCountLifetime: number;
  /** Sum of what trial exchanges WOULD have charged at gross rates. The value given away. */
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

  // Trial-given-away: lifetime sum. Reads PropertyTransaction directly since
  // trial files never appear on invoices.
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { vatRegisteredAt: true, vatRateBps: true },
  });
  const vat = agency ?? null;
  const trials = await prisma.propertyTransaction.findMany({
    where: { agencyId, freeOnExchange: true, exchangedAt: { not: null } },
    select: { serviceType: true, priceAtExchange: true, purchasePrice: true },
  });
  let savedViaTrialLifetimePence = 0;
  for (const t of trials) {
    const fee = computeFee(t.serviceType, t.priceAtExchange ?? t.purchasePrice, vat);
    savedViaTrialLifetimePence += fee.totalPence;
  }

  return {
    billedLifetimePence,
    trialExchangeCountLifetime: trials.length,
    savedViaTrialLifetimePence,
  };
}
