// lib/billing/accrual.ts
//
// Periodic accrual: for each agency with any billed exchanges in the
// current London billing month, ensure there's an open Invoice (status =
// "building") and reconcile its InvoiceLine rows against the source of
// truth (PropertyTransaction.billedAtExchange + serviceType +
// priceAtExchange).
//
// Idempotent: re-running mid-cycle inserts only newly-billed rows; never
// duplicates lines for transactions already accrued. Re-running after a
// reversal (which cleared billedAtExchange under PR 4 branch (a)) removes
// the corresponding line — keeps the invoice in sync with current truth.
//
// Applies any unapplied CreditNote against the building invoice as a
// credit_applied line, then marks the CreditNote with appliedAt + the
// invoice id. Once applied, a CreditNote no longer surfaces.
//
// The page total (lib/billing/running-total.ts) reads from
// PropertyTransaction directly and never touches Invoice/InvoiceLine, so
// the page is correct whether or not this cron has run since the last
// exchange. This cron exists to write the DURABLE billing history that
// Stripe will eventually issue (PR 7).

import { prisma } from "@/lib/prisma";
import { billingMonthRange } from "@/lib/billing/period";
import { computeFee } from "@/lib/billing/fee";
import type { InvoiceLineKind } from "@prisma/client";

export type AccrualResult = {
  monthStart: Date;
  agenciesProcessed: number;
  invoicesCreated: number;
  linesAdded: number;
  linesRemoved: number;
  creditsApplied: number;
};

export async function accrueInvoicesForCurrentMonth(now: Date = new Date()): Promise<AccrualResult> {
  const { start, end } = billingMonthRange(now);

  // Distinct agency ids that have at least one billed-this-month exchange.
  const agencyRows = await prisma.propertyTransaction.findMany({
    where: { billedAtExchange: { gte: start, lt: end } },
    distinct: ["agencyId"],
    select: { agencyId: true },
  });
  const agencyIds = agencyRows.map((r) => r.agencyId);

  let invoicesCreated = 0;
  let linesAdded = 0;
  let linesRemoved = 0;
  let creditsApplied = 0;

  for (const agencyId of agencyIds) {
    await prisma.$transaction(async (tx) => {
      // VAT state + fee-tier override for this agency — both passed to
      // computeFee. Per-agency lookup (cheap) so a mid-month flip (VAT
      // registration OR moving an agency to "legacy" pricing) is honoured
      // on the next run.
      const agencyRow = await tx.agency.findUnique({
        where: { id: agencyId },
        select: {
          vatRegisteredAt: true,
          vatRateBps: true,
          feeTier: true,
          legacyOutsourcedFeePence: true,
        },
      });
      const agencyVat = agencyRow
        ? { vatRegisteredAt: agencyRow.vatRegisteredAt, vatRateBps: agencyRow.vatRateBps }
        : null;
      const feeOverride = agencyRow
        ? { feeTier: agencyRow.feeTier, legacyOutsourcedFeePence: agencyRow.legacyOutsourcedFeePence }
        : null;

      // Ensure the open invoice exists (single row enforced by
      // @@unique([agencyId, monthStart])).
      let invoice = await tx.invoice.findUnique({
        where: { agencyId_monthStart: { agencyId, monthStart: start } },
      });
      if (!invoice) {
        invoice = await tx.invoice.create({
          data: { agencyId, monthStart: start, status: "building" },
        });
        invoicesCreated++;
      } else if (invoice.status !== "building") {
        // Issued / paid / failed / void invoices are immutable to accrual.
        // Any new exchanges or reversals for that month flow into next
        // month's invoice via the reversal helper's CreditNote path.
        return;
      }

      // Current truth: billed exchanges for this agency in this month.
      const billedTxns = await tx.propertyTransaction.findMany({
        where: {
          agencyId,
          billedAtExchange: { gte: start, lt: end },
        },
        select: {
          id: true,
          propertyAddress: true,
          serviceType: true,
          priceAtExchange: true,
          firstOutsourcedFree: true,
        },
      });
      const billedIds = new Set(billedTxns.map((t) => t.id));

      // Existing fee lines on the building invoice.
      const existingLines = await tx.invoiceLine.findMany({
        where: { invoiceId: invoice.id, kind: { in: ["in_house_fee", "outsourced_fee"] } },
        select: { id: true, transactionId: true },
      });
      const existingByTxId = new Map<string, string>();
      const orphanLineIds: string[] = [];
      for (const line of existingLines) {
        if (line.transactionId && billedIds.has(line.transactionId)) {
          existingByTxId.set(line.transactionId, line.id);
        } else {
          // Line for a transaction that's no longer billed (e.g. reversal
          // under branch (a) cleared billedAtExchange) — remove from the
          // building invoice so the issued total is correct.
          orphanLineIds.push(line.id);
        }
      }
      if (orphanLineIds.length > 0) {
        await tx.invoiceLine.deleteMany({ where: { id: { in: orphanLineIds } } });
        linesRemoved += orphanLineIds.length;
      }

      // Add missing lines for newly-billed transactions.
      for (const t of billedTxns) {
        if (existingByTxId.has(t.id)) continue;
        const fee = computeFee(t.serviceType, t.priceAtExchange, agencyVat, feeOverride);
        // First outsourced file free (D3/D4): the sale bills its band, but the
        // line nets to £0 with a clear "first file free" label. The band value
        // stays recoverable from freeReason + priceAtExchange for reporting.
        const firstFree = t.firstOutsourcedFree;
        await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            transactionId: t.id,
            kind: fee.kind satisfies InvoiceLineKind,
            description: firstFree
              ? `Outsourced — First file free — ${t.propertyAddress}`
              : `${fee.bandLabel} — ${t.propertyAddress}`,
            amountPence: firstFree ? 0 : fee.amountPence,
            vatPence: firstFree ? 0 : fee.vatPence,
            totalPence: firstFree ? 0 : fee.totalPence,
          },
        });
        linesAdded++;
      }

      // Apply any unapplied CreditNotes for this agency to the building
      // invoice. Each becomes a credit_applied line (negative amountPence).
      const unappliedCredits = await tx.creditNote.findMany({
        where: { agencyId, appliedAt: null },
        select: { id: true, amountPence: true, reason: true, transactionId: true },
      });
      for (const credit of unappliedCredits) {
        await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            transactionId: credit.transactionId,
            kind: "credit_applied",
            description: credit.reason,
            amountPence: -credit.amountPence,
            vatPence: 0,
            totalPence: -credit.amountPence,
          },
        });
        await tx.creditNote.update({
          where: { id: credit.id },
          data: { appliedAt: new Date(), appliedToInvoiceId: invoice.id },
        });
        creditsApplied++;
      }
    });
  }

  return {
    monthStart: start,
    agenciesProcessed: agencyIds.length,
    invoicesCreated,
    linesAdded,
    linesRemoved,
    creditsApplied,
  };
}
