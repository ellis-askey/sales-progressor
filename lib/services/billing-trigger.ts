// lib/services/billing-trigger.ts
//
// Exchange-time hook for the payments model. Called from completeMilestone
// when a milestone with code VM19 or PM26 is recorded.
//
// VM19 and PM26 are bilateral pairs in completeMilestone's caller layer
// (confirmMilestoneAction wraps both completions in a single $transaction).
// So this helper fires TWICE per exchange: once for the primary (the side the
// user explicitly confirmed) and once for the bilateral partner. The
// idempotency guards below ensure the database state is identical regardless
// of which side fires first or whether the helper is called once or twice.
//
// Behaviour:
//   1. Set exchangedAt = now() if not already set. Fires for trial and paying
//      files alike — this is "did it exchange?" not "did it bill?".
//   2. If freeOnExchange = true → stop. Trial files exchange without billing.
//   3. If billedAtExchange is already set → stop. This is the bilateral
//      re-entry guard: the second completeMilestone call (whichever side it
//      is) sees the first call's write and is a no-op.
//   4. Otherwise: snapshot purchasePrice → priceAtExchange and set
//      billedAtExchange = now(). Billing reads from the snapshot months
//      later, so later edits to purchasePrice never alter what we bill.
//
// Concurrency: both writes use updateMany with a NULL guard in the WHERE
// clause, so even under a race (e.g. two confirmMilestoneAction calls
// firing concurrently) only one UPDATE succeeds. Postgres re-evaluates the
// WHERE clause after row-lock acquisition — the second statement matches 0
// rows and writes nothing.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const EXCHANGE_CODES = new Set(["VM19", "PM26"]);

export async function maybeStampExchange(
  transactionId: string,
  milestoneCode: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (!EXCHANGE_CODES.has(milestoneCode)) return;

  const db = tx ?? prisma;

  const txn = await db.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: { freeOnExchange: true, purchasePrice: true, isDemo: true, serviceType: true, agencyId: true },
  });
  if (!txn) return; // defensive — completeMilestone shouldn't fire on a missing row

  const now = new Date();

  // 1. exchangedAt — always, race-safe via NULL guard in WHERE
  await db.propertyTransaction.updateMany({
    where: { id: transactionId, exchangedAt: null },
    data: { exchangedAt: now },
  });

  // 2a. Demo showcase files never bill (guarding the source here keeps every
  // downstream billing reader safe — a demo never gets billedAtExchange set).
  if (txn.isDemo) return;

  // 2b. Self-progress is free (2026-08 model). A sale the agency runs itself
  // exchanges but is never billed — decided here by service type, so it holds
  // regardless of the frozen freeOnExchange stamp (which pre-dates this model).
  if (txn.serviceType === "self_managed") return;

  // 2. Trial files exchange but don't bill
  if (txn.freeOnExchange) return;

  // 3. First outsourced file free (D3/D4/D5). The agency's FIRST outsourced
  //    file to reach exchange is on us; agencies that have already exchanged an
  //    outsourced file are grandfathered out (D3, new agencies only). Recorded
  //    as a normal bill PLUS a full-value CreditNote (D4) so the invoice shows
  //    "£X · first file free −£X = £0" — visible, not a silent zero. Consumed
  //    once, at exchange, and exchange is final (D5).
  //
  //    Concurrency: the count check is safe at current (pre-launch) scale — two
  //    outsourced files for the SAME agency exchanging in the same instant is
  //    the only race, and cannot happen yet. A DB-level guard (advisory lock on
  //    agencyId, so it never throws inside this shared exchange transaction) is
  //    the hardening before real volume — see the build log's deferred items.
  //
  //    Representation: the file gets billedAtExchange + priceAtExchange + the
  //    firstOutsourcedFree flag stamped. The £0 net and the visible "first file
  //    free" line are rendered from that flag by accrual and the running total
  //    (they zero the band fee for a flagged file), so no CreditNote is needed
  //    and nothing double-counts. The giveaway's value stays recoverable from
  //    freeReason + priceAtExchange for reporting.
  if (txn.serviceType === "outsourced") {
    const priorOutsourcedExchanged = await db.propertyTransaction.count({
      where: {
        agencyId: txn.agencyId,
        id: { not: transactionId },
        serviceType: "outsourced",
        exchangedAt: { not: null },
        isMigrated: false,
      },
    });
    if (priorOutsourcedExchanged === 0) {
      // Bilateral-safe via the NULL guard: the second fire matches 0 rows.
      await db.propertyTransaction.updateMany({
        where: { id: transactionId, billedAtExchange: null },
        data: {
          firstOutsourcedFree: true,
          freeReason: "first_outsourced_free",
          billedAtExchange: now,
          priceAtExchange: txn.purchasePrice,
        },
      });
      return;
    }
  }

  // 4. Bill normally. Snapshot purchasePrice and stamp billing — race-safe and
  // bilateral-safe via NULL guard. Second call (bilateral partner OR concurrent
  // fire) matches 0 rows and writes nothing.
  await db.propertyTransaction.updateMany({
    where: {
      id: transactionId,
      billedAtExchange: null,
      freeOnExchange: false,
    },
    data: {
      billedAtExchange: now,
      priceAtExchange: txn.purchasePrice,
    },
  });
}
