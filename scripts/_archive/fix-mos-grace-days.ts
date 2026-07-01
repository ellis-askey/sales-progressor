import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.reminderRule.updateMany({
    where: { targetMilestoneCode: { in: ["VM2", "PM2"] } },
    data: { graceDays: 0 },
  });
  console.log(`Updated ${result.count} reminder rules (VM2 + PM2 → graceDays: 0)`);

  // Verify
  const rules = await prisma.reminderRule.findMany({
    where: { targetMilestoneCode: { in: ["VM2", "PM2"] } },
    select: { name: true, targetMilestoneCode: true, graceDays: true },
  });
  for (const r of rules) {
    console.log(`  ${r.targetMilestoneCode}: "${r.name}" — graceDays = ${r.graceDays}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
