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
    select: { freeOnExchange: true, purchasePrice: true },
  });
  if (!txn) return; // defensive — completeMilestone shouldn't fire on a missing row

  const now = new Date();

  // 1. exchangedAt — always, race-safe via NULL guard in WHERE
  await db.propertyTransaction.updateMany({
    where: { id: transactionId, exchangedAt: null },
    data: { exchangedAt: now },
  });

  // 2. Trial files exchange but don't bill
  if (txn.freeOnExchange) return;

  // 3 + 4. Snapshot purchasePrice and stamp billing — race-safe and bilateral-
  // safe via NULL guard. Second call (bilateral partner OR concurrent fire)
  // matches 0 rows and writes nothing.
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
