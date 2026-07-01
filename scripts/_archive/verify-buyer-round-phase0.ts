// Verification harness for Phase 0 of the relist feature.
//
// Reports:
//   - Row counts on every table we touched (so pre/post snapshot can be
//     compared — additive sanity check)
//   - BuyerRound count vs PropertyTransaction count
//   - PropertyTransactions with no activeBuyerRoundId
//   - BuyerRound (transactionId, roundNumber) duplicates
//   - PropertyTransaction.activeBuyerRoundId duplicates
//   - Per-table buyerRoundId attribution counts
//   - Spot-check three real files: one active, one withdrawn, one
//     completed — full picture per file

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Phase 0 verification ===\n");

  // ── Row counts on every touched table ────────────────────────────────────
  const tables = [
    "PropertyTransaction",
    "Contact",
    "MilestoneCompletion",
    "OutboundMessage",
    "PortalMessage",
    "TransactionDocument",
    "ReminderLog",
    "ChaseTask",
    "PriceHistory",
    "ClientChaseState",
    "BuyerRound",
  ];
  console.log("Row counts:");
  for (const t of tables) {
    const r = (await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${t}"`,
    ))[0];
    console.log(`  ${t.padEnd(22)} ${r.count}`);
  }

  // ── Round-1 invariants ───────────────────────────────────────────────────
  const txnCount = await prisma.propertyTransaction.count();
  const roundCount = await prisma.buyerRound.count();
  const round1Count = await prisma.buyerRound.count({ where: { roundNumber: 1 } });
  const orphans = await prisma.propertyTransaction.count({
    where: { activeBuyerRoundId: null },
  });

  console.log("\nRound 1 invariants:");
  console.log(`  PropertyTransaction count:          ${txnCount}`);
  console.log(`  BuyerRound count:                   ${roundCount}`);
  console.log(`  BuyerRound (roundNumber=1) count:   ${round1Count}`);
  console.log(`  Tx with NULL activeBuyerRoundId:    ${orphans}`);

  // ── Uniqueness checks ────────────────────────────────────────────────────
  const dupes = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT "transactionId", "roundNumber"
      FROM "BuyerRound"
      GROUP BY "transactionId", "roundNumber"
      HAVING COUNT(*) > 1
    ) AS d
  `);
  const activeDupes = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT "activeBuyerRoundId"
      FROM "PropertyTransaction"
      WHERE "activeBuyerRoundId" IS NOT NULL
      GROUP BY "activeBuyerRoundId"
      HAVING COUNT(*) > 1
    ) AS d
  `);

  console.log("\nUniqueness:");
  console.log(`  (transactionId, roundNumber) dupes: ${dupes[0].count}`);
  console.log(`  activeBuyerRoundId dupes:           ${activeDupes[0].count}`);

  // ── Per-table attribution counts ─────────────────────────────────────────
  const attrTables = [
    "Contact",
    "MilestoneCompletion",
    "OutboundMessage",
    "PortalMessage",
    "TransactionDocument",
    "ReminderLog",
    "ChaseTask",
    "PriceHistory",
    "ClientChaseState",
  ];
  console.log("\nbuyerRoundId attribution:");
  for (const t of attrTables) {
    const stamped = (await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${t}" WHERE "buyerRoundId" IS NOT NULL`,
    ))[0].count;
    const total = (await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${t}"`,
    ))[0].count;
    console.log(`  ${t.padEnd(22)} ${stamped} / ${total}`);
  }

  // ── Spot-check 3 files ───────────────────────────────────────────────────
  const active = await prisma.propertyTransaction.findFirst({
    where: { status: "active" },
    select: { id: true, propertyAddress: true, status: true },
  });
  const withdrawn = await prisma.propertyTransaction.findFirst({
    where: { status: "withdrawn" },
    select: { id: true, propertyAddress: true, status: true },
  });
  const completed = await prisma.propertyTransaction.findFirst({
    where: { status: "completed" },
    select: { id: true, propertyAddress: true, status: true },
  });

  console.log("\nSpot-check (one per status):");
  for (const file of [active, withdrawn, completed]) {
    if (!file) continue;
    await dumpFile(file.id, file.status, file.propertyAddress);
  }
}

async function dumpFile(transactionId: string, status: string, address: string) {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      activeBuyerRoundId: true,
      purchasePrice: true,
      purchaserSolicitorFirmId: true,
      purchaserSolicitorContactId: true,
      brokerFirmId: true,
      brokerContactId: true,
    },
  });
  if (!tx) return;

  const rounds = await prisma.buyerRound.findMany({
    where: { transactionId },
    select: {
      id: true,
      roundNumber: true,
      status: true,
      purchasePrice: true,
      purchaserSolicitorFirmId: true,
      purchaserSolicitorContactId: true,
      brokerFirmId: true,
      brokerContactId: true,
    },
  });

  console.log(`\n  [${status}] ${address}`);
  console.log(`    txn.activeBuyerRoundId:                  ${tx.activeBuyerRoundId}`);
  console.log(`    rounds:                                  ${rounds.length}`);
  for (const r of rounds) {
    console.log(`      Round ${r.roundNumber} (id=${r.id}, status=${r.status})`);
    console.log(`        snapshot.purchasePrice         = ${r.purchasePrice} (tx=${tx.purchasePrice})`);
    console.log(`        snapshot.purchaserSolFirmId    = ${r.purchaserSolicitorFirmId} (tx=${tx.purchaserSolicitorFirmId})`);
    console.log(`        snapshot.purchaserSolContactId = ${r.purchaserSolicitorContactId} (tx=${tx.purchaserSolicitorContactId})`);
    console.log(`        snapshot.brokerFirmId          = ${r.brokerFirmId} (tx=${tx.brokerFirmId})`);
    console.log(`        snapshot.brokerContactId       = ${r.brokerContactId} (tx=${tx.brokerContactId})`);
  }

  // Per-table attribution on this file
  const childCounts: Record<string, { stamped: number; total: number }> = {};
  for (const t of [
    "Contact",
    "MilestoneCompletion",
    "OutboundMessage",
    "PortalMessage",
    "TransactionDocument",
    "ReminderLog",
    "ChaseTask",
    "PriceHistory",
    "ClientChaseState",
  ]) {
    const transactionCol = t === "Contact" ? "propertyTransactionId" : "transactionId";
    const total = (await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${t}" WHERE "${transactionCol}" = $1`,
      transactionId,
    ))[0].count;
    const stamped = (await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM "${t}" WHERE "${transactionCol}" = $1 AND "buyerRoundId" IS NOT NULL`,
      transactionId,
    ))[0].count;
    childCounts[t] = { stamped: Number(stamped), total: Number(total) };
  }
  console.log(`    attribution on this file:`);
  for (const [t, { stamped, total }] of Object.entries(childCounts)) {
    console.log(`      ${t.padEnd(22)} ${stamped} / ${total}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
