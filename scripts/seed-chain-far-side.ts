// Seed a walkable "chain far-side" demo on the FIRST non-internal agency.
//
// Creates a demo file in the middle of a 3-link chain (onward stub above,
// related stub below) and populates all FOUR trackers so the near/far toggle and
// both far sides show real reported steps:
//   onward_purchase        (near) — our seller buying, PM1-PM3
//   onward_purchase_seller (far)  — the onward seller, VM1-VM2
//   related_sale           (near) — our buyer selling, VM1-VM3
//   related_sale_buyer     (far)  — the related buyer, PM1
//
// Run:  npx tsx scripts/seed-chain-far-side.ts
// Idempotent-ish: re-running reuses the demo file + chain; step confirms that
// already exist are skipped by the service. Deletion: remove the demo file
// "12 Chain Demo Road" from the agency, or drop its trackers. See SCRIPTS_REGISTRY.
//
// NOTE: authored but NOT run locally (the dev box's Prisma client is engine=none
// while a dev server holds the engine). Run it in an env with a full client.

import { prisma } from "@/lib/prisma";
import { setOnwardTypeFacts, confirmOnwardStep } from "@/lib/services/onward";
import type { OnwardTrackerKind } from "@prisma/client";

const DEMO_ADDR = "12 Chain Demo Road, Tring, HP23 0AA";

async function confirmMany(txId: string, codes: string[], userId: string, kind: OnwardTrackerKind) {
  for (const code of codes) {
    const res = await confirmOnwardStep(txId, code, null, { source: "agent", userId }, kind);
    if (res.ok === false) console.warn(`  · ${kind} ${code}: skipped (${res.reason})`);
    else console.log(`  · ${kind} ${code}: reported`);
  }
}

async function main() {
  const agency = await prisma.agency.findFirst({ where: { isInternal: false }, orderBy: { createdAt: "asc" } });
  if (!agency) throw new Error("No non-internal agency found — seed a customer agency first.");
  const user = await prisma.user.findFirst({
    where: { agencyId: agency.id, role: { in: ["director", "negotiator"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!user) throw new Error(`No director/negotiator in agency ${agency.name}.`);
  console.log(`Agency: ${agency.name} · agent: ${user.name}`);

  // Demo file (middle of the chain).
  let tx = await prisma.propertyTransaction.findFirst({
    where: { agencyId: agency.id, propertyAddress: DEMO_ADDR },
    select: { id: true, chainLinkId: true },
  });
  if (!tx) {
    const created = await prisma.propertyTransaction.create({
      data: {
        agencyId: agency.id,
        propertyAddress: DEMO_ADDR,
        status: "active",
        tenure: "freehold",
        purchaseType: "mortgage",
        isShareOfFreehold: false,
        agentUserId: user.id,
      },
      select: { id: true, chainLinkId: true },
    });
    tx = created;
    console.log("Created demo file.");
  } else {
    console.log("Reusing existing demo file.");
  }

  // Chain: onward stub (pos 0) → demo file (pos 1) → related stub (pos 2).
  if (!tx.chainLinkId) {
    const chain = await prisma.propertyChain.create({
      data: { agencyId: agency.id, createdByUserId: user.id },
      select: { id: true },
    });
    const mid = await prisma.chainLink.create({
      data: { chainId: chain.id, position: 1, transactionId: tx.id, createdByUserId: user.id },
      select: { id: true },
    });
    await prisma.chainLink.create({
      data: { chainId: chain.id, position: 0, createdByUserId: user.id, stubPropertyAddress: "2 Evans Way, Tring, HP23 5UJ", stubAgentName: "Onward Agent" },
    });
    await prisma.chainLink.create({
      data: { chainId: chain.id, position: 2, createdByUserId: user.id, stubPropertyAddress: "8 Brambling Crescent, Hemel Hempstead, HP2 7GX", stubAgentName: "Related Agent" },
    });
    await prisma.propertyTransaction.update({ where: { id: tx.id }, data: { chainLinkId: mid.id } });
    console.log("Created 3-link chain.");
  } else {
    console.log("Reusing existing chain.");
  }

  // Trackers — near + far, with type facts, then a few reported steps in order.
  console.log("Onward purchase (near, our seller buying):");
  await setOnwardTypeFacts(tx.id, { tenure: "freehold", purchaseType: "mortgage", isShareOfFreehold: false }, "onward_purchase");
  await confirmMany(tx.id, ["PM1", "PM2", "PM3"], user.id, "onward_purchase");

  console.log("Onward · seller's side (far):");
  await setOnwardTypeFacts(tx.id, { tenure: "freehold", isShareOfFreehold: false }, "onward_purchase_seller");
  await confirmMany(tx.id, ["VM1", "VM2"], user.id, "onward_purchase_seller");

  console.log("Related sale (near, our buyer selling):");
  await setOnwardTypeFacts(tx.id, { tenure: "leasehold", isShareOfFreehold: false }, "related_sale");
  await confirmMany(tx.id, ["VM1", "VM2", "VM3"], user.id, "related_sale");

  console.log("Related · buyer's side (far):");
  await setOnwardTypeFacts(tx.id, { tenure: "leasehold", purchaseType: "mortgage", isShareOfFreehold: false }, "related_sale_buyer");
  await confirmMany(tx.id, ["PM1"], user.id, "related_sale_buyer");

  console.log("\nDone. Open the file (Overview → Property chain):");
  console.log(`  http://localhost:3001/agent/transactions/${tx.id}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
