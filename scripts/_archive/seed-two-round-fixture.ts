// Commit 5 staging fixture — a sentinel two-round file representing a
// post-relist state that doesn't otherwise exist on staging.
//
// Shape:
//   PropertyTransaction (status active, with vendor + new purchaser contacts)
//     ├── BuyerRound 1 (archived/withdrawn, with archivedAt + fallThroughReason)
//     │     └── Old purchaser Contact (buyerRoundId = round1.id, portalToken_old)
//     │     └── PM completions stamped buyerRoundId = round1.id (4 PMs as "complete")
//     │     └── Old PortalMessage (fromClient=true, buyerRoundId = round1.id)
//     ├── BuyerRound 2 (active — pointer activeBuyerRoundId)
//     │     └── New purchaser Contact (buyerRoundId = round2.id, portalToken_new)
//     │     └── PM completions stamped buyerRoundId = round2.id (2 PMs as "available")
//     │     └── New PortalMessage (fromClient=true, buyerRoundId = round2.id)
//     └── Vendor Contact (no buyerRoundId, file-level, portalToken_vendor)
//           └── VM completions (file-level, 5 as "complete")
//           └── File-level OutboundMessage visibleToClient=true (no buyerRoundId)
//
// Three personas exercised by the persona-demo script:
//   - portalToken_old   → should hit the dead-round guard (notice)
//   - portalToken_new   → should see only Round 2's PMs + vendor file-level + own portal msg
//   - portalToken_vendor → should see full VM history + ACTIVE round PM progress + every
//                          visibleToClient comm in the file
//
// Idempotent: tagged with a sentinel address. Re-running deletes the
// previous fixture (cascade) and re-seeds. Run with --tear-down to
// just delete the sentinel.

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const SENTINEL_ADDRESS = "[commit5 two-round fixture]";

async function tearDown() {
  const existing = await prisma.propertyTransaction.findMany({
    where: { propertyAddress: SENTINEL_ADDRESS },
    select: { id: true },
  });
  if (existing.length === 0) {
    console.log("No existing fixture to tear down.");
    return;
  }
  for (const tx of existing) {
    await prisma.propertyTransaction.delete({ where: { id: tx.id } });
    console.log(`Deleted fixture tx ${tx.id}`);
  }
}

async function main() {
  if (process.argv.includes("--tear-down")) {
    await tearDown();
    return;
  }

  await tearDown();

  const agency = await prisma.agency.findFirst({ select: { id: true } });
  if (!agency) throw new Error("no agency on staging");

  // Milestone defs we'll stamp on.
  const defs = await prisma.milestoneDefinition.findMany({
    select: { id: true, code: true, side: true },
  });
  const defByCode = new Map(defs.map((d) => [d.code, d]));
  const vmCodes = ["VM1", "VM2", "VM3", "VM4", "VM5"];
  const round1PmCodes = ["PM1", "PM2", "PM3", "PM4"]; // completed on archived round
  const round2PmCodes = ["PM1", "PM2"]; // partial on new round (intentionally diff)

  const tokenOld = randomUUID();
  const tokenNew = randomUUID();
  const tokenVendor = randomUUID();

  // Step 1 — create the file + both rounds + pointer.
  const tx = await prisma.$transaction(async (ptx) => {
    const created = await ptx.propertyTransaction.create({
      data: {
        propertyAddress: SENTINEL_ADDRESS,
        agencyId: agency.id,
        status: "active",
        tenure: "freehold",
        purchaseType: "mortgage",
        purchasePrice: 47500000, // £475k current
        progressedBy: "agent",
        serviceType: "self_managed",
        twelveWeekTarget: new Date(Date.now() + 84 * 86400_000),
        fallThroughReason: null,
      },
    });
    const round1 = await ptx.buyerRound.create({
      data: {
        transactionId: created.id,
        roundNumber: 1,
        status: "withdrawn",
        archivedAt: new Date(Date.now() - 7 * 86400_000),
        fallThroughReason: "[fixture] previous buyer pulled out",
        purchasePrice: 45000000, // £450k — the previous offer
        purchaserSolicitorFirmId: null,
        purchaserSolicitorContactId: null,
      },
    });
    const round2 = await ptx.buyerRound.create({
      data: {
        transactionId: created.id,
        roundNumber: 2,
        status: "active",
        purchasePrice: created.purchasePrice,
        purchaserSolicitorFirmId: created.purchaserSolicitorFirmId,
        purchaserSolicitorContactId: created.purchaserSolicitorContactId,
      },
    });
    const updated = await ptx.propertyTransaction.update({
      where: { id: created.id },
      data: { activeBuyerRoundId: round2.id },
    });
    return { tx: updated, round1Id: round1.id, round2Id: round2.id };
  });

  // Step 2 — contacts.
  await prisma.contact.createMany({
    data: [
      {
        propertyTransactionId: tx.tx.id,
        name: "[fixture] Round 1 buyer (Alice Old)",
        email: "old.buyer@fixture.invalid",
        roleType: "purchaser",
        portalToken: tokenOld,
        buyerRoundId: tx.round1Id,
      },
      {
        propertyTransactionId: tx.tx.id,
        name: "[fixture] Round 2 buyer (Bob New)",
        email: "new.buyer@fixture.invalid",
        roleType: "purchaser",
        portalToken: tokenNew,
        buyerRoundId: tx.round2Id,
      },
      {
        propertyTransactionId: tx.tx.id,
        name: "[fixture] Vendor (Carla)",
        email: "vendor@fixture.invalid",
        roleType: "vendor",
        portalToken: tokenVendor,
        buyerRoundId: null,
      },
    ],
  });

  // Step 3 — milestone completions.
  // Vendor side: 5 complete VMs, file-level.
  for (let i = 0; i < vmCodes.length; i++) {
    const def = defByCode.get(vmCodes[i]!);
    if (!def) continue;
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: tx.tx.id,
        milestoneDefinitionId: def.id,
        state: "complete",
        completedAt: new Date(Date.now() - (30 - i) * 86400_000),
        buyerRoundId: null,
      },
    });
  }
  // Round 1: 4 complete PMs, archived round.
  for (let i = 0; i < round1PmCodes.length; i++) {
    const def = defByCode.get(round1PmCodes[i]!);
    if (!def) continue;
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: tx.tx.id,
        milestoneDefinitionId: def.id,
        state: "complete",
        completedAt: new Date(Date.now() - (25 - i) * 86400_000),
        buyerRoundId: tx.round1Id,
      },
    });
  }
  // Round 2: 2 PMs available (= round just started).
  for (let i = 0; i < round2PmCodes.length; i++) {
    const def = defByCode.get(round2PmCodes[i]!);
    if (!def) continue;
    await prisma.milestoneCompletion.create({
      data: {
        transactionId: tx.tx.id,
        milestoneDefinitionId: def.id,
        state: "available",
        buyerRoundId: tx.round2Id,
      },
    });
  }

  // Step 4 — portal messages exemplifying buyer-side comms per round.
  const oldContact = await prisma.contact.findFirst({
    where: { propertyTransactionId: tx.tx.id, portalToken: tokenOld },
    select: { id: true },
  });
  const newContact = await prisma.contact.findFirst({
    where: { propertyTransactionId: tx.tx.id, portalToken: tokenNew },
    select: { id: true },
  });
  if (oldContact) {
    await prisma.portalMessage.create({
      data: {
        transactionId: tx.tx.id,
        contactId: oldContact.id,
        content: "[fixture R1] Old buyer asked about searches",
        fromClient: true,
        buyerRoundId: tx.round1Id,
      },
    });
  }
  if (newContact) {
    await prisma.portalMessage.create({
      data: {
        transactionId: tx.tx.id,
        contactId: newContact.id,
        content: "[fixture R2] New buyer just submitted ID docs",
        fromClient: true,
        buyerRoundId: tx.round2Id,
      },
    });
  }

  // Step 5 — file-level visibleToClient OutboundMessage so the vendor
  // surface has something to read.
  await prisma.outboundMessage.create({
    data: {
      transactionId: tx.tx.id,
      type: "internal_note",
      contactIds: [],
      content: "[fixture file-level] Update: a new buyer has been found",
      visibleToClient: true,
      buyerRoundId: null,
    },
  });

  console.log("\nFixture seeded:");
  console.log(`  transactionId:       ${tx.tx.id}`);
  console.log(`  round1Id (archived): ${tx.round1Id}`);
  console.log(`  round2Id (active):   ${tx.round2Id}`);
  console.log(`  activeBuyerRoundId:  ${tx.tx.activeBuyerRoundId}`);
  console.log(`  portalToken_old:     ${tokenOld}`);
  console.log(`  portalToken_new:     ${tokenNew}`);
  console.log(`  portalToken_vendor:  ${tokenVendor}`);
  console.log(`\nTo tear down: --tear-down`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
