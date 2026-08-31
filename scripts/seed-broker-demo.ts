// DEV seed: files that show the mortgage broker card in each of its states,
// so Ellis can click through them on staging. ADDITIVE, staging only.
//
// Run: npx dotenv -e .env --override -- npx ts-node --transpile-only --project tsconfig.scripts.json scripts/seed-broker-demo.ts
//
// Delete once the broker card is signed off.

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";
import { resolveBrokerServiceType } from "../lib/services/broker-card";
import { outwardCode } from "../lib/utils/address";

const AGENT_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER = "ellisaskey+broker@googlemail.com";
const EXCHANGE_GATE_CODES = new Set(["VM18", "PM25"]);

function daysAgo(n: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - n);
  x.setHours(10, 0, 0, 0);
  return x;
}

let agentId = "";
let agencyId = "";
let idByCode = new Map<string, string>();

async function initMilestones(transactionId: string, purchaseType: "mortgage" | "cash_buyer") {
  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const autoNrCodes = computeAutoNrCodes(purchaseType, "freehold");
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

async function complete(txId: string, codes: string[], at: Date = daysAgo(15)) {
  for (const code of codes) {
    const id = idByCode.get(code);
    if (!id) continue;
    await prisma.milestoneCompletion.updateMany({ where: { transactionId: txId, milestoneDefinitionId: id }, data: { state: "complete", completedAt: at, completedById: agentId } });
  }
}

async function createFile(opts: {
  address: string;
  serviceType: "self_managed" | "outsourced";
  purchaseType: "mortgage" | "cash_buyer";
  brokerFirmId?: string | null;
  brokerContactId?: string | null;
  purchaserBrokerReferral?: boolean;
  buyerName?: string;
  brokerCallbackRequestedAt?: Date | null;
}): Promise<{ txId: string; buyerToken: string; buyerContactId: string }> {
  const buyerToken = randomBytes(24).toString("base64url");
  const sellerToken = randomBytes(24).toString("base64url");
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: opts.address,
      agencyId,
      agentUserId: agentId,
      assignedUserId: opts.serviceType === "outsourced" ? agentId : null,
      progressedBy: opts.serviceType === "outsourced" ? "progressor" : "agent",
      serviceType: opts.serviceType,
      status: "active",
      tenure: "freehold",
      purchaseType: opts.purchaseType,
      purchasePrice: 425_000_00,
      brokerFirmId: opts.brokerFirmId ?? null,
      brokerContactId: opts.brokerContactId ?? null,
      purchaserBrokerReferral: opts.purchaserBrokerReferral ?? false,
      createdAt: daysAgo(30),
      lastActivityAt: daysAgo(2),
    },
    select: { id: true },
  });
  await prisma.contact.create({
    data: { propertyTransactionId: tx.id, name: "Morgan Reed", email: BURNER, phone: "07700 900333", roleType: "vendor", portalToken: sellerToken },
  });
  const buyer = await prisma.contact.create({
    data: {
      propertyTransactionId: tx.id,
      name: opts.buyerName ?? "Jordan Blake",
      email: BURNER,
      phone: "07700 900118",
      roleType: "purchaser",
      portalToken: buyerToken,
      brokerCallbackRequestedAt: opts.brokerCallbackRequestedAt ?? null,
    },
    select: { id: true },
  });
  await initMilestones(tx.id, opts.purchaseType);
  return { txId: tx.id, buyerToken, buyerContactId: buyer.id };
}

const INSTRUCTED = ["VM1", "VM2", "PM1", "PM2"];            // card window: instructed, PM5 not done
const PAST_APPLICATION = [...INSTRUCTED, "PM3", "PM4", "PM5"]; // PM5 done -> card hidden

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to seed on PRODUCTION");
  const emily = await prisma.user.findUnique({ where: { email: AGENT_EMAIL }, select: { id: true, agencyId: true } });
  if (!emily?.agencyId) throw new Error("No agent/agency");
  agentId = emily.id;
  agencyId = emily.agencyId;
  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  idByCode = new Map(defs.map((d) => [d.code, d.id]));

  // Agent's own broker (BrokerFirm + contact).
  let brokerFirm = await prisma.brokerFirm.findFirst({ where: { name: "Ashcroft Financial (demo)" }, select: { id: true } });
  if (!brokerFirm) brokerFirm = await prisma.brokerFirm.create({ data: { name: "Ashcroft Financial (demo)" }, select: { id: true } });
  let brokerContact = await prisma.brokerContact.findFirst({ where: { firmId: brokerFirm.id }, select: { id: true } });
  if (!brokerContact) brokerContact = await prisma.brokerContact.create({ data: { firmId: brokerFirm.id, name: "Priya Ashcroft", email: BURNER, phone: "07700 900450" }, select: { id: true } });

  // TSP default broker (ProviderFirm). Reuse an existing default if there is one.
  let tsp = await prisma.providerFirm.findFirst({ where: { kind: "mortgage_broker", tspDefault: true }, select: { id: true } });
  if (!tsp) tsp = await prisma.providerFirm.create({ data: { kind: "mortgage_broker", tspDefault: true, active: true, name: "Beacon Mortgage Advice (demo)", email: BURNER }, select: { id: true } });

  const out: string[] = [];

  // 1: Agent's own broker — prompt.
  {
    const f = await createFile({ address: "1 Broker Way, Testfield, TF1 1AA", serviceType: "self_managed", purchaseType: "mortgage", brokerFirmId: brokerFirm.id, brokerContactId: brokerContact.id });
    await complete(f.txId, INSTRUCTED);
    out.push(`AGENT broker — prompt:            /portal/${f.buyerToken}`);
  }

  // 2: TSP default broker — prompt (outsourced, no agent broker).
  {
    const f = await createFile({ address: "2 Broker Way, Testfield, TF1 2AA", serviceType: "outsourced", purchaseType: "mortgage" });
    await complete(f.txId, INSTRUCTED);
    out.push(`TSP broker — prompt (outsourced): /portal/${f.buyerToken}`);
  }

  // 3: Requested / acknowledgment state (agent broker already requested).
  {
    const f = await createFile({ address: "3 Broker Way, Testfield, TF1 3AA", serviceType: "self_managed", purchaseType: "mortgage", brokerFirmId: brokerFirm.id, brokerContactId: brokerContact.id, brokerCallbackRequestedAt: daysAgo(1) });
    await complete(f.txId, INSTRUCTED);
    out.push(`REQUESTED — acknowledgment card:  /portal/${f.buyerToken}`);
  }

  // 4: Team entry, agent's broker confirmed (card hidden: PM5 done + referral ticked).
  {
    const f = await createFile({ address: "4 Broker Way, Testfield, TF1 4AA", serviceType: "self_managed", purchaseType: "mortgage", brokerFirmId: brokerFirm.id, brokerContactId: brokerContact.id, purchaserBrokerReferral: true });
    await complete(f.txId, PAST_APPLICATION);
    out.push(`TEAM entry (agent broker, no card):/portal/${f.buyerToken}`);
  }

  // 5: Team entry, TSP broker marked "won" (card hidden: PM5 done).
  {
    const f = await createFile({ address: "5 Broker Way, Testfield, TF1 5AA", serviceType: "outsourced", purchaseType: "mortgage", buyerName: "Sam Okafor" });
    await complete(f.txId, PAST_APPLICATION);
    const svc = await resolveBrokerServiceType();
    await prisma.quoteRequest.create({
      data: {
        transactionId: f.txId, contactId: f.buyerContactId, providerId: tsp.id, serviceTypeId: svc.id, kind: "mortgage_broker",
        contactMethod: "either", contactWindow: "anytime", urgency: "flexible",
        clientName: "Sam Okafor", clientEmail: BURNER, clientPhone: "07700 900118",
        propertyAddress: "5 Broker Way, Testfield, TF1 5AA", propertyPostcode: "TF1 5AA", propertyOutwardCode: outwardCode("TF1 5AA") ?? "TF1",
        status: "won", submittedAt: daysAgo(10),
      },
    });
    out.push(`TEAM entry (TSP broker won, no card):/portal/${f.buyerToken}`);
  }

  // 6: Cash buyer — card should NOT appear (negative check).
  {
    const f = await createFile({ address: "6 Broker Way, Testfield, TF1 6AA", serviceType: "outsourced", purchaseType: "cash_buyer" });
    await complete(f.txId, INSTRUCTED);
    out.push(`CASH buyer — NO card expected:    /portal/${f.buyerToken}`);
  }

  // 7: Self-managed, no agent broker — card should NOT appear (negative check).
  {
    const f = await createFile({ address: "7 Broker Way, Testfield, TF1 7AA", serviceType: "self_managed", purchaseType: "mortgage" });
    await complete(f.txId, INSTRUCTED);
    out.push(`SELF-MANAGED no broker — NO card: /portal/${f.buyerToken}`);
  }

  console.log("\n=== Mortgage broker card demo files (staging) ===");
  for (const line of out) console.log("  " + line);
  console.log("\n  Prefix each with http://localhost:3001 (dev server against staging)\n");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
