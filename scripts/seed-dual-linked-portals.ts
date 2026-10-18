// One-off LOCAL seed (staging DB): client portals demonstrating the dual-linked
// confirmation phrasing (#278/#279 honest-mirror fix). One transaction per
// scenario; each gives a SELLER portal and a BUYER portal so both sides can be
// opened. NOT committed (mirrors scripts/seed-emily-completions.ts). Idempotent:
// deletes its own prior rows (address marker) before re-creating.
//
// Run (tsconfig.seed.json stubs out `server-only`):
//   TS_NODE_PROJECT=tsconfig.seed.json npx dotenv -e .env --override -- \
//     ts-node --transpile-only -r tsconfig-paths/register scripts/seed-dual-linked-portals.ts

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const MARKER = "· Dual-Link Demo";

type Conf = "agent" | "client" | "solicitor";
type Scenario = {
  key: string;
  address: string;
  primaryCode: string;   // the side actually confirmed
  mirrorCode: string;    // the side that auto-closes
  primarySide: "vendor" | "purchaser";
  conf: Conf;
  blurb: string;         // what the reader should see
};

const SCENARIOS: Scenario[] = [
  // ── Contract pack (VM7 issued ↔ PM7 received) — asymmetric, restated ──────────
  { key: "cp-agent",    address: "1 Issued Agent Way",     primaryCode: "VM7", mirrorCode: "PM7", primarySide: "vendor",    conf: "agent",     blurb: "Agent confirms the pack ISSUED (seller side)" },
  { key: "cp-seller",   address: "2 Issued Seller Way",    primaryCode: "VM7", mirrorCode: "PM7", primarySide: "vendor",    conf: "client",    blurb: "Seller confirms the pack ISSUED via their portal" },
  { key: "cp-sellsol",  address: "3 Issued Solicitor Way", primaryCode: "VM7", mirrorCode: "PM7", primarySide: "vendor",    conf: "solicitor", blurb: "Seller's solicitor confirms the pack ISSUED" },
  { key: "cp-buyer",    address: "4 Received Buyer Way",   primaryCode: "PM7", mirrorCode: "VM7", primarySide: "purchaser", conf: "client",    blurb: "Buyer confirms the pack RECEIVED via their portal" },
  { key: "cp-buysol",   address: "5 Received Solicitor Way", primaryCode: "PM7", mirrorCode: "VM7", primarySide: "purchaser", conf: "solicitor", blurb: "Buyer's solicitor confirms the pack RECEIVED" },
  // ── Enquiries raised (PM14 raised ↔ VM10 received) — asymmetric, restated ─────
  { key: "er-agent",    address: "6 Enquiries Agent Way",  primaryCode: "PM14", mirrorCode: "VM10", primarySide: "purchaser", conf: "agent",     blurb: "Agent confirms enquiries RAISED (buyer side)" },
  { key: "er-buysol",   address: "7 Enquiries Solicitor Way", primaryCode: "PM14", mirrorCode: "VM10", primarySide: "purchaser", conf: "solicitor", blurb: "Buyer's solicitor confirms enquiries RAISED" },
  { key: "er-buyer",    address: "8 Enquiries Buyer Way",  primaryCode: "PM14", mirrorCode: "VM10", primarySide: "purchaser", conf: "client",    blurb: "Buyer confirms enquiries RAISED via their portal" },
  // ── Completion (VM20 ↔ PM27) — simultaneous, NOT restated (contrast) ──────────
  { key: "sim-complete", address: "9 Simultaneous Way",    primaryCode: "VM20", mirrorCode: "PM27", primarySide: "vendor",    conf: "agent",     blurb: "Completion — simultaneous, each side keeps its own word" },
];

function at(mins: number): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "emily@hartwellpartners.co.uk" }, select: { id: true, name: true, agencyId: true } });
  if (!user?.agencyId) throw new Error("emily@hartwellpartners.co.uk not found or has no agency");
  const ownerUserId = user.id;
  const agencyId = user.agencyId;
  console.log(`Owner/overseer: ${user.name ?? "(no name)"} — this name appears on the auto-closed mirror lines.\n`);

  // Demo solicitor firms (isDemo so they never leak into real pickers).
  const vendorFirm = await prisma.solicitorFirm.upsert({
    where: { name: `Haworth & Gale ${MARKER}` }, update: {}, create: { name: `Haworth & Gale ${MARKER}`, isDemo: true },
  });
  const purchaserFirm = await prisma.solicitorFirm.upsert({
    where: { name: `Pennington Legal ${MARKER}` }, update: {}, create: { name: `Pennington Legal ${MARKER}`, isDemo: true },
  });

  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const defIdByCode = new Map(defs.map((d) => [d.code, d.id] as const));

  // ── Clean up any previous run ────────────────────────────────────────────────
  const prior = await prisma.propertyTransaction.findMany({ where: { agencyId, propertyAddress: { contains: MARKER } }, select: { id: true } });
  const priorIds = prior.map((p) => p.id);
  if (priorIds.length) {
    await prisma.propertyTransaction.updateMany({ where: { id: { in: priorIds } }, data: { activeBuyerRoundId: null } });
    await prisma.reminderLog.deleteMany({ where: { transactionId: { in: priorIds } } }).catch(() => {});
    await prisma.milestoneCompletion.deleteMany({ where: { transactionId: { in: priorIds } } });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: { in: priorIds } } });
    await prisma.buyerRound.deleteMany({ where: { transactionId: { in: priorIds } } });
    await prisma.propertyTransaction.deleteMany({ where: { id: { in: priorIds } } });
    console.log(`cleaned ${priorIds.length} prior seeded file(s)\n`);
  }

  const { initializeMilestoneCompletions } = await import("../lib/services/milestones");

  const links: { blurb: string; seller: string; buyer: string }[] = [];

  for (const s of SCENARIOS) {
    const address = `${s.address} ${MARKER}`;
    const tx = await prisma.$transaction(async (ptx) => {
      const created = await ptx.propertyTransaction.create({
        data: {
          propertyAddress: address, agencyId, assignedUserId: ownerUserId, agentUserId: ownerUserId,
          progressedBy: "agent", serviceType: "self_managed", status: "active",
          tenure: "freehold", purchaseType: "mortgage", purchasePrice: 45_000000,
          agentFeeAmount: 400000, agentFeeIsVatInclusive: false, freeOnExchange: false,
          vendorSolicitorFirmId: vendorFirm.id, purchaserSolicitorFirmId: purchaserFirm.id,
          createdAt: at(-60), lastActivityAt: at(0),
        },
      });
      const round = await ptx.buyerRound.create({
        data: { transactionId: created.id, roundNumber: 1, status: "active", purchasePrice: created.purchasePrice },
      });
      return ptx.propertyTransaction.update({ where: { id: created.id }, data: { activeBuyerRoundId: round.id } });
    });

    const vendor = await prisma.contact.create({ data: { propertyTransactionId: tx.id, name: "Emma Poulter", email: `v-${randomUUID().slice(0, 8)}@dual-demo.test`, phone: "07700 900100", roleType: "vendor", portalToken: randomUUID(), buyerRoundId: null } });
    const purchaser = await prisma.contact.create({ data: { propertyTransactionId: tx.id, name: "David Whitfield", email: `p-${randomUUID().slice(0, 8)}@dual-demo.test`, phone: "07700 900200", roleType: "purchaser", portalToken: randomUUID(), buyerRoundId: tx.activeBuyerRoundId } });

    await initializeMilestoneCompletions(tx.id, "freehold", "mortgage", ownerUserId, tx.activeBuyerRoundId, prisma);

    const primarySideContact = s.primarySide === "vendor" ? vendor : purchaser;
    const primaryFirmId = s.primarySide === "vendor" ? vendorFirm.id : purchaserFirm.id;

    // The directly-confirmed half — fields depend on who confirmed.
    const primaryData =
      s.conf === "agent"
        ? { state: "complete" as const, completedAt: at(0), completedById: ownerUserId, confirmedByPortal: false, confirmedByContactId: null, confirmedBySolicitorFirmId: null, reflected: false }
        : s.conf === "client"
          ? { state: "complete" as const, completedAt: at(0), completedById: null, confirmedByPortal: true, confirmedByContactId: primarySideContact.id, confirmedBySolicitorFirmId: null, reflected: false }
          : { state: "complete" as const, completedAt: at(0), completedById: null, confirmedByPortal: false, confirmedByContactId: null, confirmedBySolicitorFirmId: primaryFirmId, reflected: false };

    // The auto-closed mirror half — always credited to the file's overseer (#278),
    // and flagged reflected (#279) so the portal restates it honestly.
    const mirrorData = { state: "complete" as const, completedAt: at(-1), completedById: ownerUserId, confirmedByPortal: false, confirmedByContactId: null, confirmedBySolicitorFirmId: null, reflected: true };

    const primaryDefId = defIdByCode.get(s.primaryCode)!;
    const mirrorDefId = defIdByCode.get(s.mirrorCode)!;
    await prisma.milestoneCompletion.updateMany({ where: { transactionId: tx.id, milestoneDefinitionId: primaryDefId }, data: primaryData });
    await prisma.milestoneCompletion.updateMany({ where: { transactionId: tx.id, milestoneDefinitionId: mirrorDefId }, data: mirrorData });

    links.push({
      blurb: `${s.blurb}  [${s.primaryCode}↔${s.mirrorCode}]`,
      seller: `/portal/${vendor.portalToken}/updates`,
      buyer: `/portal/${purchaser.portalToken}/updates`,
    });
    console.log(`  ✓ ${s.key.padEnd(13)} ${s.blurb}`);
  }

  console.log(`\n── Open these on http://localhost:3001 ──────────────────────────────────────\n`);
  for (const l of links) {
    console.log(l.blurb);
    console.log(`   seller: http://localhost:3001${l.seller}`);
    console.log(`   buyer:  http://localhost:3001${l.buyer}\n`);
  }
  console.log(`${links.length} files, ${links.length * 2} portals seeded. (Main portal page is the same URL without /updates.)`);
}

main().finally(() => prisma.$disconnect());
