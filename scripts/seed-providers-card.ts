// Review seed for the provider / survey / broker card audit fixes (2026-09-14).
//
// Creates one buyer portal file per behaviour so each audit decision can be
// reviewed in isolation:
//
//   A  covered postcode (BS1), survey booked        -> providers card, LOCAL copy
//   B  uncovered (ZZ9), survey booked, no broker     -> providers card HIDDEN
//   C  uncovered (ZZ9), survey booked, broker on file-> providers card, BROKER-ONLY copy
//   D  covered (BS1), survey OPTED OUT (PM9 not-req) -> survey-quote gone, providers card shows
//   E  covered (BS1), quote requested, not booked    -> survey-status + "Request another quote" link
//
// Also upserts a demo surveyor (Provcard Surveys) + coverage for BS1, and a
// demo broker firm (Provcard Mortgages) for file C.
//
// IDEMPOTENT — wipes anything it previously seeded (address contains "Provcard")
// then recreates. Staging-guarded (refuses production DB).
//
// Run (staging — local dev points here):
//   npx ts-node --project tsconfig.scripts.json scripts/seed-providers-card.ts
//
// Delete criteria: remove once the provider/survey/broker card audit is signed off.

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";
import { titleCaseFirm } from "../lib/services/survey-booking";

const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);
const BURNER = "ellisaskey+providerscard@googlemail.com";
const MARKER = "Provcard";
const COVERED_OUTWARD = "BS1";

// Buyer through the survey booked (PM9) + valuation (PM6).
const BUYER_SURVEY_BOOKED = ["PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7", "PM8", "PM9", "PM10", "PM11"];
// Buyer up to searches, survey NOT booked (for opt-out + quote-requested files).
const BUYER_PRE_SURVEY = ["PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7", "PM8"];
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

async function upsertDemoProviders() {
  let serviceType = await prisma.providerServiceType.findFirst({ where: { kind: "surveyor", active: true }, orderBy: { sortOrder: "asc" } });
  if (!serviceType) {
    serviceType = await prisma.providerServiceType.create({ data: { kind: "surveyor", label: "Level 2 HomeBuyer survey", sortOrder: 0, active: true } });
  }
  let firm = await prisma.providerFirm.findFirst({ where: { name: "Provcard Surveys", kind: "surveyor" } });
  if (!firm) {
    firm = await prisma.providerFirm.create({ data: { kind: "surveyor", name: "Provcard Surveys", email: BURNER, ricsRegulated: true, establishedYear: 2008, turnaround: "Quotes within 2 working days", active: true } });
  }
  await prisma.providerFirmServiceType.upsert({ where: { providerId_serviceTypeId: { providerId: firm.id, serviceTypeId: serviceType.id } }, update: {}, create: { providerId: firm.id, serviceTypeId: serviceType.id } });
  await prisma.providerCoverage.upsert({ where: { providerId_outwardCode: { providerId: firm.id, outwardCode: COVERED_OUTWARD } }, update: {}, create: { providerId: firm.id, outwardCode: COVERED_OUTWARD } });

  let broker = await prisma.brokerFirm.findFirst({ where: { name: "Provcard Mortgages" } });
  if (!broker) broker = await prisma.brokerFirm.create({ data: { name: "Provcard Mortgages" } });

  // Whether a TSP-default mortgage broker exists — drives the "defaulting to
  // ours" variant (File G). We never create/flip a tspDefault here (that could
  // hijack the real default); we only use one if it already exists.
  const tspBroker = await prisma.providerFirm.findFirst({ where: { kind: "mortgage_broker", tspDefault: true, active: true }, select: { name: true } });

  return { firm, serviceType, brokerFirmId: broker.id, tspBrokerName: tspBroker?.name ?? null };
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

async function createBuyerFile(opts: {
  address: string; buyerName: string; sellerName: string; price: number;
  agencyId: string; agentUserId: string;
  buyerDone: string[];
  serviceType?: "self_managed" | "outsourced";
  brokerFirmId?: string | null;
  optOutSurvey?: boolean;
  requestQuote?: { providerId: string; serviceTypeId: string; postcode: string } | null;
  bookedSurveyorNameRaw?: string | null; // free-text agent-typed name; formatted via the real helper
  purchaserBrokerReferral?: boolean;     // referral confirmed -> broker lands in Your team, offer card hides
  ownBrokerName?: string | null;         // buyer named their own broker -> offer card flips to "compare"
}) {
  const { address, buyerName, sellerName, price, agencyId, agentUserId, buyerDone } = opts;
  const idByCode = new Map((await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } })).map((d) => [d.code, d.id]));
  const buyerToken = randomBytes(24).toString("base64url");
  const sellerToken = randomBytes(24).toString("base64url");

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: address, agencyId, agentUserId,
      progressedBy: "agent", serviceType: opts.serviceType ?? "self_managed", status: "active",
      tenure: "freehold", purchaseType: "mortgage", purchasePrice: price * 100,
      brokerFirmId: opts.brokerFirmId ?? null,
      purchaserBrokerReferral: opts.purchaserBrokerReferral ?? false,
      bookedSurveyorName: opts.bookedSurveyorNameRaw ? titleCaseFirm(opts.bookedSurveyorNameRaw) : null,
      createdAt: daysAgo(70), lastActivityAt: daysAgo(2),
    },
    select: { id: true },
  });

  const [seller, buyer] = await prisma.$transaction([
    prisma.contact.create({ data: { propertyTransactionId: tx.id, name: sellerName, email: BURNER, roleType: "vendor", portalToken: sellerToken }, select: { id: true } }),
    prisma.contact.create({ data: { propertyTransactionId: tx.id, name: buyerName, email: BURNER, roleType: "purchaser", portalToken: buyerToken }, select: { id: true } }),
  ]);
  void seller;

  await initMilestones(tx.id, agentUserId);

  for (const code of [...buyerDone, ...SELLER_DONE]) {
    const defId = idByCode.get(code);
    if (!defId) continue;
    await prisma.milestoneCompletion.updateMany({ where: { transactionId: tx.id, milestoneDefinitionId: defId }, data: { state: "complete", completedAt: daysAgo(8), completedById: agentUserId } });
  }

  if (opts.optOutSurvey) {
    const pm9 = idByCode.get("PM9");
    if (pm9) await prisma.milestoneCompletion.updateMany({ where: { transactionId: tx.id, milestoneDefinitionId: pm9 }, data: { state: "not_required", notRequiredReason: "Buyer opted out of a survey" } });
  }

  if (opts.ownBrokerName) {
    await prisma.clientMoveInfo.create({ data: { transactionId: tx.id, side: "purchaser", ownBrokerName: opts.ownBrokerName } });
  }

  if (opts.requestQuote) {
    await prisma.quoteRequest.create({
      data: {
        transactionId: tx.id, contactId: buyer.id, providerId: opts.requestQuote.providerId, serviceTypeId: opts.requestQuote.serviceTypeId, kind: "surveyor",
        contactMethod: "either", contactWindow: "anytime", urgency: "within_week",
        clientName: buyerName, clientEmail: BURNER, propertyAddress: address,
        propertyPostcode: opts.requestQuote.postcode, propertyOutwardCode: COVERED_OUTWARD,
        pricePence: price * 100, tenure: "freehold", status: "pending", submittedAt: daysAgo(4),
      },
    });
  }

  return { buyerToken };
}

async function main() {
  const isProd = process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr");
  console.log(`\n=== Seed provider/survey/broker card review files (${isProd ? "PRODUCTION" : "staging"}) ===`);
  if (isProd) throw new Error("Refusing to run against production — staging only.");

  const user = await prisma.user.findFirst({ where: { agencyId: { not: null }, role: { in: ["director", "negotiator"] } }, select: { id: true, agencyId: true, name: true } });
  if (!user?.agencyId) throw new Error("No agency user found to attach demo files to.");
  console.log(`Home agency user: ${user.name} [${user.id}]`);

  console.log("\nWiping any prior Provcard seed files…");
  await wipePrior();

  console.log("Upserting demo providers (surveyor + coverage BS1, broker firm)…");
  const { firm, serviceType, brokerFirmId, tspBrokerName } = await upsertDemoProviders();

  const common = { sellerName: "Grace Whitfield", agencyId: user.agencyId, agentUserId: user.id };
  console.log("Creating fresh files…");
  const A = await createBuyerFile({ ...common, address: `10 ${MARKER} Avenue, Bristol, BS1 4PN`, buyerName: "Omolola Adeyemi", price: 487_000, buyerDone: BUYER_SURVEY_BOOKED });
  const B = await createBuyerFile({ ...common, address: `5 ${MARKER} Court, Farville, ZZ9 9ZZ`, buyerName: "Daniel Okoro", price: 410_000, buyerDone: BUYER_SURVEY_BOOKED });
  const C = await createBuyerFile({ ...common, address: `7 ${MARKER} Rise, Farville, ZZ9 9ZZ`, buyerName: "Priya Nair", price: 395_000, buyerDone: BUYER_SURVEY_BOOKED, serviceType: "outsourced", brokerFirmId });
  const D = await createBuyerFile({ ...common, address: `12 ${MARKER} Lane, Bristol, BS1 4PN`, buyerName: "Marcus Reid", price: 462_000, buyerDone: BUYER_PRE_SURVEY, optOutSurvey: true });
  const E = await createBuyerFile({ ...common, address: `18 ${MARKER} Close, Bristol, BS1 4PN`, buyerName: "Helena Barnes", price: 448_000, buyerDone: BUYER_PRE_SURVEY, requestQuote: { providerId: firm.id, serviceTypeId: serviceType.id, postcode: "BS1 4PN" } });
  // F: agent typed the surveyor name straight onto the file (no quote flow). The
  // raw "AVB surveyors" is run through the real formatter -> "AVB Surveyors".
  const F = await createBuyerFile({ ...common, address: `22 ${MARKER} Terrace, Bristol, BS1 4PN`, buyerName: "Sofia Marconi", price: 505_000, buyerDone: BUYER_SURVEY_BOOKED, bookedSurveyorNameRaw: "AVB surveyors" });
  // G: broker-only, "defaulting to ours" — outsourced file, no broker on the
  // file, so it resolves to the TSP-default broker (no "Recommended by" line).
  // Only seeded when a TSP-default broker actually exists.
  const G = tspBrokerName
    ? await createBuyerFile({ ...common, address: `9 ${MARKER} Way, Farville, ZZ9 9ZZ`, buyerName: "Owen Pryce", price: 372_000, buyerDone: BUYER_SURVEY_BOOKED, serviceType: "outsourced" })
    : null;
  // H: buyer named their OWN broker while ours is still on offer -> the offer
  // card flips to "Compare mortgage deals".
  const H = await createBuyerFile({ ...common, address: `3 ${MARKER} Mews, Farville, ZZ9 9ZZ`, buyerName: "Leah Nkemdirim", price: 418_000, buyerDone: BUYER_SURVEY_BOOKED, brokerFirmId, ownBrokerName: "Kingsway Mortgages" });
  // I: agency's broker referral CONFIRMED -> broker sits in Your team, no offer card.
  const I = await createBuyerFile({ ...common, address: `6 ${MARKER} Green, Farville, ZZ9 9ZZ`, buyerName: "Tomasz Wolak", price: 389_000, buyerDone: BUYER_SURVEY_BOOKED, brokerFirmId, purchaserBrokerReferral: true });

  const base = "http://localhost:3001/portal";
  console.log("\n──────────── REVIEW LINKS (localhost:3001, staging DB) ────────────\n");
  console.log(`A) Providers card, LOCAL copy   (covered, survey booked)     ${base}/${A.buyerToken}`);
  console.log(`B) Providers card HIDDEN         (uncovered, no broker)       ${base}/${B.buyerToken}`);
  console.log(`C) Broker card, AGENCY'S OWN     (uncovered, broker on file)  ${base}/${C.buyerToken}`);
  console.log(`D) Survey opt-out: quote gone,   providers card shows         ${base}/${D.buyerToken}`);
  console.log(`E) Quote requested: "Request another quote" link              ${base}/${E.buyerToken}`);
  console.log(`F) Agent-typed name (#7): "Survey booked with AVB Surveyors"  ${base}/${F.buyerToken}`);
  if (G) console.log(`G) Broker card, OUR DEFAULT      (uncovered, no broker on file) ${base}/${G.buyerToken}  [${tspBrokerName}]`);
  else console.log(`G) (skipped — no TSP-default broker exists to show the "our default" variant)`);
  console.log(`H) Buyer has own broker: card flips to "Compare mortgage deals"  ${base}/${H.buyerToken}`);
  console.log(`I) Referral CONFIRMED: no offer card, broker sits in Your team    ${base}/${I.buyerToken}`);
  console.log("");
}

main().then(() => prisma.$disconnect()).catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
