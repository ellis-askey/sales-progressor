// One-shot rehearsal helper: pick a staging file, flip it to withdrawn
// with a sentinel reason so the reconciliation script has something to
// reconcile. Idempotent — re-running picks the same file (or skips if
// already withdrawn).

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SENTINEL_REASON = "[staging rehearsal] simulated fall-through for reconcile test";

async function main() {
  // Look for an already-sentineled file (re-run safety).
  const existing = await prisma.propertyTransaction.findFirst({
    where: { fallThroughReason: SENTINEL_REASON },
    select: { id: true, propertyAddress: true, status: true, activeBuyerRoundId: true },
  });
  if (existing) {
    console.log(`Already set up: ${existing.id} (${existing.propertyAddress})`);
    console.log(`  status=${existing.status}  activeBuyerRoundId=${existing.activeBuyerRoundId}`);
    if (existing.status !== "withdrawn") {
      await prisma.propertyTransaction.update({
        where: { id: existing.id },
        data: { status: "withdrawn" },
      });
      console.log(`  re-flipped to withdrawn`);
    }
    return;
  }

  // Find an active draft to victimise — pick one specifically so output is reproducible.
  const tx = await prisma.propertyTransaction.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "asc" },
    select: { id: true, propertyAddress: true, fallThroughReason: true },
  });
  if (!tx) throw new Error("No active transaction on staging to use as victim");

  console.log(`Setting up: ${tx.id} (${tx.propertyAddress})`);
  await prisma.propertyTransaction.update({
    where: { id: tx.id },
    data: { status: "withdrawn", fallThroughReason: SENTINEL_REASON },
  });
  console.log(`  flipped to withdrawn with sentinel reason`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
