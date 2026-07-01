// One-shot rehearsal helper: pick an active staging file with a known
// activeBuyerRound, bump the transaction's purchasePrice by £100 so the
// round snapshot is intentionally stale. Idempotent — re-running keeps
// bumping the same file's price (each bump diverges further; the
// resync script catches the divergence either way).

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tx = await prisma.propertyTransaction.findFirst({
    where: { status: "active", purchasePrice: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      propertyAddress: true,
      purchasePrice: true,
      activeBuyerRoundId: true,
      activeBuyerRound: { select: { purchasePrice: true } },
    },
  });
  if (!tx) throw new Error("No active staging file with purchasePrice");

  const bumpedPrice = (tx.purchasePrice ?? 0) + 10_000; // +£100 in pence
  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: { purchasePrice: bumpedPrice },
  });

  console.log(`Tx ${tx.id} (${tx.propertyAddress})`);
  console.log(`  tx.purchasePrice was ${tx.purchasePrice}, now ${bumpedPrice}`);
  console.log(`  round.purchasePrice still ${tx.activeBuyerRound?.purchasePrice} (stale)`);
  console.log(`  resync should rewrite round.purchasePrice → ${bumpedPrice}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
