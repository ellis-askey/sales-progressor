// Read-only(ish) rehearsal harness for the working-days conversion (critique
// #281 step 3). Captures every active reminder's due date, then diffs a later
// capture against it — the "after" state is produced by running the REAL
// engine (not a simulation), so the diff shows exactly what the product will
// do. Three modes:
//
//   --snapshot <file>   write every active ReminderLog's state to <file>
//   --run-engine        run the real reminder engine across every active file
//                       (same code path as /api/reminders/run)
//   --diff <file>       compare the DB now against an earlier snapshot and
//                       print per-reminder deltas, worst-first, with a summary
//
// Rehearsal order on STAGING:
//   1. --snapshot before.json
//   2. apply the step-3 code + run convert-chase-timings-to-working-days.ts --confirm
//   3. --run-engine
//   4. --diff before.json   → the founder-reviewed report
//
// The engine only recomputes dates for never-chased reminders; chased rows
// keep their stored date until their next chase (by design — the diff proves
// it rather than asserts it).

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

type Row = {
  logId: string;
  transactionId: string;
  address: string;
  code: string | null;
  ruleName: string;
  chased: boolean;
  nextDueDate: string;
  snoozedUntil: string | null;
};

async function capture(): Promise<Row[]> {
  const logs = await prisma.reminderLog.findMany({
    where: { status: "active" },
    select: {
      id: true,
      nextDueDate: true,
      snoozedUntil: true,
      transaction: { select: { id: true, propertyAddress: true } },
      reminderRule: { select: { name: true, targetMilestoneCode: true } },
      chaseTasks: { select: { chaseCount: true } },
    },
  });
  return logs.map((l) => ({
    logId: l.id,
    transactionId: l.transaction.id,
    address: l.transaction.propertyAddress,
    code: l.reminderRule.targetMilestoneCode,
    ruleName: l.reminderRule.name,
    chased: l.chaseTasks.some((t) => t.chaseCount > 0),
    nextDueDate: l.nextDueDate.toISOString(),
    snoozedUntil: l.snoozedUntil ? l.snoozedUntil.toISOString() : null,
  }));
}

async function main() {
  const snapshotFile = arg("--snapshot");
  const diffFile = arg("--diff");

  if (snapshotFile) {
    const rows = await capture();
    fs.writeFileSync(snapshotFile, JSON.stringify(rows, null, 2));
    console.log(`Snapshot: ${rows.length} active reminders → ${snapshotFile}`);
    return;
  }

  if (process.argv.includes("--run-engine")) {
    // Import lazily so snapshot/diff runs don't pull the whole engine graph.
    const { runReminderEngine } = await import("../lib/services/reminders");
    const res = await runReminderEngine();
    console.log(`Engine run: ${res.processed}/${res.total} files processed, ${res.errors} errors`);
    return;
  }

  if (diffFile) {
    const before = new Map<string, Row>((JSON.parse(fs.readFileSync(diffFile, "utf8")) as Row[]).map((r) => [r.logId, r]));
    const after = await capture();
    const dayMs = 86_400_000;
    let unchanged = 0;
    const moved: { row: Row; was: string; deltaDays: number }[] = [];
    const added: Row[] = [];
    for (const row of after) {
      const prev = before.get(row.logId);
      if (!prev) { added.push(row); continue; }
      before.delete(row.logId);
      const delta = (new Date(row.nextDueDate).getTime() - new Date(prev.nextDueDate).getTime()) / dayMs;
      if (Math.abs(delta) < 0.01) unchanged++;
      else moved.push({ row, was: prev.nextDueDate, deltaDays: Math.round(delta * 10) / 10 });
    }
    const removed = Array.from(before.values());

    moved.sort((a, b) => Math.abs(b.deltaDays) - Math.abs(a.deltaDays));
    console.log(`\n=== DIFF vs ${diffFile} ===`);
    console.log(`${unchanged} unchanged · ${moved.length} moved · ${added.length} new · ${removed.length} gone\n`);
    for (const m of moved) {
      console.log(
        `${m.deltaDays > 0 ? "+" : ""}${m.deltaDays}d  ${m.row.code ?? "?"}  ${m.row.address}` +
        `  (${m.was.slice(0, 10)} → ${m.row.nextDueDate.slice(0, 10)})${m.row.chased ? "  [already chased]" : ""}`,
      );
    }
    if (added.length) {
      console.log("\nNew reminders since snapshot (engine created them this run):");
      for (const r of added) console.log(`  ${r.code ?? "?"}  ${r.address}  due ${r.nextDueDate.slice(0, 10)}`);
    }
    if (removed.length) {
      console.log("\nReminders no longer active since snapshot:");
      for (const r of removed) console.log(`  ${r.code ?? "?"}  ${r.address}`);
    }
    const big = moved.filter((m) => Math.abs(m.deltaDays) > 4);
    console.log(`\nSummary: largest move ${moved[0] ? moved[0].deltaDays + "d" : "none"}; ${big.length} reminder(s) moved more than 4 days.`);
    return;
  }

  console.log("Usage: --snapshot <file> | --run-engine | --diff <file>");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
