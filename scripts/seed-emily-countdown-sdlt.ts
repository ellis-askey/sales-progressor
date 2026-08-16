// One-shot demo seed: add a SINGLE exchanged-purchase file to Emily's account so
// Ellis can view the completion countdown (post-exchange) and the stamp-duty
// estimate (buyer, £650k) on one portal link.
//
// ADDITIVE — creates one transaction + its two contacts and nothing else. It
// never deletes or wipes, so it is safe to run against staging AND production.
// Only ever touches emily@hartwellpartners.co.uk's agency.
//
// Run (staging):
//   DATABASE_URL="<staging url>" DIRECT_URL="<staging direct url>" \
//     npx ts-node --project tsconfig.scripts.json scripts/seed-emily-countdown-sdlt.ts
//
// Delete criteria: remove this script once the countdown + SDLT features are
// signed off (SCRIPTS_REGISTRY entry has the ticket).

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const EMILY_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER_EMAIL = "ellisaskey+countdown@googlemail.com";
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

const ADDRESS = "9 Canynge Road, Clifton, Bristol, BS8 3JX";
const PRICE_GBP = 650_000;
const DAYS_SINCE_EXCHANGE = 3;   // exchanged 3 days ago
const DAYS_TO_COMPLETION = 14;   // completion 14 days out

// Visible purchaser + vendor codes to mark complete for a freehold/mortgage file
// that has exchanged (skips leasehold-only + completion codes).
const PURCHASER_DONE = ["PM1","PM2","PM3","PM4","PM5","PM6","PM11","PM9","PM10","PM7","PM8","PM13","PM14","PM20","PM21","PM22","PM23","PM24","PM25","PM26"];
const VENDOR_DONE    = ["VM1","VM2","VM3","VM4","VM5","VM6","VM7","VM10","VM21","VM16","VM17","VM18","VM19"];
const EXCHANGE_CODES = new Set(["PM26", "VM19"]);

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
  // Brand-new transaction → no existing completion rows, so a plain createMany
  // is safe (the old compound-unique upsert no longer matches the schema).
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

async function main() {
  const isProd = process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr");
  console.log(`\n=== Seed Emily countdown + SDLT demo file (${isProd ? "PRODUCTION" : "staging"}) ===`);
  console.log("Target DB:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@"));

  const emily = await prisma.user.findUnique({ where: { email: EMILY_EMAIL }, select: { id: true, name: true, agencyId: true } });
  if (!emily) throw new Error(`No user ${EMILY_EMAIL} on this DB`);
  if (!emily.agencyId) throw new Error(`${EMILY_EMAIL} has no agencyId`);
  console.log(`Emily: ${emily.name} [${emily.id}]`);

  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(defs.map((d) => [d.code, d.id]));

  const exchangeDate  = daysAgo(DAYS_SINCE_EXCHANGE);
  const completionDate = daysAhead(DAYS_TO_COMPLETION);
  const purchaserToken = randomBytes(24).toString("base64url");
  const vendorToken    = randomBytes(24).toString("base64url");

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: ADDRESS,
      agencyId: emily.agencyId,
      agentUserId: emily.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: PRICE_GBP * 100,
      expectedExchangeDate: exchangeDate,
      completionDate,
      createdAt: daysAgo(70),
      lastActivityAt: exchangeDate,
    },
    select: { id: true },
  });

  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: tx.id, name: "Jonathan Pike", email: BURNER_EMAIL, roleType: "vendor", portalToken: vendorToken },
      { propertyTransactionId: tx.id, name: "Robert Hale",   email: BURNER_EMAIL, roleType: "purchaser", portalToken: purchaserToken },
    ],
  });

  await initMilestones(tx.id, "freehold", "mortgage", emily.id);

  const markComplete = async (codes: string[]) => {
    for (const code of codes) {
      const defId = idByCode.get(code);
      if (!defId) continue;
      const completedAt = EXCHANGE_CODES.has(code) ? exchangeDate : daysAgo(DAYS_SINCE_EXCHANGE + 5);
      await prisma.milestoneCompletion.updateMany({
        where: { transactionId: tx.id, milestoneDefinitionId: defId },
        data: { state: "complete", completedAt, completedById: emily.id, eventDate: EXCHANGE_CODES.has(code) ? exchangeDate : null },
      });
    }
  };
  await markComplete(PURCHASER_DONE);
  await markComplete(VENDOR_DONE);

  console.log(`\n✓ Created file ${tx.id}`);
  console.log(`  ${ADDRESS} · £${PRICE_GBP.toLocaleString()} · exchanged ${DAYS_SINCE_EXCHANGE}d ago · completing in ${DAYS_TO_COMPLETION}d`);
  console.log(`\n  BUYER portal (countdown + stamp duty): /portal/${purchaserToken}`);
  console.log(`  SELLER portal (countdown only):         /portal/${vendorToken}`);
  console.log(`\n  Staging: https://salesprogressor-git-staging-ellis-askeys-projects.vercel.app/portal/${purchaserToken}`);
  console.log(`  Prod:    https://portal.thesalesprogressor.co.uk/portal/${purchaserToken}\n`);
}

main().then(() => prisma.$disconnect()).catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
