// lib/billing/running-total.ts
//
// The director-facing /agent/billing page reads from HERE, not from Invoice/
// InvoiceLine rows. The locked model says: "watch it build" must feel
// instant regardless of cron cadence. So the page query goes direct to the
// source of truth — PropertyTransaction rows with billedAtExchange in the
// current London billing month — and aggregates lines on the fly using the
// shared computeFee helper.
//
// The accrual cron (lib/billing/accrual.ts) writes durable InvoiceLine
// rows for billing history and Stripe issuance. Both reads come from the
// same underlying truth (the row's billedAtExchange + priceAtExchange +
// serviceType), so the page total and the issued invoice always agree.
// The cron is just a periodic aggregator for billing-history purposes.

import { prisma } from "@/lib/prisma";
import { billingMonthRange } from "@/lib/billing/period";
import { computeFee, type FeeKind } from "@/lib/billing/fee";

export type RunningTotalLine = {
  transactionId: string;
  propertyAddress: string;
  exchangedAt: Date;
  kind: FeeKind;
  bandLabel: string;
  /** Snapshot taken at exchange — immune to later edits of purchasePrice. */
  priceAtExchangePence: number | null;
  /** Ex-VAT when agency is VAT-registered; inclusive otherwise. */
  amountPence: number;
  vatPence: number;
  totalPence: number;
};

export type RunningTotal = {
  /** UTC instants for the London billing month boundary [start, end). */
  monthStart: Date;
  monthEnd: Date;
  lines: RunningTotalLine[];
  /** Sum of line.totalPence — the gross amount to charge. */
  totalPence: number;
  /** Sum of line.amountPence (ex-VAT when registered; equals totalPence otherwise). */
  subtotalPence: number;
  /** Sum of line.vatPence. Zero when not VAT-registered. */
  vatPence: number;
  inHouseCount: number;
  outsourcedCount: number;
  /** True iff agency is currently VAT-registered (drives UI breakdown). */
  vatActive: boolean;
};

export async function getCurrentMonthRunningTotal(agencyId: string, now: Date = new Date()): Promise<RunningTotal> {
  const { start, end } = billingMonthRange(now);

  // Pull the agency's VAT state once — applies to all this agency's lines.
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { vatRegisteredAt: true, vatRateBps: true },
  });
  const vat = agency ?? null;
  const vatActive = agency !== null && agency.vatRegisteredAt !== null && agency.vatRateBps !== null && agency.vatRateBps > 0;

  // Source of truth: PropertyTransaction rows that have a billing stamp in
  // this month. Trial-file exchanges leave billedAtExchange null and so
  // never appear here — they aren't "value given away" for billing
  // purposes either, they're just not billable.
  const rows = await prisma.propertyTransaction.findMany({
    where: {
      agencyId,
      billedAtExchange: { gte: start, lt: end },
    },
    select: {
      id: true,
      propertyAddress: true,
      serviceType: true,
      priceAtExchange: true,
      billedAtExchange: true,
    },
    orderBy: { billedAtExchange: "asc" },
  });

  let totalPence = 0;
  let subtotalPence = 0;
  let vatPence = 0;
  let inHouseCount = 0;
  let outsourcedCount = 0;
  const lines: RunningTotalLine[] = [];

  for (const r of rows) {
    const fee = computeFee(r.serviceType, r.priceAtExchange, vat);
    totalPence += fee.totalPence;
    subtotalPence += fee.amountPence;
    vatPence += fee.vatPence;
    if (fee.kind === "in_house_fee") inHouseCount++;
    else outsourcedCount++;
    lines.push({
      transactionId: r.id,
      propertyAddress: r.propertyAddress,
      exchangedAt: r.billedAtExchange!, // non-null per WHERE clause
      kind: fee.kind,
      bandLabel: fee.bandLabel,
      priceAtExchangePence: r.priceAtExchange,
      amountPence: fee.amountPence,
      vatPence: fee.vatPence,
      totalPence: fee.totalPence,
    });
  }

  return { monthStart: start, monthEnd: end, lines, totalPence, subtotalPence, vatPence, inHouseCount, outsourcedCount, vatActive };
}
