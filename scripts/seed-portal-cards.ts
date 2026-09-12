// Review seed: one clean, labelled portal file per "Something you can do" card
// (Portal Engagement v2, item B) so each prompt can be reviewed in isolation.
//
//   1 Information Walk, Cardview  → Information prompt   (buyer + seller links)
//   2 Stamp Duty Rise, Cardview   → Stamp-duty prompt    (buyer, pre-exchange)
//   3 Completion Court, Cardview  → Costs prompt          (buyer, post-exchange)
//
// IDEMPOTENT — first deletes any file it previously seeded (address ends
// ", Cardview") then recreates from scratch, so re-running gives a clean set.
// ADDITIVE otherwise: it only ever touches its own ", Cardview" files, and
// attaches them to Emily Chen's (self-managed) agency.
//
// Run (staging):
//   DATABASE_URL="<staging pooler url>" DIRECT_URL="<staging pooler url>" \
//     npx ts-node --project tsconfig.scripts.json scripts/seed-portal-cards.ts
//
// Delete criteria: remove once the portal "cards" arc (item B) is signed off.

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);
const EXCHANGE_CODES = new Set(["PM26", "VM19"]);
const BURNER = "ellisaskey+portalcards@googlemail.com";
const TOWN = "Cardview";

// Mid-file, pre-exchange: both sides parked with their next step on the
// solicitor's side, so no client-confirm step competes with the prompt. The
// buyer runs through the survey + mortgage-offer you-steps (PM9/PM10/PM11) so
// the next client-facing step is the solicitor's search/enquiry stage; the
// seller stops after the contract pack so their next step is enquiries.
const BUYER_MID = ["PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7", "PM8", "PM9", "PM10", "PM11"];
const SELLER_MID = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7"];
// Exchanged freehold/mortgage file (skips leasehold-only + completion codes).
const BUYER_EXCHANGED = ["PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM11", "PM9", "PM10", "PM7", "PM8", "PM13", "PM14", "PM20", "PM21", "PM22", "PM23", "PM24", "PM25", "PM26"];
const SELLER_EXCHANGED = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "VM10", "VM21", "VM16", "VM17", "VM18", "VM19"];

async function initMilestones(
  transactionId: string,
  tenure: "freehold" | "leasehold",
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds",
  createdById: string,
) {
  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNrCodes = computeAutoNrCodes(purchaseType, tenure);
  const availableCodes = new Set<string>();
  for (const def of defs) {
    if (autoNrCodes.has(def.code)) continue;
    if (EXCHANGE_GATE_CODES.has(def.code)) continue;
    const prereqs = DIRECT_PREREQUISITES[def.code] ?? [];
    if (prereqs.length === 0 || prereqs.every((p) => autoNrCodes.has(p))) availableCodes.add(def.code);
  }
  const now = new Date();
  await prisma.milestoneCompletion.createMany({
    data: defs.map((def) => {
      const isNr = autoNrCodes.has(def.code);
      const isAvail = availableCodes.has(def.code);
      const state = (isNr ? "not_required" : isAvail ? "available" : "locked") as "not_required" | "available" | "locked";
      return { transactionId, milestoneDefinitionId: def.id, state, notRequiredReason: isNr ? "Auto-set at file creation" : null, completedById: createdById, createdAt: now };
    }),
  });
}

function daysAgo(d: number): Date { const x = new Date(); x.setDate(x.getDate() - d); return x; }
function daysAhead(d: number): Date { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(12, 0, 0, 0); return x; }

async function wipePrior() {
  const prior = await prisma.propertyTransaction.findMany({ where: { propertyAddress: { endsWith: `, ${TOWN}` } }, select: { id: true, propertyAddress: true } });
  for (const p of prior) {
    await prisma.clientMoveInfo.deleteMany({ where: { transactionId: p.id } });
    await prisma.milestoneCompletion.deleteMany({ where: { transactionId: p.id } });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: p.id } });
    try {
      await prisma.propertyTransaction.delete({ where: { id: p.id } });
      console.log(`  wiped prior: ${p.propertyAddress}`);
    } catch (e) {
      console.warn(`  could not delete ${p.propertyAddress} (${(e as Error).message}) — leaving it`);
    }
  }
}

async function createFile(opts: {
  address: string; buyerName: string; sellerName: string; price: number;
  buyerDone: string[]; sellerDone: string[]; exchanged: boolean;
  agencyId: string; agentUserId: string;
}) {
  const { address, buyerName, sellerName, price, buyerDone, sellerDone, exchanged, agencyId, agentUserId } = opts;
  const idByCode = new Map((await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
  const buyerToken = randomBytes(24).toString("base64url");
  const sellerToken = randomBytes(24).toString("base64url");
  const exchangeDate = daysAgo(3);

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: address,
      agencyId, agentUserId,
      progressedBy: "agent", serviceType: "self_managed", status: "active",
      tenure: "freehold", purchaseType: "mortgage",
      purchasePrice: price * 100,
      expectedExchangeDate: exchanged ? exchangeDate : null,
      completionDate: exchanged ? daysAhead(14) : null,
      createdAt: daysAgo(70),
      lastActivityAt: daysAgo(2),
    },
    select: { id: true },
  });

  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: tx.id, name: sellerName, email: BURNER, roleType: "vendor", portalToken: sellerToken },
      { propertyTransactionId: tx.id, name: buyerName, email: BURNER, roleType: "purchaser", portalToken: buyerToken },
    ],
  });

  await initMilestones(tx.id, "freehold", "mortgage", agentUserId);

  const markComplete = async (codes: string[]) => {
    for (const code of codes) {
      const defId = idByCode.get(code);
      if (!defId) continue;
      const isExch = EXCHANGE_CODES.has(code);
      await prisma.milestoneCompletion.updateMany({
        where: { transactionId: tx.id, milestoneDefinitionId: defId },
        data: { state: "complete", completedAt: isExch ? exchangeDate : daysAgo(8), completedById: agentUserId, eventDate: isExch ? exchangeDate : null },
      });
    }
  };
  await markComplete(buyerDone);
  await markComplete(sellerDone);

  return { txId: tx.id, buyerToken, sellerToken };
}

async function main() {
  const isProd = process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr");
  console.log(`\n=== Seed portal "cards" review files (${isProd ? "PRODUCTION" : "staging"}) ===`);
  if (isProd) throw new Error("Refusing to run against production — staging only.");

  const emily = await prisma.user.findFirst({ where: { email: "emily@hartwellpartners.co.uk" }, select: { id: true, agencyId: true, name: true } });
  const user = emily?.agencyId ? emily : await prisma.user.findFirst({ where: { agencyId: { not: null }, role: { in: ["director", "negotiator"] } }, select: { id: true, agencyId: true, name: true } });
  if (!user?.agencyId) throw new Error("No agency user found to attach demo files to.");
  console.log(`Home agency user: ${user.name} [${user.id}]\n`);

  console.log("Wiping any prior ', Cardview' seed files…");
  await wipePrior();

  console.log("\nCreating fresh files…");
  const info = await createFile({
    address: "1 Information Walk, Cardview", buyerName: "Ade Okonkwo", sellerName: "Grace Whitfield",
    price: 450_000, buyerDone: BUYER_MID, sellerDone: SELLER_MID, exchanged: false,
    agencyId: user.agencyId, agentUserId: user.id,
  });
  const stamp = await createFile({
    address: "2 Stamp Duty Rise, Cardview", buyerName: "Priya Nair", sellerName: "Tom Ellison",
    price: 425_000, buyerDone: BUYER_MID, sellerDone: SELLER_MID, exchanged: false,
    agencyId: user.agencyId, agentUserId: user.id,
  });
  // Stamp-duty prompt only shows AFTER move info is filled (that's what turns the
  // Information prompt off), so give this buyer a move-info row.
  await prisma.clientMoveInfo.create({
    data: { transactionId: stamp.txId, side: "purchaser", flexibility: "somewhat", fundsInPlace: "not_yet", fundsSource: "savings", removalStatus: "not_started" },
  });
  const costs = await createFile({
    address: "3 Completion Court, Cardview", buyerName: "Marcus Reid", sellerName: "Helen Barnes",
    price: 540_000, buyerDone: BUYER_EXCHANGED, sellerDone: SELLER_EXCHANGED, exchanged: true,
    agencyId: user.agencyId, agentUserId: user.id,
  });

  const base = "http://localhost:3001/portal";
  console.log("\n──────────── REVIEW LINKS (localhost:3001, staging DB) ────────────\n");
  console.log("1) INFORMATION prompt");
  console.log(`   Buyer :  ${base}/${info.buyerToken}`);
  console.log(`   Seller:  ${base}/${info.sellerToken}`);
  console.log("\n2) STAMP-DUTY prompt (buyer, pre-exchange)");
  console.log(`   Buyer :  ${base}/${stamp.buyerToken}`);
  console.log("\n3) COSTS prompt (buyer, post-exchange)");
  console.log(`   Buyer :  ${base}/${costs.buyerToken}`);
  console.log("\n(Seller links exist on 2 & 3 too but those prompts are buyer-only.)\n");
}

main().then(() => prisma.$disconnect()).catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
