// One-shot: set each Boardwalk prod demo file to its TRUE stage, so the milestone
// progress (stepper + % + hub bucket) matches the activity narrative. The first
// seed naively completed the earliest N milestones, which left every file reading
// as "searches". This re-initialises each file's milestones for its tenure +
// purchase type (fixes the blank "Tenure / Purchase type" too) and completes the
// right steps for its stage, with lifelike spread dates + varied confirmers
// (agent / solicitor / client-via-portal), mirroring lib/services/demo-sale.ts.
//
// Writes ONLY MilestoneCompletion + the tx tenure/purchaseType/status. No email.
// PROD-ONLY guard; DIRECT_URL. Idempotent (deletes + re-inits each run).
//
// Run: npx dotenv -e .env.production --override -- npx tsx scripts/fix-boardwalk-milestones.ts

import { PrismaClient, type Tenure, type PurchaseType } from "@prisma/client";
import { DIRECT_PREREQUISITES, RETIRED_ENQUIRY_CODES } from "@/lib/milestone-prerequisites";
import { computeAutoNrCodes } from "@/lib/milestone-auto-nr";
import { hasSolicitorClause } from "@/lib/updates-copy";

// Inline replica of initializeMilestoneCompletions (the real one pulls in
// `server-only` via its email imports, which can't load in a plain script).
// Creates one MilestoneCompletion per live def: not_required for the tenure/
// method auto-NR codes, else locked (the caller's state pass fixes available).
async function initMilestones(prisma: PrismaClient, transactionId: string, tenure: Tenure, purchaseType: PurchaseType, buyerRoundId: string | null) {
  const autoNr = computeAutoNrCodes(purchaseType as any, tenure as any);
  const defs = (await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }], select: { id: true, code: true, side: true } }))
    .filter((d) => !RETIRED_ENQUIRY_CODES.has(d.code));
  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => ({
      transactionId,
      milestoneDefinitionId: d.id,
      state: (autoNr.has(d.code) ? "not_required" : "locked") as any,
      buyerRoundId: d.side === "purchaser" ? buyerRoundId : null,
    })),
  });
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } });
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);

type Mode = { kind: "fraction"; fraction: number } | { kind: "ready" } | { kind: "exchanged" } | { kind: "completed" };
type Target = { match: string; tenure: Tenure; purchaseType: PurchaseType; ageDays: number; mode: Mode };

const TARGETS: Target[] = [
  { match: "Bedminster", tenure: "freehold", purchaseType: "mortgage", ageDays: 6, mode: { kind: "fraction", fraction: 0.05 } },
  { match: "Southville", tenure: "freehold", purchaseType: "mortgage", ageDays: 38, mode: { kind: "fraction", fraction: 0.4 } },
  { match: "Cotham Brow", tenure: "leasehold", purchaseType: "mortgage", ageDays: 24, mode: { kind: "fraction", fraction: 0.52 } },
  { match: "Chandos", tenure: "freehold", purchaseType: "mortgage", ageDays: 61, mode: { kind: "ready" } },
  { match: "Montpelier", tenure: "leasehold", purchaseType: "mortgage", ageDays: 92, mode: { kind: "exchanged" } },
  { match: "Totterdown", tenure: "freehold", purchaseType: "mortgage", ageDays: 140, mode: { kind: "completed" } },
];

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (!dbUrl.includes("gmkfustgwipgihpmpjpr")) { console.error("REFUSING: not PROD."); process.exit(1); }
  if (dbUrl.includes("etidawkbqctarmsdjoxp")) { console.error("REFUSING: staging."); process.exit(1); }
  console.log("== Fix Boardwalk milestones (LIVE PROD) ==\n");

  const agency = await prisma.agency.findFirst({ where: { name: "Boardwalk Property Co" }, select: { id: true } });
  const user = await prisma.user.findUnique({ where: { email: "millie@boardwalkpropertyco.com" }, select: { id: true } });
  if (!agency || !user) { console.error("agency/user missing"); process.exit(1); }

  for (const t of TARGETS) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: { agencyId: agency.id, propertyAddress: { contains: t.match } },
      select: { id: true, propertyAddress: true, activeBuyerRoundId: true, vendorSolicitorFirmId: true, vendorSolicitorContactId: true, purchaserSolicitorFirmId: true, purchaserSolicitorContactId: true },
    });
    if (!tx) { console.log(`  ! no file "${t.match}"`); continue; }

    const contacts = await prisma.contact.findMany({ where: { propertyTransactionId: tx.id, roleType: { in: ["vendor", "purchaser"] } }, select: { id: true, roleType: true } });
    const vendorId = contacts.find((c) => c.roleType === "vendor")?.id ?? null;
    const purchaserId = contacts.find((c) => c.roleType === "purchaser")?.id ?? null;

    // tenure + purchase type (+ status for completed)
    await prisma.propertyTransaction.update({
      where: { id: tx.id },
      data: { tenure: t.tenure, purchaseType: t.purchaseType, ...(t.mode.kind === "completed" ? { status: "completed" } : {}) },
    });

    // fresh milestones for this tenure/method
    await prisma.milestoneCompletion.deleteMany({ where: { transactionId: tx.id } });
    await initMilestones(prisma, tx.id, t.tenure, t.purchaseType, tx.activeBuyerRoundId ?? null);

    const rows = await prisma.milestoneCompletion.findMany({
      where: { transactionId: tx.id },
      select: { id: true, state: true, milestoneDefinition: { select: { code: true, side: true, orderIndex: true } } },
    });
    const nrCodes = new Set(rows.filter((r) => r.state === "not_required").map((r) => r.milestoneDefinition?.code).filter(Boolean) as string[]);
    const eligible = rows
      .filter((r) => r.milestoneDefinition && r.state !== "not_required" && !POST_EXCHANGE.has(r.milestoneDefinition.code))
      .map((r) => ({ id: r.id, code: r.milestoneDefinition!.code, side: r.milestoneDefinition!.side, orderIndex: r.milestoneDefinition!.orderIndex }));

    // which eligible steps are complete for this stage
    const bySide: Record<string, typeof eligible> = {};
    for (const e of eligible) (bySide[e.side] ??= []).push(e);
    const completed: typeof eligible = [];
    const completeAll = t.mode.kind !== "fraction";
    for (const list of Object.values(bySide)) {
      list.sort((a, b) => a.orderIndex - b.orderIndex);
      completed.push(...(completeAll ? list : list.slice(0, Math.floor(list.length * t.mode.fraction))));
    }
    const completedCodes = new Set(completed.map((c) => c.code));

    // apply completions, oldest-first, spread dates + varied confirmers
    completed.sort((a, b) => a.orderIndex - b.orderIndex);
    const span = Math.max(t.ageDays - 2, 2);
    for (let i = 0; i < completed.length; i++) {
      const c = completed[i];
      const offset = Math.round(span - (i / Math.max(completed.length - 1, 1)) * (span - 2));
      let channel = i % 4 === 1 ? "solicitor" : i % 4 === 3 ? "portal" : "agent";
      if (channel === "solicitor" && !hasSolicitorClause(c.code)) channel = "agent";
      let attr: Record<string, unknown>;
      if (channel === "solicitor" && (tx.vendorSolicitorFirmId || tx.purchaserSolicitorFirmId)) {
        attr = c.side === "purchaser"
          ? { completedById: null, confirmedBySolicitorFirmId: tx.purchaserSolicitorFirmId, confirmedBySolicitorContactId: tx.purchaserSolicitorContactId }
          : { completedById: null, confirmedBySolicitorFirmId: tx.vendorSolicitorFirmId, confirmedBySolicitorContactId: tx.vendorSolicitorContactId };
      } else if (channel === "portal" && (purchaserId || vendorId)) {
        attr = { completedById: null, confirmedByPortal: true, confirmedByContactId: c.side === "purchaser" ? (purchaserId ?? vendorId) : vendorId };
      } else {
        attr = { completedById: user.id };
      }
      await prisma.milestoneCompletion.update({ where: { id: c.id }, data: { state: "complete", completedAt: daysAgo(Math.max(1, offset)), ...attr } });
    }

    // post-exchange steps for exchanged/completed
    const markComplete = async (codes: string[], dayOffsetBase: number) => {
      for (let k = 0; k < codes.length; k++) {
        const row = rows.find((r) => r.milestoneDefinition?.code === codes[k]);
        if (row) await prisma.milestoneCompletion.update({ where: { id: row.id }, data: { state: "complete", completedAt: daysAgo(Math.max(1, dayOffsetBase - k * 2)), completedById: user.id } });
      }
    };
    if (t.mode.kind === "exchanged") await markComplete(["VM19", "PM26"], Math.floor(t.ageDays / 4));
    if (t.mode.kind === "completed") await markComplete(["VM19", "PM26", "VM20", "PM27"], Math.floor(t.ageDays / 3));

    // coherent states for the rest: available when prereqs met, else locked
    const availableIds: string[] = [], lockedIds: string[] = [];
    const postCompleted = t.mode.kind === "exchanged" ? new Set(["VM19", "PM26"]) : t.mode.kind === "completed" ? new Set(["VM19", "PM26", "VM20", "PM27"]) : new Set<string>();
    for (const r of rows) {
      const code = r.milestoneDefinition?.code;
      if (!code || r.state === "not_required") continue;
      if (completedCodes.has(code) || postCompleted.has(code)) continue;
      const prereqs = DIRECT_PREREQUISITES[code] ?? [];
      const ready = prereqs.every((p) => completedCodes.has(p) || postCompleted.has(p) || nrCodes.has(p));
      (ready ? availableIds : lockedIds).push(r.id);
    }
    if (availableIds.length) await prisma.milestoneCompletion.updateMany({ where: { id: { in: availableIds } }, data: { state: "available" } });
    if (lockedIds.length) await prisma.milestoneCompletion.updateMany({ where: { id: { in: lockedIds } }, data: { state: "locked" } });

    console.log(`• ${tx.propertyAddress}`);
    console.log(`    ${t.tenure}/${t.purchaseType} | mode=${t.mode.kind} | completed ${completed.length}${postCompleted.size ? " + " + postCompleted.size + " post-exchange" : ""} | available ${availableIds.length} | locked ${lockedIds.length}`);
  }
  console.log("\nDone.");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
