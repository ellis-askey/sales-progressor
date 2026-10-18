// One-shot: add the "well-run operation" layer to the Boardwalk prod demo —
// realistic fees + referral income + a recommended-solicitor panel + a broker.
// Run after seed/enrich/fix. PROD-only guard; DIRECT_URL; idempotent.
//
//   npx dotenv -e .env.production --override -- npx tsx scripts/enrich-boardwalk-fees.ts
//
// What it sets:
//   - Agency commission on every file (agentFeePercent + VAT) -> populates the Fees card
//   - A recommended-solicitor panel (AgencyRecommendedSolicitor) of 4 Bristol firms,
//     each with a default referral fee -> the agency's curated panel
//   - Solicitor referral income per file (referredFirmId + referralFee), marked
//     received on exchanged/completed files, pending otherwise
//   - A mortgage broker (BrokerFirm + BrokerContact, +boardwalk email) on every
//     file, with a broker referral fee (received/pending by stage)
//
// All fictional. The teardown (delete-boardwalk-demo.ts) removes the panel rows,
// the broker, and the extra firms.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const EMAIL = (tag: string) => `ellisaskey+${tag}@googlemail.com`;

// Recommended-solicitor panel (first two already exist from enrich; last two are new).
const PANEL = [
  { name: "Clifton & Vale Conveyancing", feePence: 20000 },
  { name: "Ashton Gate Legal LLP", feePence: 18000 },
  { name: "Redcliffe Property Law", feePence: 25000 },
  { name: "Harbourside Legal", feePence: 15000 },
];
const REFERRED_FIRM = "Clifton & Vale Conveyancing"; // the firm the agency introduced the seller to
const BROKER_FIRM = "Brunel Mortgage Partners";
const BROKER_CONTACT = { name: "Lauren Price", email: EMAIL("bwbroker"), phone: "0117 900 0300" };

type Stage = "new" | "mid" | "ready" | "exchanged" | "completed";
const FILES: { match: string; feePct: number; stage: Stage }[] = [
  { match: "Bedminster", feePct: 1.25, stage: "new" },
  { match: "Southville", feePct: 1.0, stage: "mid" },
  { match: "Cotham Brow", feePct: 1.5, stage: "mid" },
  { match: "Chandos", feePct: 1.25, stage: "ready" },
  { match: "Montpelier", feePct: 1.4, stage: "exchanged" },
  { match: "Totterdown", feePct: 1.2, stage: "completed" },
];
const feeReceived = (s: Stage) => s === "exchanged" || s === "completed";

async function ensureFirm(name: string) {
  return prisma.solicitorFirm.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("gmkfustgwipgihpmpjpr")) { console.error("REFUSING: not the PROD project."); process.exit(1); }
  if (dbUrl.includes("etidawkbqctarmsdjoxp")) { console.error("REFUSING: staging."); process.exit(1); }
  console.log("== Enrich Boardwalk fees / referrals / panel (LIVE PROD) ==\n");

  const agency = await prisma.agency.findFirst({ where: { name: "Boardwalk Property Co" }, select: { id: true } });
  if (!agency) { console.error("agency missing"); process.exit(1); }

  // ── Recommended-solicitor panel ──────────────────────────────────────
  const firmIds: Record<string, string> = {};
  for (const f of PANEL) {
    const firm = await ensureFirm(f.name);
    firmIds[f.name] = firm.id;
    await prisma.agencyRecommendedSolicitor.upsert({
      where: { agencyId_solicitorFirmId: { agencyId: agency.id, solicitorFirmId: firm.id } },
      update: { defaultReferralFeePence: f.feePence, defaultReferralFeeVat: "plus" },
      create: { agencyId: agency.id, solicitorFirmId: firm.id, defaultReferralFeePence: f.feePence, defaultReferralFeeVat: "plus" },
    });
  }
  console.log(`Recommended-solicitor panel: ${PANEL.length} firms`);

  // ── Broker ───────────────────────────────────────────────────────────
  let brokerFirm = await prisma.brokerFirm.findFirst({ where: { name: BROKER_FIRM }, select: { id: true } });
  if (!brokerFirm) brokerFirm = await prisma.brokerFirm.create({ data: { name: BROKER_FIRM }, select: { id: true } });
  let brokerContact = await prisma.brokerContact.findFirst({ where: { firmId: brokerFirm.id, name: BROKER_CONTACT.name }, select: { id: true } });
  if (!brokerContact) brokerContact = await prisma.brokerContact.create({ data: { firmId: brokerFirm.id, ...BROKER_CONTACT }, select: { id: true } });
  console.log(`Broker: ${BROKER_FIRM} / ${BROKER_CONTACT.name}`);

  const referredFirmId = firmIds[REFERRED_FIRM];

  // ── Per-file fees + referrals ────────────────────────────────────────
  console.log("\nFiles:");
  for (const f of FILES) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: { agencyId: agency.id, propertyAddress: { contains: f.match } },
      select: { id: true, propertyAddress: true, purchasePrice: true },
    });
    if (!tx) { console.log(`  ! no file "${f.match}"`); continue; }
    const recv = feeReceived(f.stage);
    await prisma.propertyTransaction.update({
      where: { id: tx.id },
      data: {
        // Agency commission
        agentFeePercent: f.feePct,
        agentFeeIsVatInclusive: false,
        agentFeeAmount: null,
        // Solicitor referral income (agency introduced the seller to the firm)
        referredFirmId,
        referralFee: 20000,
        referralFeeVat: "plus",
        referralFeeReceived: recv,
        // Broker + broker referral income (buyer's mortgage broker)
        brokerFirmId: brokerFirm.id,
        brokerContactId: brokerContact.id,
        purchaserBrokerReferral: true,
        brokerReferralFee: 15000,
        brokerReferralFeeVat: "plus",
        brokerReferralFeeReceived: recv,
      },
    });
    const feeGbp = tx.purchasePrice ? Math.round((tx.purchasePrice * f.feePct / 100) / 100) : null;
    console.log(`  ${tx.propertyAddress.split(",")[0].padEnd(20)} fee ${f.feePct}%${feeGbp ? ` (~£${feeGbp.toLocaleString()})` : ""} + VAT | referral £200 + broker £150 (${recv ? "received" : "pending"})`);
  }

  console.log("\nDone.");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
