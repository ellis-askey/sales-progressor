// Reset 14 Hartwell Lane on staging into the canonical item-8 test state:
//   status: on_hold
//   one open TransactionHoldPeriod with plannedEndAt = 3 days ago
//
// Closes any stale periods, deletes any open ones, then creates a fresh
// expired hold. Idempotent.

import { prisma } from "../lib/prisma";

const TX_ID = "cmph4mgj0000311kwesb58fmy"; // 14 Hartwell Lane
const ELLIS_ID = "cmpehuy9d000b2ebfl0psqlve";

async function main() {
  console.log(`\n=== Reset item 8 state on staging ===`);

  // Clear all hold periods for this file (clean slate).
  const deleted = await prisma.transactionHoldPeriod.deleteMany({
    where: { transactionId: TX_ID },
  });
  console.log(`Deleted ${deleted.count} existing period(s).`);

  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  threeDaysAgo.setHours(9, 0, 0, 0);
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000);

  await prisma.$transaction([
    prisma.propertyTransaction.update({
      where: { id: TX_ID },
      data: { status: "on_hold" },
    }),
    prisma.transactionHoldPeriod.create({
      data: {
        transactionId: TX_ID,
        startedAt: tenDaysAgo,
        startedById: ELLIS_ID,
        plannedEndAt: threeDaysAgo,
      },
    }),
  ]);

  console.log(`✓ ${TX_ID} is now on_hold with plannedEndAt 3 days ago.`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error("FAILED:", err); process.exit(1); });
