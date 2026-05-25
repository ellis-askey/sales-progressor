// lib/services/billing-reversal.ts
//
// Mirror of billing-trigger.ts for the reverse direction. Called from
// executeUndoMilestone when a VM19 or PM26 reversal commits.
//
// executeUndoMilestone reverses the target milestone AND its bilateral partner
// (VM19↔PM26) atomically in one $transaction. So this helper fires TWICE per
// reversal — the same bilateral trap as the forward stamp. Both branches
// below are idempotent via either NULL guards or an existing-credit lookup.
//
// Two branches:
//   (a) The transaction's billing month has no issued invoice yet (cron
//       hasn't run OR invoice is still "building"). Clear billedAtExchange
//       and priceAtExchange — the reversal drops the file off the building
//       invoice cleanly. Bilateral partner call sees billedAtExchange
//       already null (NULL-guarded updateMany) and no-ops.
//   (b) The billing month's invoice has already been issued (status !=
//       "building"). Leave billing fields intact (history), and write a
//       CreditNote against the agency for the same fee that was charged,
//       to be applied to next month's invoice. Bilateral partner call sees
//       the existing unapplied CreditNote and skips — no double-credit.
//
// exchangedAt is always cleared (mirror of forward path's "always set"),
// idempotent via NULL guard.
//
// Concurrency note: the bilateral-pair case is serialised because both
// reversal calls happen inside executeUndoMilestone's single $transaction
// and in-tx reads see prior writes. The pathological case of two CONCURRENT
// executeUndoMilestone calls on the same transaction (two agents undoing
// the same milestone simultaneously) is not defended — vanishingly rare.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { EXCHANGE_CODES } from "@/lib/services/billing-trigger";
import { billingMonthStart } from "@/lib/billing/period";
import { computeFee } from "@/lib/billing/fee";

export async function handleExchangeReversal(
  transactionId: string,
  milestoneCode: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!EXCHANGE_CODES.has(milestoneCode)) return;

  const db = tx ?? prisma;

  const txn = await db.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      agencyId: true,
      serviceType: true,
      exchangedAt: true,
      billedAtExchange: true,
      priceAtExchange: true,
      agency: { select: { vatRegisteredAt: true, vatRateBps: true } },
    },
  });
  if (!txn) return;

  // 1. exchangedAt — always cleared, idempotent via NULL guard
  if (txn.exchangedAt !== null) {
    await db.propertyTransaction.updateMany({
      where: { id: transactionId, exchangedAt: { not: null } },
      data: { exchangedAt: null },
    });
  }

  // 2. If never billed (trial file or never reached billing), nothing more.
  if (txn.billedAtExchange === null) return;

  // 3. Decide branch (a) vs (b) based on invoice issuance state.
  const monthStart = billingMonthStart(txn.billedAtExchange);
  const invoice = await db.invoice.findUnique({
    where: { agencyId_monthStart: { agencyId: txn.agencyId, monthStart } },
    select: { status: true },
  });
  const invoiceIssued = invoice !== null && invoice.status !== "building";

  if (!invoiceIssued) {
    // BRANCH (a): Clear billing fields → drops off the building invoice.
    // NULL guard makes the bilateral partner call a no-op.
    await db.propertyTransaction.updateMany({
      where: { id: transactionId, billedAtExchange: { not: null } },
      data: { billedAtExchange: null, priceAtExchange: null },
    });
    return;
  }

  // BRANCH (b): Invoice already issued. Keep billing fields intact (history),
  // write CreditNote for next month. Bilateral guard: skip if a CreditNote
  // already exists for this transaction that hasn't been applied yet.
  const existingCredit = await db.creditNote.findFirst({
    where: { transactionId, appliedAt: null },
    select: { id: true },
  });
  if (existingCredit) return;

  // CreditNote amount uses the GROSS fee (what was actually charged), not
  // the ex-VAT split. The credit nets out the full Stripe charge on next
  // month's invoice; the VAT side of the credit follows automatically when
  // accrual writes the credit_applied line back through computeFee against
  // the agency's VAT state at that future moment.
  const fee = computeFee(txn.serviceType, txn.priceAtExchange, txn.agency ?? null);
  const today = new Date().toISOString().slice(0, 10);
  await db.creditNote.create({
    data: {
      agencyId: txn.agencyId,
      transactionId,
      amountPence: fee.totalPence,
      reason: `Exchange reversed post-invoice — ${milestoneCode} undone on ${today}`,
    },
  });
}
