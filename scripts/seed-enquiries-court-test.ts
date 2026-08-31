// One-shot DEV seed: a single ACTIVE file parked at "enquiries NOT raised" so
// Ellis can test the hero whose-court chip.
//
// State it lands in:
//   - Contract pack issued (PM13) + searches ordered (PM8) complete
//   - EnquiryRaiseChase OPEN  -> hero shows the read-only "Buyer's sol · Raising" pill
//   - PM14 "enquiries raised" left AVAILABLE -> click it to open the tracker and
//     turn the pill into the live seller <-> buyer slider.
//
// ADDITIVE: creates one transaction + two contacts + one raise-chase row and
// nothing else. Refuses to run against production. Safe on staging.
//
// Run (staging, from repo root):
//   npx dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json \
//     scripts/seed-enquiries-court-test.ts
//
// Delete criteria: throwaway; remove once the whose-court chip is signed off.

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const AGENT_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER = "ellisaskey+enqtest@googlemail.com";
const ADDRESS = "8 Enquiry Court, Testfield, TF1 2AB";
const PRICE_GBP = 425_000;
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

// Purchaser chain through searches ordered (PM8) + contract pack issued (PM13).
// PM14's only prereq is PM7, so leaving PM14 available is enough to click it.
const PURCHASER_DONE = ["PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7", "PM8", "PM13"];
const VENDOR_DONE = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "VM8"];

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
      const state = (isNr ? "not_required" : isAvail ? "available" : "locked") as
        | "not_required"
        | "available"
        | "locked";
      return {
        transactionId,
        milestoneDefinitionId: def.id,
        state,
        notRequiredReason: isNr ? "Auto-set at file creation" : null,
        completedById: createdById,
        createdAt: now,
      };
    }),
  });
}

function daysAgo(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x;
}

async function main() {
  const isProd = process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr");
  if (isProd) throw new Error("Refusing to seed a test file on PRODUCTION");
  console.log("=== Seed enquiries whose-court test file (staging) ===");

  const agent = await prisma.user.findUnique({
    where: { email: AGENT_EMAIL },
    select: { id: true, name: true, agencyId: true },
  });
  if (!agent?.agencyId) throw new Error(`No agent/agency for ${AGENT_EMAIL} on this DB`);

  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  const idByCode = new Map(defs.map((d) => [d.code, d.id]));

  const purchaserToken = randomBytes(24).toString("base64url");
  const vendorToken = randomBytes(24).toString("base64url");

  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: ADDRESS,
      agencyId: agent.agencyId,
      agentUserId: agent.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: PRICE_GBP * 100,
      createdAt: daysAgo(35),
      lastActivityAt: daysAgo(8),
    },
    select: { id: true },
  });

  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: tx.id, name: "Morgan Reed", email: BURNER, roleType: "vendor", portalToken: vendorToken },
      { propertyTransactionId: tx.id, name: "Jordan Blake", email: BURNER, roleType: "purchaser", portalToken: purchaserToken },
    ],
  });

  await initMilestones(tx.id, "freehold", "mortgage", agent.id);

  const markComplete = async (codes: string[]) => {
    for (const code of codes) {
      const defId = idByCode.get(code);
      if (!defId) continue;
      await prisma.milestoneCompletion.updateMany({
        where: { transactionId: tx.id, milestoneDefinitionId: defId },
        data: { state: "complete", completedAt: daysAgo(10), completedById: agent.id },
      });
    }
  };
  await markComplete(PURCHASER_DONE);
  await markComplete(VENDOR_DONE);

  // Leave "enquiries raised" clickable.
  const pm14 = idByCode.get("PM14");
  if (pm14) {
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: tx.id, milestoneDefinitionId: pm14 },
      data: { state: "available" },
    });
  }

  // Raise-chase OPEN (searches ordered 8 days ago) -> hero pre-raise pill.
  await prisma.enquiryRaiseChase.create({ data: { transactionId: tx.id, openedAt: daysAgo(8) } });

  console.log(`\n✓ Created file ${tx.id}`);
  console.log(`  ${ADDRESS} · £${PRICE_GBP.toLocaleString()} · active · enquiries not raised yet`);
  console.log(`\n  Local link: http://localhost:3000/agent/transactions/${tx.id}`);
  console.log(`  (log in as ${AGENT_EMAIL} or as admin)\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
