// Phase-2 PR 6 backfill: stamp ChaseTask.buyerRoundId by inheriting from
// the parent ReminderLog's buyerRoundId. Runs after Section 2 (Contact)
// + PR 5 (ReminderLog) backfills have established the round attribution
// on the parent rows.
//
// Classification rule (Ellis-locked):
//   - ChaseTask.reminderLogId resolves to a ReminderLog with a non-null
//     buyerRoundId → stamp the ChaseTask with that buyerRoundId.
//   - ReminderLog has NULL buyerRoundId (VM-rule chases, or a PM-rule
//     log that PR 5's backfill couldn't match) → leave ChaseTask NULL
//     (matches the parent attribution).
//   - reminderLogId resolves to nothing (deleted log) → unmatched.
//
// This is the simplest backfill in the arc: no window matching, no
// role-type check. The rule is "inherit from parent". The complexity
// is upstream in Section 2 + PR 5; this script just propagates.
//
// Run order (per the per-PR template):
//   1. Staging dry-run.   tsx scripts/backfill-chase-task-buyer-round-id.ts
//   2. Ellis approves the report.
//   3. Staging --apply.   tsx scripts/backfill-chase-task-buyer-round-id.ts --apply
//   4. Re-run dry-run, confirm zero remaining unmatched non-null-parent rows.
//   5. Browser verification on Emily relist fixture.
//   6. Prod conversation.

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type StampedRow = {
  taskId: string;
  status: string;
  reminderLogId: string;
  ruleName: string;
  stampedRoundId: string;
};

type UnmatchedRow = {
  taskId: string;
  status: string;
  reminderLogId: string;
  reason: "parent-missing" | "parent-null-round";
};

async function main() {
  const startedAt = new Date();
  const stamped: StampedRow[] = [];
  const unmatched: UnmatchedRow[] = [];

  const candidates = await prisma.chaseTask.findMany({
    where: { buyerRoundId: null },
    select: {
      id: true,
      status: true,
      reminderLogId: true,
      reminderLog: {
        select: {
          buyerRoundId: true,
          reminderRule: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Note: do NOT early-return on zero candidates — the report file is the
  // durable audit artifact and must be written even for "nothing to do"
  // runs. The empty-list branches in the report builder handle this.

  for (const t of candidates) {
    if (!t.reminderLog) {
      unmatched.push({
        taskId: t.id,
        status: t.status,
        reminderLogId: t.reminderLogId,
        reason: "parent-missing",
      });
      continue;
    }
    if (t.reminderLog.buyerRoundId === null) {
      // Parent is also NULL — VM rule or PR 5 unmatched. Inherit the NULL
      // (stays file-level / unmatched-by-design at the parent level).
      unmatched.push({
        taskId: t.id,
        status: t.status,
        reminderLogId: t.reminderLogId,
        reason: "parent-null-round",
      });
      continue;
    }
    stamped.push({
      taskId: t.id,
      status: t.status,
      reminderLogId: t.reminderLogId,
      ruleName: t.reminderLog.reminderRule.name,
      stampedRoundId: t.reminderLog.buyerRoundId,
    });
  }

  // ── Apply ──────────────────────────────────────────────────────────
  let appliedCount = 0;
  if (APPLY && stamped.length > 0) {
    const byRound = new Map<string, string[]>();
    for (const s of stamped) {
      const list = byRound.get(s.stampedRoundId) ?? [];
      list.push(s.taskId);
      byRound.set(s.stampedRoundId, list);
    }
    for (const [roundId, ids] of byRound) {
      const res = await prisma.chaseTask.updateMany({
        where: { id: { in: ids }, buyerRoundId: null },
        data: { buyerRoundId: roundId },
      });
      appliedCount += res.count;
    }
  }

  // ── Report ────────────────────────────────────────────────────────
  const finishedAt = new Date();
  const lines: string[] = [];
  lines.push("=".repeat(78));
  lines.push("Phase-2 PR 6 backfill — ChaseTask.buyerRoundId (inherit from parent)");
  lines.push("=".repeat(78));
  lines.push(`Mode:          ${APPLY ? "APPLY (writes committed)" : "DRY-RUN (no writes)"}`);
  lines.push(`Started:       ${startedAt.toISOString()}`);
  lines.push(`Finished:      ${finishedAt.toISOString()}`);
  lines.push(`Candidates:    ${candidates.length} (buyerRoundId IS NULL)`);
  lines.push(`Stamped:       ${stamped.length}`);
  lines.push(`Unmatched:     ${unmatched.length}`);
  if (APPLY) lines.push(`Rows written:  ${appliedCount}`);
  lines.push("");
  lines.push("Rule: inherit from ReminderLog.buyerRoundId.");
  lines.push("      Parent NULL → leave NULL (matches parent attribution).");
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`STAMPED ROWS (${stamped.length})`);
  lines.push("-".repeat(78));
  if (stamped.length === 0) {
    lines.push("(none)");
  } else {
    // Group by parent round for compactness.
    const byRound = new Map<string, StampedRow[]>();
    for (const s of stamped) {
      const list = byRound.get(s.stampedRoundId) ?? [];
      list.push(s);
      byRound.set(s.stampedRoundId, list);
    }
    for (const [roundId, rows] of byRound) {
      lines.push(`  round=${roundId}  (${rows.length} tasks)`);
      for (const s of rows) {
        lines.push(`    ${s.taskId}  status=${s.status.padEnd(10)} log=${s.reminderLogId} (${s.ruleName})`);
      }
    }
  }
  lines.push("");

  lines.push("-".repeat(78));
  lines.push(`UNMATCHED ROWS (${unmatched.length}) — grouped by reason`);
  lines.push("-".repeat(78));
  if (unmatched.length === 0) {
    lines.push("(none)");
  } else {
    const byReason = new Map<string, UnmatchedRow[]>();
    for (const u of unmatched) {
      const list = byReason.get(u.reason) ?? [];
      list.push(u);
      byReason.set(u.reason, list);
    }
    for (const [reason, rows] of byReason) {
      lines.push(`  reason=${reason}  (${rows.length})`);
      // parent-null-round is high-volume by design (every VM chase ends
      // up here); collapse to a count. parent-missing is low-volume
      // (suggests a deleted log) — list each.
      if (reason === "parent-null-round") {
        const byStatus = new Map<string, number>();
        for (const u of rows) byStatus.set(u.status, (byStatus.get(u.status) ?? 0) + 1);
        for (const [s, n] of byStatus) lines.push(`    status=${s}: ${n}`);
      } else {
        for (const u of rows) {
          lines.push(`    ${u.taskId}  status=${u.status}  log=${u.reminderLogId}`);
        }
      }
    }
  }
  lines.push("");
  lines.push("=".repeat(78));
  lines.push("END OF REPORT");
  lines.push("=".repeat(78));

  const report = lines.join("\n");
  console.log(report);

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(`scripts/output/backfill-chase-task-buyer-round-id-${stamp}.txt`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report + "\n", "utf8");
  console.log(`\nReport written to: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
