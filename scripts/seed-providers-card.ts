// Review seed for the "Need anything else?" providers card (2026-09-14).
//
// Creates two buyer portal files, both with the survey booked (PM9 complete),
// so the survey-quote card is gone and the providers card takes over:
//
//   A  covered postcode (BS1)  -> providers card SHOWS  (a local surveyor covers it)
//   B  uncovered postcode (ZZ9) -> providers card HIDDEN (nothing covers it)
//
// Also upserts a demo surveyor (Provcard Surveys) + a surveyor service type +
// coverage for BS1, so tapping the card lands on a non-empty /quote picker.
//
// IDEMPOTENT — first wipes anything it previously seeded (address contains
// "Provcard") then recreates. Only ever touches its own files + its own demo
// firm. Attaches files to the first agency user found.
//
// Run (staging — local dev points here):
//   npx ts-node --project tsconfig.scripts.json scripts/seed-providers-card.ts
//
// Delete criteria: remove once the providers card is signed off.

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);
const BURNER = "ellisaskey+providerscard@googlemail.com";
const MARKER = "Provcard";
const COVERED_OUTWARD = "BS1";

// Buyer runs through instruction, mortgage, and the survey (PM9/PM10) so the
// survey is booked and the survey-quote card has handed over.
const BUYER_DONE = ["PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7", "PM8", "PM9", "PM10", "PM11"];
const SELLER_DONE = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7"];

function daysAgo(d: number): Date { const x = new Date(); x.setDate(x.getDate() - d); return x; }

async function initMilestones(transactionId: string, createdById: string) {
  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNrCodes = computeAutoNrCodes("mortgage", "freehold");
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

async function upsertDemoSurveyor() {
  // Service type — reuse an existing active surveyor type, else create one.
  let serviceType = await prisma.providerServiceType.findFirst({ where: { kind: "surveyor", active: true }, orderBy: { sortOrder: "asc" } });
  if (!serviceType) {
    serviceType = await prisma.providerServiceType.create({
      data: { kind: "surveyor", label: "Level 2 HomeBuyer survey", sortOrder: 0, active: true },
    });
  }

  let firm = await prisma.providerFirm.findFirst({ where: { name: "Provcard Surveys", kind: "surveyor" } });
  if (!firm) {
    firm = await prisma.providerFirm.create({
      data: {
        kind: "surveyor", name: "Provcard Surveys", email: BURNER,
        ricsRegulated: true, establishedYear: 2008, turnaround: "Quotes within 2 working days", active: true,
      },
    });
  }
  await prisma.providerFirmServiceType.upsert({
    where: { providerId_serviceTypeId: { providerId: firm.id, serviceTypeId: serviceType.id } },
    update: {},
    create: { providerId: firm.id, serviceTypeId: serviceType.id },
  });
  await prisma.providerCoverage.upsert({
    where: { providerId_outwardCode: { providerId: firm.id, outwardCode: COVERED_OUTWARD } },
    update: {},
    create: { providerId: firm.id, outwardCode: COVERED_OUTWARD },
  });
  return firm;
}

async function wipePrior() {
  const prior = await prisma.propertyTransaction.findMany({ where: { propertyAddress: { contains: MARKER } }, select: { id: true, propertyAddress: true } });
  for (const p of prior) {
    await prisma.clientMoveInfo.deleteMany({ where: { transactionId: p.id } });
    await prisma.milestoneCompletion.deleteMany({ where: { transactionId: p.id } });
    await prisma.quoteRequest.deleteMany({ where: { transactionId: p.id } });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: p.id } });
    try {
      await prisma.propertyTransaction.delete({ where: { id: p.id } });
      console.log(`  wiped prior: ${p.propertyAddress}`);
    } catch (e) {
      console.warn(`  could not delete ${p.propertyAddress} (${(e as Error).message}) — leaving it`);
    }
  }
}

async function createBuyerFile(opts: { address: string; buyerName: string; sellerName: string; price: number; agencyId: string; agentUserId: string; }) {
  const { address, buyerName, sellerName, price, agencyId, agentUserId } = opts;
  const idByCode = new Map((await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
  const buyerToken = randomBytes(24).toString("base64url");
  const sellerToken = randomBytes(24).toString("base64url");

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: address, agencyId, agentUserId,
      progressedBy: "agent", serviceType: "self_managed", status: "active",
      tenure: "freehold", purchaseType: "mortgage", purchasePrice: price * 100,
      createdAt: daysAgo(70), lastActivityAt: daysAgo(2),
    },
    select: { id: true },
  });

  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: tx.id, name: sellerName, email: BURNER, roleType: "vendor", portalToken: sellerToken },
      { propertyTransactionId: tx.id, name: buyerName, email: BURNER, roleType: "purchaser", portalToken: buyerToken },
    ],
  });

  await initMilestones(tx.id, agentUserId);

  for (const code of [...BUYER_DONE, ...SELLER_DONE]) {
    const defId = idByCode.get(code);
    if (!defId) continue;
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: tx.id, milestoneDefinitionId: defId },
      data: { state: "complete", completedAt: daysAgo(8), completedById: agentUserId },
    });
  }

  return { buyerToken };
}

async function main() {
  const isProd = process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr");
  console.log(`\n=== Seed providers-card review files (${isProd ? "PRODUCTION" : "staging"}) ===`);
  if (isProd) throw new Error("Refusing to run against production — staging only.");

  const user = await prisma.user.findFirst({ where: { agencyId: { not: null }, role: { in: ["director", "negotiator"] } }, select: { id: true, agencyId: true, name: true } });
  if (!user?.agencyId) throw new Error("No agency user found to attach demo files to.");
  console.log(`Home agency user: ${user.name} [${user.id}]`);

  console.log("\nWiping any prior Provcard seed files…");
  await wipePrior();

  console.log("Upserting demo surveyor + coverage (BS1)…");
  await upsertDemoSurveyor();

  console.log("Creating fresh files…");
  const covered = await createBuyerFile({
    address: `10 ${MARKER} Avenue, Bristol, BS1 4PN`, buyerName: "Omolola Adeyemi", sellerName: "Grace Whitfield",
    price: 487_000, agencyId: user.agencyId, agentUserId: user.id,
  });
  const uncovered = await createBuyerFile({
    address: `5 ${MARKER} Court, Farville, ZZ9 9ZZ`, buyerName: "Daniel Okoro", sellerName: "Tom Ellison",
    price: 410_000, agencyId: user.agencyId, agentUserId: user.id,
  });

  const base = "http://localhost:3001/portal";
  console.log("\n──────────── REVIEW LINKS (localhost:3001, staging DB) ────────────\n");
  console.log("A) Providers card SHOWS  (covered postcode BS1, survey booked)");
  console.log(`   Buyer :  ${base}/${covered.buyerToken}`);
  console.log("\nB) Providers card HIDDEN (uncovered postcode ZZ9, survey booked)");
  console.log(`   Buyer :  ${base}/${uncovered.buyerToken}`);
  console.log("\nTap the card on A to reach the /quote picker (Provcard Surveys covers BS1).\n");
}

main().then(() => prisma.$disconnect()).catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
