import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const defs = await p.milestoneDefinition.findMany({
    select: { code: true, name: true, side: true, orderIndex: true },
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
  });
  console.log("Total:", defs.length);
  for (const d of defs) console.log(`  ${d.code.padEnd(5)} (${d.side.padEnd(10)}) order=${String(d.orderIndex).padStart(2)}  ${d.name}`);
})().catch(console.error).finally(() => p.$disconnect());
