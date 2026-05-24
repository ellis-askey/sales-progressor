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
import type { Prisma, ServiceType } from "@prisma/client";
import { EXCHANGE_CODES } from "@/lib/services/billing-trigger";

// PR 5 will host the proper billing-month boundary helper in lib/billing/period.ts
// with Europe/London tz handling. For PR 4 we use UTC since no invoices exist
// yet (PR 5 is what creates them) — branch (b) only fires once accrual is live.
function monthStartUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// In-house £59 inclusive, outsourced tiered by price (per the locked model).
// Kept local for now; PR 5 will extract this to lib/billing/fee.ts when the
// accrual cron needs the same logic.
function feePence(serviceType: ServiceType, priceAtExchange: number): number {
  if (serviceType === "self_managed") return 5900; // £59 in-house
  const gbp = priceAtExchange / 100;
  if (gbp < 350000) return 25000;  // £250
  if (gbp < 500000) return 30000;  // £300
  return 35000;                    // £350
}

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
  const monthStart = monthStartUtc(txn.billedAtExchange);
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

  const amountPence = feePence(txn.serviceType, txn.priceAtExchange ?? 0);
  const today = new Date().toISOString().slice(0, 10);
  await db.creditNote.create({
    data: {
      agencyId: txn.agencyId,
      transactionId,
      amountPence,
      reason: `Exchange reversed post-invoice — ${milestoneCode} undone on ${today}`,
    },
  });
}
