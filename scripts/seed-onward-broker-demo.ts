// Demo seed for the seller's onward broker (Phase 2, 2026-09-15).
//
// Local can't run `prisma migrate` (direct DB host unreachable), so this first
// applies the onward-broker columns to the STAGING DB idempotently via the
// pooler, then seeds files on Hartwell & Partners (log in as
// emily@hartwellpartners.co.uk) so every UI surface can be walked through.
//
// Files (all addresses end ", Onward Demo"):
//   A  active, buying onward, onward broker SET + fee (pending)  -> Professionals card + Fees card + analytics
//   B  completed, onward broker SET + fee (received)             -> completions totals + analytics
//   C  active, buying onward, NO onward broker                   -> the "Add seller's onward broker" empty control
//   D  exchanged, onward broker referred but NO fee              -> revenue-at-risk warning candidate
//
// IDEMPOTENT — wipes its own ", Onward Demo" files then recreates. Staging-guarded.
//
// Run: npx ts-node --project tsconfig.scripts.json scripts/seed-onward-broker-demo.ts
// Delete criteria: remove once the onward broker feature is signed off.

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const MARKER = "Onward Demo";
const BURNER = "ellisaskey+onwardbroker@googlemail.com";
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

async function applyColumns() {
  // Idempotent — safe to re-run; mirrors the migration so the deploy is a no-op.
  const stmts = [
    `ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerFirmId" TEXT`,
    `ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerContactId" TEXT`,
    `ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerReferralFee" INTEGER`,
    `ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerReferralFeeReceived" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerReferral" BOOLEAN NOT NULL DEFAULT false`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyTransaction_onwardBrokerFirmId_fkey') THEN
         ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_onwardBrokerFirmId_fkey" FOREIGN KEY ("onwardBrokerFirmId") REFERENCES "BrokerFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyTransaction_onwardBrokerContactId_fkey') THEN
         ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_onwardBrokerContactId_fkey" FOREIGN KEY ("onwardBrokerContactId") REFERENCES "BrokerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
       END IF;
     END $$`,
  ];
  for (const sql of stmts) await prisma.$executeRawUnsafe(sql);
}

function daysAgo(d: number): Date { const x = new Date(); x.setDate(x.getDate() - d); return x; }
function daysAhead(d: number): Date { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(12, 0, 0, 0); return x; }

async function initMilestones(transactionId: string, createdById: string, doneCodes: string[]) {
  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNr = computeAutoNrCodes("mortgage", "freehold");
  const avail = new Set<string>();
  for (const def of defs) {
    if (autoNr.has(def.code) || EXCHANGE_GATE_CODES.has(def.code)) continue;
    const pre = DIRECT_PREREQUISITES[def.code] ?? [];
    if (pre.length === 0 || pre.every((p) => autoNr.has(p))) avail.add(def.code);
  }
  const now = new Date();
  await prisma.milestoneCompletion.createMany({
    data: defs.map((def) => {
      const isNr = autoNr.has(def.code);
      const state = (isNr ? "not_required" : avail.has(def.code) ? "available" : "locked") as "not_required" | "available" | "locked";
      return { transactionId, milestoneDefinitionId: def.id, state, notRequiredReason: isNr ? "Auto" : null, completedById: createdById, createdAt: now };
    }),
  });
  const idByCode = new Map(defs.map((d) => [d.code, d.id]));
  for (const code of doneCodes) {
    const id = idByCode.get(code);
    if (id) await prisma.milestoneCompletion.updateMany({ where: { transactionId, milestoneDefinitionId: id }, data: { state: "complete", completedAt: daysAgo(6), completedById: createdById } });
  }
}

const BUYER_MID = ["PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7", "PM8"];
const BUYER_EXCHANGED = [...BUYER_MID, "PM9", "PM10", "PM11", "PM13", "PM14", "PM20", "PM21", "PM22", "PM23", "PM24", "PM25", "PM26"];
const BUYER_COMPLETED = [...BUYER_EXCHANGED, "PM27"];
const SELLER_MID = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7"];

async function wipe() {
  const prior = await prisma.propertyTransaction.findMany({ where: { propertyAddress: { endsWith: `, ${MARKER}` } }, select: { id: true } });
  for (const p of prior) {
    await prisma.clientMoveInfo.deleteMany({ where: { transactionId: p.id } });
    await prisma.milestoneCompletion.deleteMany({ where: { transactionId: p.id } });
    await prisma.contact.deleteMany({ where: { propertyTransactionId: p.id } });
    await prisma.propertyTransaction.delete({ where: { id: p.id } }).catch(() => {});
  }
}

async function createFile(opts: {
  address: string; buyerName: string; sellerName: string; price: number; agencyId: string; agentUserId: string;
  status: "active" | "completed"; done: string[]; buyingOnward: boolean;
  onwardBrokerFirmId?: string | null; onwardBrokerReferralFee?: number | null; onwardBrokerReferral?: boolean; onwardBrokerReferralFeeReceived?: boolean;
  exchanged?: boolean;
}) {
  const buyerToken = randomBytes(18).toString("base64url");
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: opts.address, agencyId: opts.agencyId, agentUserId: opts.agentUserId,
      progressedBy: "agent", serviceType: "self_managed", status: opts.status,
      tenure: "freehold", purchaseType: "mortgage", purchasePrice: opts.price * 100,
      agentFeeAmount: 4500 * 100, agentFeeIsVatInclusive: false,
      completionDate: opts.status === "completed" ? daysAgo(3) : (opts.exchanged ? daysAhead(14) : null),
      expectedExchangeDate: opts.exchanged || opts.status === "completed" ? daysAgo(5) : null,
      onwardBrokerFirmId: opts.onwardBrokerFirmId ?? null,
      onwardBrokerReferralFee: opts.onwardBrokerReferralFee ?? null,
      onwardBrokerReferral: opts.onwardBrokerReferral ?? false,
      onwardBrokerReferralFeeReceived: opts.onwardBrokerReferralFeeReceived ?? false,
      createdAt: daysAgo(60), lastActivityAt: daysAgo(2),
    },
    select: { id: true },
  });
  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: tx.id, name: opts.sellerName, email: BURNER, roleType: "vendor", portalToken: randomBytes(18).toString("base64url") },
      { propertyTransactionId: tx.id, name: opts.buyerName, email: BURNER, roleType: "purchaser", portalToken: buyerToken },
    ],
  });
  await initMilestones(tx.id, opts.agentUserId, opts.done);
  if (opts.buyingOnward) {
    await prisma.clientMoveInfo.create({ data: { transactionId: tx.id, side: "vendor", buyingOnward: true } });
  }
  return tx.id;
}

async function main() {
  const isProd = process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr");
  console.log(`\n=== Seed onward-broker demo (${isProd ? "PRODUCTION" : "staging"}) ===`);
  if (isProd) throw new Error("Refusing to run against production — staging only.");

  console.log("Applying onward-broker columns to staging (idempotent)…");
  await applyColumns();

  const emily = await prisma.user.findFirst({ where: { email: "emily@hartwellpartners.co.uk" }, select: { id: true, agencyId: true, name: true } });
  if (!emily?.agencyId) throw new Error("emily@hartwellpartners.co.uk not found — seed the base test accounts first.");
  console.log(`Attaching to ${emily.name}'s agency [${emily.agencyId}]`);

  await wipe();

  let broker = await prisma.brokerFirm.findFirst({ where: { name: "Onward Finance (demo)" } });
  if (!broker) broker = await prisma.brokerFirm.create({ data: { name: "Onward Finance (demo)" } });

  const common = { agencyId: emily.agencyId, agentUserId: emily.id };

  const A = await createFile({ ...common, address: `1 Bridge Rise, ${MARKER}`, buyerName: "Ade Okonkwo", sellerName: "Grace Whitfield", price: 465_000, status: "active", done: [...BUYER_MID, ...SELLER_MID], buyingOnward: true, onwardBrokerFirmId: broker.id, onwardBrokerReferralFee: 1200 * 100, onwardBrokerReferral: true });
  const B = await createFile({ ...common, address: `2 Elm Court, ${MARKER}`, buyerName: "Priya Nair", sellerName: "Tom Ellison", price: 512_000, status: "completed", done: [...BUYER_COMPLETED, ...SELLER_MID], buyingOnward: true, onwardBrokerFirmId: broker.id, onwardBrokerReferralFee: 950 * 100, onwardBrokerReferral: true, onwardBrokerReferralFeeReceived: true, exchanged: true });
  const C = await createFile({ ...common, address: `3 Oak Lane, ${MARKER}`, buyerName: "Marcus Reid", sellerName: "Helen Barnes", price: 398_000, status: "active", done: [...BUYER_MID, ...SELLER_MID], buyingOnward: true });
  const D = await createFile({ ...common, address: `4 Willow Way, ${MARKER}`, buyerName: "Sofia Marconi", sellerName: "Owen Pryce", price: 441_000, status: "active", done: [...BUYER_EXCHANGED, ...SELLER_MID], buyingOnward: true, onwardBrokerFirmId: broker.id, onwardBrokerReferral: true, exchanged: true });

  const base = "http://localhost:3001/agent/transactions";
  console.log("\n──────────── LOG IN AS emily@hartwellpartners.co.uk, THEN OPEN ────────────\n");
  console.log(`A) Onward broker SET + fee (pending)   → Professionals card + Fees card   ${base}/${A}`);
  console.log(`B) Completed, onward broker fee (received) → completions + analytics       ${base}/${B}`);
  console.log(`C) Buying onward, NO onward broker     → "Add seller's onward broker" box   ${base}/${C}`);
  console.log(`D) Exchanged, referred but no fee      → revenue-at-risk candidate          ${base}/${D}`);
  console.log(`\nAnalytics: http://localhost:3001/agent/analytics   Completions: http://localhost:3001/agent/completions\n`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
