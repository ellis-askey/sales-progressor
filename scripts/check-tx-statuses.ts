// One-shot: pick noisiest file (most stamped children) and dump it.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ id: string; address: string; status: string; total: bigint }[]>(
    `
    SELECT t.id, t."propertyAddress" AS address, t.status::text,
      (
        (SELECT COUNT(*) FROM "Contact" WHERE "propertyTransactionId" = t.id AND "buyerRoundId" IS NOT NULL)
        + (SELECT COUNT(*) FROM "MilestoneCompletion" WHERE "transactionId" = t.id AND "buyerRoundId" IS NOT NULL)
        + (SELECT COUNT(*) FROM "OutboundMessage" WHERE "transactionId" = t.id AND "buyerRoundId" IS NOT NULL)
        + (SELECT COUNT(*) FROM "ReminderLog" WHERE "transactionId" = t.id AND "buyerRoundId" IS NOT NULL)
        + (SELECT COUNT(*) FROM "ChaseTask" WHERE "transactionId" = t.id AND "buyerRoundId" IS NOT NULL)
        + (SELECT COUNT(*) FROM "ClientChaseState" WHERE "transactionId" = t.id AND "buyerRoundId" IS NOT NULL)
      )::bigint AS total
    FROM "PropertyTransaction" t
    ORDER BY total DESC
    LIMIT 5
    `,
  );
  console.log("Top 5 files by total stamped child rows:");
  for (const r of rows) {
    console.log(`  ${r.status.padEnd(10)} ${String(r.total).padStart(5)}  ${r.id}  ${r.address}`);
  }

  // Also a draft sample (for the "draft = nulls everywhere" sanity check)
  const drafts = await prisma.propertyTransaction.findMany({
    where: { status: "draft" },
    select: {
      id: true,
      propertyAddress: true,
      purchasePrice: true,
      activeBuyerRoundId: true,
    },
    take: 3,
  });
  console.log("\nDraft files (should all have Round 1, snapshot may be null):");
  for (const d of drafts) {
    const round = await prisma.buyerRound.findFirst({
      where: { transactionId: d.id, roundNumber: 1 },
      select: { id: true, status: true, purchasePrice: true },
    });
    console.log(`  ${d.id}  ${d.propertyAddress}`);
    console.log(`    activeBuyerRoundId = ${d.activeBuyerRoundId}`);
    console.log(`    round.id           = ${round?.id}`);
    console.log(`    round.status       = ${round?.status}`);
    console.log(`    round.purchasePrice= ${round?.purchasePrice}  (tx=${d.purchasePrice})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
