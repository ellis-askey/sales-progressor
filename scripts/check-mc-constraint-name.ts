import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const constraints = await prisma.$queryRawUnsafe<{ conname: string; contype: string }[]>(`
    SELECT conname, contype::text FROM pg_constraint
    WHERE conrelid = '"MilestoneCompletion"'::regclass
      AND contype IN ('u', 'p')
  `);
  console.log("Constraints:");
  for (const c of constraints) console.log(`  ${c.contype} ${c.conname}`);
  const indexes = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE tablename = 'MilestoneCompletion'
  `);
  console.log("\nIndexes:");
  for (const i of indexes) console.log(`  ${i.indexname}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
