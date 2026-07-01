// One-shot: read the post-reconcile state of the rehearsal tx.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const SENTINEL = "[staging rehearsal] simulated fall-through for reconcile test";
async function main() {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { fallThroughReason: SENTINEL },
    select: {
      id: true, propertyAddress: true, status: true,
      activeBuyerRoundId: true, fallThroughReason: true,
      activeBuyerRound: {
        select: { id: true, status: true, archivedAt: true, fallThroughReason: true, roundNumber: true },
      },
    },
  });
  if (!tx) {
    console.log("(rehearsal tx not found)");
    return;
  }
  console.log(`Tx ${tx.id}`);
  console.log(`  status                   = ${tx.status}`);
  console.log(`  fallThroughReason        = ${tx.fallThroughReason}`);
  console.log(`  activeBuyerRoundId       = ${tx.activeBuyerRoundId}`);
  console.log(`  round.id                 = ${tx.activeBuyerRound?.id}`);
  console.log(`  round.roundNumber        = ${tx.activeBuyerRound?.roundNumber}`);
  console.log(`  round.status             = ${tx.activeBuyerRound?.status}`);
  console.log(`  round.archivedAt         = ${tx.activeBuyerRound?.archivedAt?.toISOString()}`);
  console.log(`  round.fallThroughReason  = ${tx.activeBuyerRound?.fallThroughReason}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
