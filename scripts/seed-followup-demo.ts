// DEV seed: files that show the "email your conveyancer" follow-up in each of
// its states, so Ellis can see them on staging. ADDITIVE, staging only.
//
// Run: npx dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json scripts/seed-followup-demo.ts
//
// Delete once the follow-up sender is signed off.

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";

const AGENT_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER = "ellisaskey+followup@googlemail.com";
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

type Tone = "calm" | "check_in" | "behind";

function daysAgo(n: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - n);
  x.setHours(10, 0, 0, 0);
  return x;
}

let agentId = "";
let agencyId = "";
let idByCode = new Map<string, string>();
let firmId = "";

async function initMilestones(transactionId: string, tenure: "freehold" | "leasehold", purchaseType: "mortgage" | "cash_buyer") {
  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNrCodes = computeAutoNrCodes(purchaseType, tenure);
  const available = new Set<string>();
  for (const def of defs) {
    if (autoNrCodes.has(def.code) || EXCHANGE_GATE_CODES.has(def.code)) continue;
    const prereqs = DIRECT_PREREQUISITES[def.code] ?? [];
    if (prereqs.length === 0 || prereqs.every((p) => autoNrCodes.has(p))) available.add(def.code);
  }
  await prisma.milestoneCompletion.createMany({
    data: defs.map((def) => {
      const isNr = autoNrCodes.has(def.code);
      const state = (isNr ? "not_required" : available.has(def.code) ? "available" : "locked") as "not_required" | "available" | "locked";
      return { transactionId, milestoneDefinitionId: def.id, state, notRequiredReason: isNr ? "Auto" : null, completedById: agentId };
    }),
  });
}

async function createFile(address: string): Promise<{ txId: string; buyerToken: string; sellerToken: string }> {
  const buyerToken = randomBytes(24).toString("base64url");
  const sellerToken = randomBytes(24).toString("base64url");
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: address,
      agencyId,
      agentUserId: agentId,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 425_000_00,
      createdAt: daysAgo(40),
      lastActivityAt: daysAgo(3),
    },
    select: { id: true },
  });
  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: tx.id, name: "Morgan Reed", email: BURNER, roleType: "vendor", portalToken: sellerToken },
      { propertyTransactionId: tx.id, name: "Jordan Blake", email: BURNER, roleType: "purchaser", portalToken: buyerToken },
    ],
  });
  await initMilestones(tx.id, "freehold", "mortgage");
  return { txId: tx.id, buyerToken, sellerToken };
}

async function setSolicitor(txId: string, side: "vendor" | "purchaser", email: string | null) {
  const contact = await prisma.solicitorContact.create({
    data: { firmId, name: side === "vendor" ? "Sara Whitfield" : "Tom Marsh", email },
    select: { id: true },
  });
  await prisma.propertyTransaction.update({
    where: { id: txId },
    data: side === "vendor"
      ? { vendorSolicitorFirmId: firmId, vendorSolicitorContactId: contact.id }
      : { purchaserSolicitorFirmId: firmId, purchaserSolicitorContactId: contact.id },
  });
}

async function complete(txId: string, codes: string[], at: Date = daysAgo(20)) {
  for (const code of codes) {
    const id = idByCode.get(code);
    if (!id) continue;
    await prisma.milestoneCompletion.updateMany({ where: { transactionId: txId, milestoneDefinitionId: id }, data: { state: "complete", completedAt: at, completedById: agentId } });
  }
}

async function setAvailable(txId: string, code: string) {
  const id = idByCode.get(code);
  if (id) await prisma.milestoneCompletion.updateMany({ where: { transactionId: txId, milestoneDefinitionId: id }, data: { state: "available" } });
}

// Force the target follow-up step into a tone by dating its reminder anchor.
async function forceTone(txId: string, stepCode: string, tone: Tone) {
  const rule = await prisma.reminderRule.findFirst({ where: { targetMilestoneCode: stepCode, isActive: true }, select: { graceDays: true, anchorMilestone: { select: { code: true } } } });
  const grace = rule?.graceDays ?? 7;
  const anchorCode = rule?.anchorMilestone?.code ?? null;
  const anchorDate = tone === "calm" ? new Date() : tone === "behind" ? daysAgo(grace + 25) : daysAgo(Math.max(0, grace - 1));
  if (anchorCode) await complete(txId, [anchorCode], anchorDate);
  await setAvailable(txId, stepCode);
}

const BUYER_BEFORE_PM8 = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM7"];
const SELLER_BEFORE_VM7 = ["VM1", "VM2", "VM3", "VM4", "VM5", "VM6"];

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to seed on PRODUCTION");
  const emily = await prisma.user.findUnique({ where: { email: AGENT_EMAIL }, select: { id: true, agencyId: true } });
  if (!emily?.agencyId) throw new Error("No agent/agency");
  agentId = emily.id;
  agencyId = emily.agencyId;
  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  idByCode = new Map(defs.map((d) => [d.code, d.id]));
  const firm = await prisma.solicitorFirm.upsert({ where: { name: "Marsh & Whitfield (demo)" }, update: {}, create: { name: "Marsh & Whitfield (demo)" }, select: { id: true } });
  firmId = firm.id;

  const out: string[] = [];

  // 1-3: Buyer, searches (PM8), each tone.
  for (const tone of ["calm", "check_in", "behind"] as Tone[]) {
    const f = await createFile(`${tone === "calm" ? 2 : tone === "check_in" ? 4 : 6} Searches Way, Testfield, TF1 ${tone === "calm" ? 1 : tone === "check_in" ? 2 : 3}AA`);
    await setSolicitor(f.txId, "purchaser", "tom.marsh@demo-conveyancers.test");
    await setSolicitor(f.txId, "vendor", "sara.whitfield@demo-conveyancers.test");
    await complete(f.txId, BUYER_BEFORE_PM8);
    await forceTone(f.txId, "PM8", tone);
    out.push(`BUYER searches (${tone.toUpperCase()}):  /portal/${f.buyerToken}`);
  }

  // 4: Buyer, enquiries with the OTHER side (waiting on the other side).
  {
    const f = await createFile("8 Enquiry Court, Testfield, TF2 4AA");
    await setSolicitor(f.txId, "purchaser", "tom.marsh@demo-conveyancers.test");
    await setSolicitor(f.txId, "vendor", "sara.whitfield@demo-conveyancers.test");
    await complete(f.txId, [...BUYER_BEFORE_PM8, "PM8", "PM13", "PM14"]);
    await prisma.enquiryTracker.create({ data: { transactionId: f.txId, currentlyWith: "seller_solicitor", openedAt: daysAgo(4) } });
    out.push(`BUYER enquiries (OTHER SIDE):  /portal/${f.buyerToken}`);
  }

  // 5: Buyer, enquiries with THEIR solicitor (nudge on enquiries).
  {
    const f = await createFile("9 Enquiry Court, Testfield, TF2 5AA");
    await setSolicitor(f.txId, "purchaser", "tom.marsh@demo-conveyancers.test");
    await setSolicitor(f.txId, "vendor", "sara.whitfield@demo-conveyancers.test");
    await complete(f.txId, [...BUYER_BEFORE_PM8, "PM8", "PM13", "PM14"]);
    await prisma.enquiryTracker.create({ data: { transactionId: f.txId, currentlyWith: "buyer_solicitor", openedAt: daysAgo(20), escalatedAt: daysAgo(2) } });
    out.push(`BUYER enquiries (WITH SOLICITOR, behind):  /portal/${f.buyerToken}`);
  }

  // 6: Seller, draft contract pack (VM7), check-in.
  {
    const f = await createFile("14 Vendor Lane, Testfield, TF3 6AA");
    await setSolicitor(f.txId, "vendor", "sara.whitfield@demo-conveyancers.test");
    await setSolicitor(f.txId, "purchaser", "tom.marsh@demo-conveyancers.test");
    await complete(f.txId, SELLER_BEFORE_VM7);
    await forceTone(f.txId, "VM7", "check_in");
    out.push(`SELLER draft pack (CHECK-IN):  /portal/${f.sellerToken}`);
  }

  // 7: Buyer, searches, but no conveyancer email on file (add-email prompt).
  {
    const f = await createFile("3 No-Email Row, Testfield, TF4 7AA");
    await setSolicitor(f.txId, "purchaser", null); // firm on file, email missing
    await setSolicitor(f.txId, "vendor", "sara.whitfield@demo-conveyancers.test");
    await complete(f.txId, BUYER_BEFORE_PM8);
    await forceTone(f.txId, "PM8", "check_in");
    out.push(`BUYER no conveyancer email (ADD PROMPT):  /portal/${f.buyerToken}`);
  }

  console.log("\n=== Follow-up sender demo files (staging) ===");
  for (const line of out) console.log("  " + line);
  console.log("\n  Prefix with http://localhost:3000 (or :3001)\n");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
