// STAGING ONLY. Demonstrates the exchange-date work from
// docs/active/three-notes-distilled-2026-08-26.md (Note 1):
//
//   A/B/C  A "moving" file whose expectedExchangeDate is the live phase-aware
//          prediction (not the createdAt+84 placeholder), plus a hub-wide
//          backfill so every active file shows a realistic self-adjusting date.
//   D      A "stuck" file: exchange date passed, no milestone confirmed since,
//          so it surfaces as an amber overdue item on the hub and shows the
//          revise-date banner (with the both-parties hard block) on the file.
//
// Guarded against production. One-shot demo — delete after the walk-through.
//
// Run: npx prisma generate && npx dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-overdue-exchange-demo.ts

import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";
import { refreshExpectedExchangeDate, isExchangeOverdueStuck } from "../lib/services/exchange-prediction";

const AGENT_EMAIL = "emily@hartwellpartners.co.uk";
const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d; }
function fmt(d: Date | null) {
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
}

// Build the initial milestone rows for a fresh file: auto-NR codes marked
// not_required, first-available codes "available", the rest "locked".
function initialRows(defs: { id: string; code: string }[], autoNr: Set<string>, agentId: string) {
  const avail = new Set<string>();
  for (const d of defs) {
    if (autoNr.has(d.code)) continue;
    const prereqs = DIRECT_PREREQUISITES[d.code] ?? [];
    if (prereqs.length === 0 || prereqs.every((x) => autoNr.has(x))) avail.add(d.code);
  }
  return defs.map((d) => {
    const nr = autoNr.has(d.code);
    return {
      milestoneDefinitionId: d.id,
      state: (nr ? "not_required" : avail.has(d.code) ? "available" : "locked") as "not_required" | "available" | "locked",
      notRequiredReason: nr ? "Auto" : null,
      completedById: agentId,
    };
  });
}

// Pick the first `fraction` of each side's applicable (non-NR, non-post-exchange)
// codes to mark complete — gives a coherent "this far through" file.
function pickComplete(
  defs: { code: string; side: string }[],
  autoNr: Set<string>,
  fraction: number,
): Set<string> {
  const bySide: Record<string, string[]> = {};
  for (const d of defs) {
    if (autoNr.has(d.code) || POST_EXCHANGE.has(d.code)) continue;
    (bySide[d.side] ??= []).push(d.code);
  }
  const chosen = new Set<string>();
  for (const codes of Object.values(bySide)) {
    const n = Math.floor(codes.length * fraction);
    codes.slice(0, n).forEach((c) => chosen.add(c));
  }
  return chosen;
}

async function seedFile(opts: {
  address: string;
  agencyId: string;
  agentId: string;
  createdDaysAgo: number;
  completeFraction: number;
  completedDaysAgo: number;
  defs: { id: string; code: string; side: string }[];
}): Promise<string> {
  const autoNr = computeAutoNrCodes("mortgage", "freehold");
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: opts.address,
      agencyId: opts.agencyId,
      agentUserId: opts.agentId,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 42500000,
      createdAt: daysAgo(opts.createdDaysAgo),
      lastActivityAt: daysAgo(opts.completedDaysAgo),
    },
    select: { id: true },
  });

  await prisma.milestoneCompletion.createMany({
    data: initialRows(opts.defs, autoNr, opts.agentId).map((r) => ({ ...r, transactionId: tx.id })),
  });

  const chosen = pickComplete(opts.defs, autoNr, opts.completeFraction);
  const chosenDefIds = opts.defs.filter((d) => chosen.has(d.code)).map((d) => d.id);
  await prisma.milestoneCompletion.updateMany({
    where: { transactionId: tx.id, milestoneDefinitionId: { in: chosenDefIds } },
    data: { state: "complete", completedAt: daysAgo(opts.completedDaysAgo), completedById: opts.agentId },
  });

  return tx.id;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) {
    throw new Error("Refusing to run on PRODUCTION");
  }
  const emily = await prisma.user.findUnique({ where: { email: AGENT_EMAIL }, select: { id: true, agencyId: true } });
  if (!emily?.agencyId) throw new Error(`Agent ${AGENT_EMAIL} not found on this DB (expected on staging)`);

  const defs = await prisma.milestoneDefinition.findMany({
    orderBy: [{ side: "asc" }, { orderIndex: "asc" }],
    select: { id: true, code: true, side: true },
  });

  // ── Scenario A/B/C: backfill every active, not-yet-exchanged file so the hub
  //    shows the live prediction instead of the createdAt+84 placeholder. ──
  const active = await prisma.propertyTransaction.findMany({
    where: { status: "active", exchangedAt: null },
    select: { id: true },
  });
  let backfilled = 0;
  for (const t of active) {
    const wrote = await refreshExpectedExchangeDate(t.id).catch(() => null);
    if (wrote) backfilled++;
  }
  console.log(`Backfilled expectedExchangeDate on ${backfilled}/${active.length} active files.`);

  // ── Scenario A/B/C: a clean "moving" file (~55% through), then refresh so its
  //    date is the live prediction. ──
  const movingId = await seedFile({
    address: "8 Meadowbrook Rise, Demoford, DM4 4AB",
    agencyId: emily.agencyId, agentId: emily.id,
    createdDaysAgo: 40, completeFraction: 0.55, completedDaysAgo: 3,
    defs,
  });
  const movingPredicted = await refreshExpectedExchangeDate(movingId);

  // ── Scenario D: a "stuck" file — confirmed only long ago, exchange date now
  //    ~8 days past, so it's overdue AND quiet. We set expectedExchangeDate into
  //    the past directly (and do NOT refresh it), reproducing a real slip. ──
  const stuckId = await seedFile({
    address: "3 Stallpoint Gardens, Demoford, DM5 5CD",
    agencyId: emily.agencyId, agentId: emily.id,
    createdDaysAgo: 95, completeFraction: 0.75, completedDaysAgo: 22,
    defs,
  });
  const stuckPassed = daysAgo(8);
  await prisma.propertyTransaction.update({
    where: { id: stuckId },
    data: { expectedExchangeDate: stuckPassed },
  });

  // Verify the stuck file trips the detector the hub + banner both use.
  const stuckRow = await prisma.propertyTransaction.findUnique({
    where: { id: stuckId },
    select: {
      exchangedAt: true, expectedExchangeDate: true, overridePredictedDate: true,
      milestoneCompletions: {
        where: { state: "complete", completedAt: { not: null } },
        orderBy: { completedAt: "desc" }, take: 1, select: { completedAt: true },
      },
    },
  });
  const detect = isExchangeOverdueStuck({
    exchangedAt: stuckRow!.exchangedAt,
    expectedExchangeDate: stuckRow!.expectedExchangeDate,
    overridePredictedDate: stuckRow!.overridePredictedDate,
    lastMilestoneConfirmedAt: stuckRow!.milestoneCompletions[0]?.completedAt ?? null,
  });

  console.log("\n=== Exchange-date demo seeded (staging) ===");
  console.log(`\nScenario A/B/C — live self-adjusting date:`);
  console.log(`  Moving file predicted exchange: ${fmt(movingPredicted)}`);
  console.log(`  http://localhost:3001/agent/transactions/${movingId}`);
  console.log(`\nScenario D — overdue + stuck (amber on hub + revise banner on file):`);
  console.log(`  Exchange date set to ${fmt(stuckPassed)} (passed).`);
  console.log(`  Detector says stuck = ${detect.stuck} (expected: true)`);
  console.log(`  http://localhost:3001/agent/transactions/${stuckId}`);
  console.log(`\nHub (both should be visible — moving in the diary/pipeline, stuck in Needs attention):`);
  console.log(`  http://localhost:3001/agent/hub`);
  if (!detect.stuck) console.log("\n  WARNING: stuck file did not trip the detector — check the seed.");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e?.message ?? e); await prisma.$disconnect(); process.exit(1); });
