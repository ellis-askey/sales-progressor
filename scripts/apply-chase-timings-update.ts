// One-shot DB update: applies Ellis's reviewed chase-timing values to the
// 18 ReminderRule rows he marked as CHANGED in the spreadsheet at
// docs/active/chase-timings-review.xlsx (with later corrections to VM9,
// PM8, PM13 baked in via the (1).xlsx version Ellis confirmed).
//
// SAFE BY DESIGN:
//   - Force-loads .env.local with override BEFORE prisma import (defends
//     against shell-env DATABASE_URL pointing at prod — same defensive
//     pattern that caught the prod-contamination incident earlier)
//   - Hard-aborts if connected to production project ID
//   - Aborts if connected to anything other than the known staging ID
//   - Logs every before/after pair so the diff is reviewable
//   - Re-reads all 18 rows after the writes and asserts exact match
//
// PHASE A of the chase-timings-update plan.
// See: C:\Users\ellis\.claude\plans\and-anything-the-agents-glittery-scroll.md
//
// Run: npx tsx scripts/apply-chase-timings-update.ts

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { prisma } from "../lib/prisma";

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";

// The 18 updates Ellis specified. Source: chase-timings-review (1).xlsx,
// columns O (MY grace) and P (MY repeat), only rows where they differ from
// the current values.
const UPDATES: Array<{ code: string; grace: number; repeat: number; reason: string }> = [
  { code: "VM7",  grace: 5,  repeat: 4, reason: "NUDGE solicitor admin — repeat 3→4 to avoid double-chasing within a week" },
  { code: "VM8",  grace: 4,  repeat: 5, reason: "NUDGE solicitor admin — modest grace bump (3→4)" },
  { code: "VM9",  grace: 14, repeat: 7, reason: "Mgmt pack 2–4wk (corrected from 4–8) — chase 1 day 14 = typical min" },
  { code: "VM10", grace: 4,  repeat: 5, reason: "NUDGE cross-side — grace 3→4" },
  { code: "VM12", grace: 4,  repeat: 5, reason: "NUDGE solicitor admin" },
  { code: "VM13", grace: 5,  repeat: 5, reason: "Per Ellis's confirmation on new spreadsheet" },
  { code: "VM14", grace: 3,  repeat: 4, reason: "Per Ellis's confirmation on new spreadsheet" },
  { code: "VM15", grace: 5,  repeat: 5, reason: "Per Ellis's confirmation on new spreadsheet" },
  { code: "PM6",  grace: 10, repeat: 7, reason: "Valuation 1–2wk — chase 1 lands mid range (grace 7→10)" },
  { code: "PM7",  grace: 3,  repeat: 4, reason: "NUDGE cross-side — soften both (grace 2→3, repeat 3→4)" },
  { code: "PM8",  grace: 3,  repeat: 2, reason: "Searches ORDERED — fast step, ~4–5d from anchor PM7" },
  { code: "PM11", grace: 14, repeat: 7, reason: "NUDGE lender — repeat 5→7 (lenders slow)" },
  { code: "PM13", grace: 14, repeat: 7, reason: "Search RESULTS — 2–3wk wait; chase day 14, escalate day 28" },
  { code: "PM15", grace: 14, repeat: 5, reason: "NUDGE cross-side — gentler repeat (3→5)" },
  { code: "PM16", grace: 3,  repeat: 4, reason: "NUDGE solicitor review — repeat 3→4" },
  { code: "PM17", grace: 3,  repeat: 4, reason: "NUDGE solicitor admin — repeat 3→4" },
  { code: "PM19", grace: 3,  repeat: 4, reason: "NUDGE solicitor review — repeat 3→4" },
  { code: "PM20", grace: 3,  repeat: 5, reason: "NUDGE solicitor admin — repeat 3→5" },
];

async function main() {
  // ─── Pre-flight: staging only ────────────────────────────────────────
  const dbUrl = process.env.DATABASE_URL || "";
  const m = dbUrl.match(/postgres\.([^:]+):/);
  const projectId = m ? m[1] : "unknown";
  console.log(`[apply-timings] DB project: ${projectId}`);
  if (projectId === PROD_PROJECT_ID) {
    console.error(`[apply-timings] HARD ABORT: connected to PRODUCTION (${PROD_PROJECT_ID})`);
    process.exit(1);
  }
  if (projectId !== STAGING_PROJECT_ID) {
    console.error(`[apply-timings] HARD ABORT: not staging (got "${projectId}", expected "${STAGING_PROJECT_ID}")`);
    process.exit(1);
  }
  console.log("");

  // ─── Read current values for all 18 codes ──────────────────────────
  const targetCodes = UPDATES.map((u) => u.code);
  const currentRules = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { in: targetCodes } },
    select: {
      id: true,
      targetMilestoneCode: true,
      graceDays: true,
      repeatEveryDays: true,
    },
  });

  // Index by code for fast lookup
  const byCode = new Map(currentRules.map((r) => [r.targetMilestoneCode!, r]));

  // Verify every spec code matches a rule
  const missing = UPDATES.filter((u) => !byCode.has(u.code));
  if (missing.length > 0) {
    console.error(`[apply-timings] HARD ABORT: no active ReminderRule for ${missing.map((m) => m.code).join(", ")}`);
    process.exit(1);
  }

  // ─── Show before/after diff for review ───────────────────────────────
  console.log(`[apply-timings] proposed changes:`);
  console.log(`  code   | before  | after   | reason`);
  console.log(`  -------+---------+---------+---------------------------`);
  for (const u of UPDATES) {
    const cur = byCode.get(u.code)!;
    const before = `${cur.graceDays}/${cur.repeatEveryDays}`;
    const after = `${u.grace}/${u.repeat}`;
    const arrow = before === after ? "(no change)" : "→";
    console.log(`  ${u.code.padEnd(6)} | ${before.padEnd(7)} | ${after.padEnd(7)} | ${u.reason.slice(0, 70)}`);
  }
  console.log("");

  // ─── Apply updates ───────────────────────────────────────────────────
  console.log(`[apply-timings] applying ${UPDATES.length} updates...`);
  let applied = 0;
  let unchanged = 0;
  for (const u of UPDATES) {
    const cur = byCode.get(u.code)!;
    if (cur.graceDays === u.grace && cur.repeatEveryDays === u.repeat) {
      unchanged += 1;
      continue;
    }
    await prisma.reminderRule.update({
      where: { id: cur.id },
      data: { graceDays: u.grace, repeatEveryDays: u.repeat },
    });
    applied += 1;
  }
  console.log(`[apply-timings] applied=${applied}, unchanged=${unchanged}`);
  console.log("");

  // ─── Verify by re-reading ────────────────────────────────────────────
  console.log(`[apply-timings] verifying...`);
  const verifyRules = await prisma.reminderRule.findMany({
    where: { isActive: true, targetMilestoneCode: { in: targetCodes } },
    select: { targetMilestoneCode: true, graceDays: true, repeatEveryDays: true },
  });
  const verifyByCode = new Map(verifyRules.map((r) => [r.targetMilestoneCode!, r]));

  const mismatches: string[] = [];
  for (const u of UPDATES) {
    const v = verifyByCode.get(u.code)!;
    if (v.graceDays !== u.grace || v.repeatEveryDays !== u.repeat) {
      mismatches.push(`${u.code}: expected ${u.grace}/${u.repeat}, got ${v.graceDays}/${v.repeatEveryDays}`);
    }
  }
  if (mismatches.length > 0) {
    console.error(`[apply-timings] VERIFY FAILED:`);
    for (const m of mismatches) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log(`[apply-timings] ✓ all ${UPDATES.length} rules match spec`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
