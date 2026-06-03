// Pre-migration sanity gate: would the two partial unique indexes apply
// cleanly on the current data? Both indexes must find zero duplicates.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const vendorDupes = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count FROM (
      SELECT "transactionId", "milestoneDefinitionId", COUNT(*)
      FROM "MilestoneCompletion"
      WHERE "buyerRoundId" IS NULL
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) d
  `);
  const purchaserDupes = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count FROM (
      SELECT "buyerRoundId", "milestoneDefinitionId", COUNT(*)
      FROM "MilestoneCompletion"
      WHERE "buyerRoundId" IS NOT NULL
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
    ) d
  `);
  console.log(`Vendor (buyerRoundId IS NULL) duplicate (tx,def) pairs:    ${vendorDupes[0].count}`);
  console.log(`Purchaser (buyerRoundId IS NOT NULL) duplicate pairs:      ${purchaserDupes[0].count}`);
  if (vendorDupes[0].count > 0n || purchaserDupes[0].count > 0n) {
    console.log("\nMIGRATION WOULD FAIL. Investigate duplicates before proceeding.");
    process.exit(1);
  }
  console.log("\nMigration safe to apply.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
