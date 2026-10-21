// One-time conversion of chase timing values from calendar days to WORKING
// days (critique #281, business-days step 3; founder-approved table
// 2026-10-20). Converts, using lib/reminders/working-day-conversion.ts:
//   - every ReminderRule.graceDays / repeatEveryDays
//   - every AgencyChaseRuleOverride / BusinessChaseRuleOverride row
//   - every PropertyTransaction.chaseRuleSnapshot JSON (per-code grace/repeat)
//
// SAFE BY DEFAULT: dry-run prints the full before→after table and writes
// nothing. Pass --confirm to convert.
//
// Guard rails:
//   - Writes a timestamped JSON backup of every current value to
//     scripts/backups/chase-timings-backup-<env>-<ts>.json BEFORE any write;
//     restore is an exact replay of that file (--restore <file>).
//   - Refuses to run twice: on --confirm it creates an INACTIVE marker
//     ReminderRule row (isActive: false, no target code) and checks for it
//     first. Inactive rules are invisible everywhere — the engine, the crons
//     and every UI read filter on isActive: true, and no ReminderLog will
//     ever reference it — so the stamp can't leak into the product.
//
// Run (staging first, Law 3):
//   DATABASE_URL=<staging> npx tsx scripts/convert-chase-timings-to-working-days.ts
//   DATABASE_URL=<staging> npx tsx scripts/convert-chase-timings-to-working-days.ts --confirm

import { PrismaClient, Prisma } from "@prisma/client";
import { calendarToWorkingDays } from "../lib/reminders/working-day-conversion";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const CONFIRM = process.argv.includes("--confirm");
const RESTORE = process.argv.indexOf("--restore");
const MARKER_NAME = "SYSTEM MARKER: chase timings converted to working days (critique 281 step 3)";

type SnapshotEntry = { graceDays?: number; repeatEveryDays?: number; [k: string]: unknown };
type Snapshot = Record<string, SnapshotEntry>;

async function main() {
  if (RESTORE !== -1) {
    await restore(process.argv[RESTORE + 1]);
    return;
  }

  // ── Double-run guard ───────────────────────────────────────────────────────
  const marker = await prisma.reminderRule.findFirst({ where: { name: MARKER_NAME }, select: { id: true } });
  if (marker) {
    console.log("ABORT: this database is already converted (marker rule present). Nothing written.");
    return;
  }

  // ── Collect current state ──────────────────────────────────────────────────
  const [rules, agencyOv, businessOv, snapshots] = await Promise.all([
    prisma.reminderRule.findMany({ select: { id: true, name: true, targetMilestoneCode: true, graceDays: true, repeatEveryDays: true } }),
    prisma.agencyChaseRuleOverride.findMany({ select: { id: true, agencyId: true, milestoneCode: true, graceDays: true, repeatEveryDays: true } }),
    prisma.businessChaseRuleOverride.findMany({ select: { id: true, milestoneCode: true, graceDays: true, repeatEveryDays: true } }),
    prisma.propertyTransaction.findMany({
      where: { chaseRuleSnapshot: { not: Prisma.AnyNull } },
      select: { id: true, propertyAddress: true, chaseRuleSnapshot: true },
    }),
  ]);

  // ── Backup ────────────────────────────────────────────────────────────────
  const backupDir = path.join(__dirname, "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const dbHost = (process.env.DATABASE_URL ?? "").match(/postgres(?:ql)?:\/\/[^:]+\.([a-z0-9]+):/)?.[1] ?? "unknown";
  const backupFile = path.join(backupDir, `chase-timings-backup-${dbHost}-${Date.now()}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ rules, agencyOv, businessOv, snapshots }, null, 2));
  console.log(`Backup written: ${backupFile}\n`);

  // ── Build the change set (and print it) ────────────────────────────────────
  let changes = 0;
  console.log("── ReminderRule ──");
  for (const r of rules) {
    const g = calendarToWorkingDays(r.graceDays);
    const rep = calendarToWorkingDays(r.repeatEveryDays);
    if (g !== r.graceDays || rep !== r.repeatEveryDays) {
      changes++;
      console.log(`  ${r.targetMilestoneCode ?? "?"}: grace ${r.graceDays}→${g}, repeat ${r.repeatEveryDays}→${rep}`);
      if (CONFIRM) await prisma.reminderRule.update({ where: { id: r.id }, data: { graceDays: g, repeatEveryDays: rep } });
    }
  }
  console.log("── AgencyChaseRuleOverride ──");
  for (const o of agencyOv) {
    const g = calendarToWorkingDays(o.graceDays);
    const rep = calendarToWorkingDays(o.repeatEveryDays);
    if (g !== o.graceDays || rep !== o.repeatEveryDays) {
      changes++;
      console.log(`  agency ${o.agencyId} ${o.milestoneCode}: grace ${o.graceDays}→${g}, repeat ${o.repeatEveryDays}→${rep}`);
      if (CONFIRM) await prisma.agencyChaseRuleOverride.update({ where: { id: o.id }, data: { graceDays: g, repeatEveryDays: rep } });
    }
  }
  console.log("── BusinessChaseRuleOverride ──");
  for (const o of businessOv) {
    const g = calendarToWorkingDays(o.graceDays);
    const rep = calendarToWorkingDays(o.repeatEveryDays);
    if (g !== o.graceDays || rep !== o.repeatEveryDays) {
      changes++;
      console.log(`  ${o.milestoneCode}: grace ${o.graceDays}→${g}, repeat ${o.repeatEveryDays}→${rep}`);
      if (CONFIRM) await prisma.businessChaseRuleOverride.update({ where: { id: o.id }, data: { graceDays: g, repeatEveryDays: rep } });
    }
  }
  console.log("── chaseRuleSnapshot (per-file frozen copies) ──");
  for (const tx of snapshots) {
    const snap = tx.chaseRuleSnapshot as Snapshot | null;
    if (!snap || typeof snap !== "object") continue;
    let touched = false;
    const next: Snapshot = {};
    for (const [code, entry] of Object.entries(snap)) {
      if (!entry || typeof entry !== "object") { next[code] = entry; continue; }
      const e: SnapshotEntry = { ...entry };
      if (typeof e.graceDays === "number") {
        const g = calendarToWorkingDays(e.graceDays);
        if (g !== e.graceDays) { e.graceDays = g; touched = true; }
      }
      if (typeof e.repeatEveryDays === "number") {
        const rep = calendarToWorkingDays(e.repeatEveryDays);
        if (rep !== e.repeatEveryDays) { e.repeatEveryDays = rep; touched = true; }
      }
      next[code] = e;
    }
    if (touched) {
      changes++;
      console.log(`  ${tx.propertyAddress} (${tx.id})`);
      if (CONFIRM) {
        await prisma.propertyTransaction.update({
          where: { id: tx.id },
          data: { chaseRuleSnapshot: next as Prisma.InputJsonValue },
        });
      }
    }
  }

  // ── Stamp the marker so the script can never run twice ───────────────────
  if (CONFIRM) {
    await prisma.reminderRule.create({
      data: {
        name: MARKER_NAME,
        description: "Not a rule. Run-once stamp written by scripts/convert-chase-timings-to-working-days.ts — do not activate or delete.",
        isActive: false,
        targetMilestoneCode: null,
        graceDays: 0,
        repeatEveryDays: 0,
        escalateAfterChases: 0,
      },
    });
  }

  console.log(`\n${CONFIRM ? "CONVERTED" : "DRY RUN (nothing written)"} — ${changes} row(s) ${CONFIRM ? "changed" : "would change"}.`);
  if (!CONFIRM) console.log("Re-run with --confirm to apply.");
}

// Exact restore from a backup file produced above. Also removes the marker
// rule so a future conversion is possible again.
async function restore(file: string | undefined) {
  if (!file || !fs.existsSync(file)) throw new Error("--restore needs a valid backup file path");
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as {
    rules: { id: string; name: string; graceDays: number; repeatEveryDays: number }[];
    agencyOv: { id: string; graceDays: number; repeatEveryDays: number }[];
    businessOv: { id: string; graceDays: number; repeatEveryDays: number }[];
    snapshots: { id: string; chaseRuleSnapshot: unknown }[];
  };
  for (const r of data.rules) {
    await prisma.reminderRule.update({ where: { id: r.id }, data: { name: r.name, graceDays: r.graceDays, repeatEveryDays: r.repeatEveryDays } });
  }
  for (const o of data.agencyOv) {
    await prisma.agencyChaseRuleOverride.update({ where: { id: o.id }, data: { graceDays: o.graceDays, repeatEveryDays: o.repeatEveryDays } });
  }
  for (const o of data.businessOv) {
    await prisma.businessChaseRuleOverride.update({ where: { id: o.id }, data: { graceDays: o.graceDays, repeatEveryDays: o.repeatEveryDays } });
  }
  for (const t of data.snapshots) {
    await prisma.propertyTransaction.update({ where: { id: t.id }, data: { chaseRuleSnapshot: t.chaseRuleSnapshot as Prisma.InputJsonValue } });
  }
  await prisma.reminderRule.deleteMany({ where: { name: MARKER_NAME } });
  console.log(`RESTORED ${data.rules.length} rules, ${data.agencyOv.length} agency overrides, ${data.businessOv.length} business overrides, ${data.snapshots.length} snapshots from ${file}; marker removed`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
