// One-shot demo seed for the 2026-08-17 portal batch: "Save contact" vCard,
// "new since your last visit" markers, and "add expected exchange to calendar".
//
// Creates TWO files on Emily's (self-managed) account:
//   1. An EXCHANGED buyer/seller file  → shows Save-contact + new-update markers.
//      The buyer's last visit is stamped 3 days ago and two client-visible
//      updates are dropped in the last day, so they render as "New".
//   2. A PRE-EXCHANGE buyer/seller file → shows the "add expected exchange to
//      your calendar" button (expected exchange ~5 weeks out).
//
// Also wires the team so the buttons have data: the agency's client-facing
// sender address, Emily's phone (progressor vCard), and an own-side conveyancer
// with an email + phone on both sides (solicitor email + Save-contact).
//
// STAGING ONLY. It mutates shared rows (agency sender email, Emily's phone), so
// it refuses to run against production. Additive otherwise (creates files).
//
// Run (staging):
//   DATABASE_URL="<staging url>" DIRECT_URL="<staging direct url>" \
//     npx ts-node --project tsconfig.scripts.json scripts/seed-portal-batch-aug17.ts
//
// Delete criteria: remove once the Aug-17 portal batch is signed off
// (SCRIPTS_REGISTRY entry has the ticket).

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const EMILY_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER_EMAIL = "ellisaskey+portalbatch@googlemail.com";
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

const AGENCY_SENDER = "ellis@hartwellpartners.co.uk";
const EMILY_PHONE = "+44 117 496 0100";
const SOL_FIRM = "Whitfield & Rowe";
const SOL_NAME = "Sarah Whitfield";
const SOL_EMAIL = "sarah.whitfield@whitfieldrowe.example";
const SOL_PHONE = "+44 20 7946 0102";

const EX_ADDRESS = "12 Pembroke Villas, Clifton, Bristol, BS8 3BB";
const EX_PRICE = 685_000;
const PRE_ADDRESS = "4 Aubrey Meadows, Redland, Bristol, BS6 6DP";
const PRE_PRICE = 495_000;

const PURCHASER_DONE_EX = ["PM1","PM2","PM3","PM4","PM5","PM6","PM11","PM9","PM10","PM7","PM8","PM13","PM14","PM20","PM21","PM22","PM23","PM24","PM25","PM26"];
const VENDOR_DONE_EX = ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM21","VM16","VM17","VM18","VM19"];
const EXCHANGE_CODES = new Set(["PM26", "VM19"]);

const PURCHASER_DONE_PRE = ["PM1","PM2","PM3","PM4","PM5","PM6"];
const VENDOR_DONE_PRE = ["VM1","VM2","VM3","VM4"];

function daysAgo(d: number): Date { const x = new Date(); x.setDate(x.getDate() - d); return x; }
function hoursAgo(h: number): Date { const x = new Date(); x.setHours(x.getHours() - h); return x; }
function daysAhead(d: number): Date { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(12, 0, 0, 0); return x; }

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

async function main() {
  const isProd = process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr");
  if (isProd) throw new Error("This seed mutates shared rows and is staging-only. Refusing to run against production.");
  console.log(`\n=== Seed Aug-17 portal batch (staging) ===`);
  console.log("Target DB:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"));

  const emily = await prisma.user.findUnique({ where: { email: EMILY_EMAIL }, select: { id: true, name: true, agencyId: true } });
  if (!emily) throw new Error(`No user ${EMILY_EMAIL} on this DB`);
  if (!emily.agencyId) throw new Error(`${EMILY_EMAIL} has no agencyId`);
  console.log(`Emily: ${emily.name} [${emily.id}]`);

  // Team data so the buttons have something to act on.
  await prisma.agency.update({ where: { id: emily.agencyId }, data: { quoteSenderEmail: AGENCY_SENDER } });
  await prisma.user.update({ where: { id: emily.id }, data: { phone: EMILY_PHONE } });

  const firm = await prisma.solicitorFirm.upsert({
    where: { name: SOL_FIRM },
    create: { name: SOL_FIRM },
    update: {},
    select: { id: true },
  });
  let solContact = await prisma.solicitorContact.findFirst({ where: { firmId: firm.id, name: SOL_NAME }, select: { id: true } });
  if (!solContact) {
    solContact = await prisma.solicitorContact.create({ data: { firmId: firm.id, name: SOL_NAME, email: SOL_EMAIL, phone: SOL_PHONE }, select: { id: true } });
  } else {
    await prisma.solicitorContact.update({ where: { id: solContact.id }, data: { email: SOL_EMAIL, phone: SOL_PHONE } });
  }

  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(defs.map((d) => [d.code, d.id]));

  async function makeFile(opts: {
    address: string;
    priceGBP: number;
    exchanged: boolean;
    expectedExchangeDate: Date;
    completionDate: Date | null;
    purchaserDone: string[];
    vendorDone: string[];
  }) {
    const buyerToken = randomBytes(24).toString("base64url");
    const sellerToken = randomBytes(24).toString("base64url");
    const tx = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: opts.address,
        agencyId: emily!.agencyId!,
        agentUserId: emily!.id,
        progressedBy: "agent",
        serviceType: "self_managed",
        status: "active",
        tenure: "freehold",
        purchaseType: "mortgage",
        purchasePrice: opts.priceGBP * 100,
        expectedExchangeDate: opts.expectedExchangeDate,
        completionDate: opts.completionDate,
        createdAt: daysAgo(60),
        lastActivityAt: new Date(),
        vendorSolicitorFirmId: firm.id,
        vendorSolicitorContactId: solContact!.id,
        purchaserSolicitorFirmId: firm.id,
        purchaserSolicitorContactId: solContact!.id,
      },
      select: { id: true },
    });

    const seller = await prisma.contact.create({
      data: { propertyTransactionId: tx.id, name: "Jonathan Pike", email: BURNER_EMAIL, roleType: "vendor", portalToken: sellerToken },
      select: { id: true },
    });
    const buyer = await prisma.contact.create({
      data: { propertyTransactionId: tx.id, name: "Robert & Anna Hale", email: BURNER_EMAIL, roleType: "purchaser", portalToken: buyerToken },
      select: { id: true },
    });

    await initMilestones(tx.id, "freehold", "mortgage", emily!.id);

    const markComplete = async (codes: string[]) => {
      for (const code of codes) {
        const defId = idByCode.get(code);
        if (!defId) continue;
        const isExchange = EXCHANGE_CODES.has(code);
        const completedAt = isExchange ? opts.expectedExchangeDate : daysAgo(12);
        await prisma.milestoneCompletion.updateMany({
          where: { transactionId: tx.id, milestoneDefinitionId: defId },
          data: { state: "complete", completedAt, completedById: emily!.id, eventDate: isExchange ? opts.expectedExchangeDate : null },
        });
      }
    };
    await markComplete(opts.purchaserDone);
    await markComplete(opts.vendorDone);

    return { txId: tx.id, buyerId: buyer.id, sellerId: seller.id, buyerToken, sellerToken };
  }

  // 1. Exchanged file (Save-contact + new-update markers)
  const ex = await makeFile({
    address: EX_ADDRESS,
    priceGBP: EX_PRICE,
    exchanged: true,
    expectedExchangeDate: daysAgo(3),
    completionDate: daysAhead(14),
    purchaserDone: PURCHASER_DONE_EX,
    vendorDone: VENDOR_DONE_EX,
  });

  // Buyer last visited 3 days ago; two client-visible updates since → "New".
  await prisma.contact.update({ where: { id: ex.buyerId }, data: { lastVisitedPortalAt: daysAgo(3) } });
  await prisma.outboundMessage.create({
    data: {
      agencyId: emily.agencyId, transactionId: ex.txId, channel: "in_app", purpose: "notification",
      status: "sent", type: "outbound", method: "phone", contactIds: [ex.buyerId], visibleToClient: true,
      isAutomated: false, createdById: emily.id, createdAt: daysAgo(1),
      content: "Quick call to let you know the searches are all back and look clear. Nothing needed from you right now.",
    },
  });
  await prisma.outboundMessage.create({
    data: {
      agencyId: emily.agencyId, transactionId: ex.txId, channel: "email", purpose: "notification",
      status: "sent", type: "outbound", method: "email", contactIds: [ex.buyerId], visibleToClient: true,
      isAutomated: false, createdById: emily.id, createdAt: hoursAgo(6),
      content: "Your lender has released the funds to your solicitor ready for completion. We'll confirm as soon as the money is on its way.",
    },
  });

  // 2. Pre-exchange file (add expected exchange to calendar)
  const pre = await makeFile({
    address: PRE_ADDRESS,
    priceGBP: PRE_PRICE,
    exchanged: false,
    expectedExchangeDate: daysAhead(35),
    completionDate: null,
    purchaserDone: PURCHASER_DONE_PRE,
    vendorDone: VENDOR_DONE_PRE,
  });

  const base = "https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app";
  console.log(`\n✓ Exchanged file ${ex.txId} — ${EX_ADDRESS}`);
  console.log(`  BUYER  (Save contact + new updates): ${base}/portal/${ex.buyerToken}`);
  console.log(`  SELLER (Save contact):               ${base}/portal/${ex.sellerToken}`);
  console.log(`\n✓ Pre-exchange file ${pre.txId} — ${PRE_ADDRESS}`);
  console.log(`  BUYER  (add expected exchange to calendar): ${base}/portal/${pre.buyerToken}`);
  console.log(`  SELLER:                                      ${base}/portal/${pre.sellerToken}\n`);
}

main().then(() => prisma.$disconnect()).catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
