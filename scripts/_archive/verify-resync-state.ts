import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: "cmpxscgly002rxcezs34ue995" },
    select: {
      purchasePrice: true,
      activeBuyerRound: { select: { purchasePrice: true } },
    },
  });
  console.log("post-resync state:");
  console.log(`  tx.purchasePrice    = ${tx?.purchasePrice}`);
  console.log(`  round.purchasePrice = ${tx?.activeBuyerRound?.purchasePrice}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
