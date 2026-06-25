import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const tx = await p.propertyTransaction.findFirst({
    where: { propertyAddress: { contains: "54 Launcelot Road" } },
    select: {
      id: true, propertyAddress: true, status: true,
      expectedExchangeDate: true, overridePredictedDate: true,
      predictedExchangeDate: true, twelveWeekTarget: true,
      completionDate: true, exchangedAt: true,
      createdAt: true, updatedAt: true,
    },
  });
  console.log("TX:");
  console.log(tx);

  if (!tx) return;

  // Find recent edits to these fields via event log
  const events = await p.commandEventLog.findMany({
    where: { entityType: "PropertyTransaction", entityId: tx.id },
    select: { occurredAt: true, type: true, userId: true, metadata: true },
    orderBy: { occurredAt: "desc" },
    take: 15,
  }).catch(() => []);
  console.log("\nRecent events (latest 15):");
  for (const e of events) {
    console.log(`  ${e.occurredAt.toISOString()}  ${e.type}  user=${e.userId ?? "—"}  ${JSON.stringify(e.metadata).slice(0, 120)}`);
  }
})().catch(console.error).finally(() => p.$disconnect());
