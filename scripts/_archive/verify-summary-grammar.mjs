import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.milestoneDefinition.findMany({
  where: { code: { in: ["VM4", "PM27", "PM26"] } },
  select: { code: true, summaryTemplate: true },
});
for (const r of rows.sort((a, b) => a.code.localeCompare(b.code))) {
  console.log(r.code + ": " + r.summaryTemplate);
}
await p.$disconnect();
