// Pass 3 retro one-shot. Cleans up files that were RELISTED before the
// Pass 3 deploy went live (master 4d0695a, 2026-06-05 ~13:34 UTC). Such
// files have stranded write-side state that the new code only fixes on
// FUTURE relists:
//
//   B6 — clientEmailsPaused stuck at true. Visible as "Automation on this
//        file: Paused" on the file detail, even though the new buyer just
//        walked in.
//
//   B8 — expectedExchangeDate stuck at NULL. The "weeks to exchange"
//        forecast is computed from this; staying null leaves the agent
//        with no forecast on a freshly-relisted file.
//
//   B7 — existing active ReminderLog rows for vendor RELIST_RESET targets
//        whose nextDueDate predates the active round's createdAt. These
//        are the "Draft contract pack — 47d overdue" reads on the new
//        sale. Clamp nextDueDate to setUkChaseTime(activeRound.createdAt
//        + graceDays).
//
// Scope: ALL transactions where status=active AND activeBuyerRoundId IS
// NOT NULL. The plus side is we don't need a "deployed before" filter —
// the new code already writes the correct values on future relists, so
// applying these fixes to all current files is idempotent.
//
// Dry-run by default. Pass --apply to write.

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const RELIST_RESET_VM_CODES = new Set([
  "VM2", "VM7",
  "VM10", "VM11", "VM12", "VM13", "VM14", "VM15", "VM16", "VM17",
  "VM18", "VM19", "VM20",
]);

// Mirrors lib/services/reminders.ts#setUkChaseTime. Local-only copy so the
// script doesn't drag the full service graph into a tsx context.
function setUkChaseTime(d: Date): Date {
  const ukDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  const [y, m, dd] = ukDateStr.split("-").map(Number);
  const candidate = new Date(Date.UTC(y, (m as number) - 1, dd, 6, 0, 0, 0));
  const ukHourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", hour12: false,
  }).format(candidate);
  const ukHour = parseInt(ukHourStr, 10);
  const offsetHours = ukHour - 6;
  if (offsetHours !== 0) {
    candidate.setUTCHours(candidate.getUTCHours() - offsetHours);
  }
  return candidate;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

async function main() {
  const startedAt = new Date();
  const lines: string[] = [];
  lines.push("=".repeat(78));
  lines.push("Pass 3 retro — stranded relists (B6 / B7 / B8)");
  lines.push("=".repeat(78));
  lines.push(`Mode:       ${APPLY ? "APPLY (writes committed)" : "DRY-RUN (no writes)"}`);
  lines.push(`Started:    ${startedAt.toISOString()}`);
  lines.push("");

  const activeTxs = await prisma.propertyTransaction.findMany({
    where: { status: "active", activeBuyerRoundId: { not: null } },
    select: {
      id: true,
      propertyAddress: true,
      clientEmailsPaused: true,
      expectedExchangeDate: true,
      activeBuyerRoundId: true,
      activeBuyerRound: { select: { id: true, createdAt: true } },
    },
  });

  lines.push(`Active files with active round: ${activeTxs.length}`);
  lines.push("");

  // ── B6 — clientEmailsPaused that survived a relist ───────────────────
  const b6Targets: { id: string; address: string }[] = [];
  for (const tx of activeTxs) {
    if (tx.clientEmailsPaused) b6Targets.push({ id: tx.id, address: tx.propertyAddress });
  }
  lines.push("-".repeat(78));
  lines.push(`B6 — clientEmailsPaused candidates (${b6Targets.length})`);
  lines.push("-".repeat(78));
  for (const t of b6Targets) lines.push(`  ${t.id}  ${t.address}`);
  if (b6Targets.length === 0) lines.push("  (none)");
  lines.push("");

  // ── B8 — null expectedExchangeDate on a freshly-relisted file ────────
  // Set to activeRound.createdAt + 84 days for any row missing a forecast.
  const b8Targets: { id: string; address: string; newForecast: Date }[] = [];
  for (const tx of activeTxs) {
    if (tx.expectedExchangeDate == null && tx.activeBuyerRound) {
      b8Targets.push({
        id: tx.id,
        address: tx.propertyAddress,
        newForecast: new Date(tx.activeBuyerRound.createdAt.getTime() + 84 * 86400000),
      });
    }
  }
  lines.push("-".repeat(78));
  lines.push(`B8 — expectedExchangeDate candidates (${b8Targets.length})`);
  lines.push("-".repeat(78));
  for (const t of b8Targets) {
    lines.push(`  ${t.id}  ${t.address.padEnd(60)} → ${t.newForecast.toISOString()}`);
  }
  if (b8Targets.length === 0) lines.push("  (none)");
  lines.push("");

  // ── B7 — stale vendor-reset ReminderLog rows ─────────────────────────
  // Find every active log on these files whose targetMilestoneCode is in
  // the reset set AND whose nextDueDate is earlier than its file's active
  // round's createdAt. Clamp to setUkChaseTime(activeRound.createdAt +
  // graceDays).
  const txById = new Map(activeTxs.map((t) => [t.id, t]));
  const staleLogs = await prisma.reminderLog.findMany({
    where: {
      status: "active",
      transactionId: { in: [...txById.keys()] },
      reminderRule: {
        targetMilestoneCode: { in: [...RELIST_RESET_VM_CODES] },
      },
    },
    select: {
      id: true,
      transactionId: true,
      nextDueDate: true,
      reminderRule: { select: { name: true, targetMilestoneCode: true, graceDays: true } },
    },
  });

  type B7Stamp = {
    logId: string;
    txId: string;
    address: string;
    ruleName: string;
    targetCode: string;
    oldNextDueDate: Date;
    newNextDueDate: Date;
  };
  const b7Targets: B7Stamp[] = [];
  for (const log of staleLogs) {
    const tx = txById.get(log.transactionId);
    if (!tx?.activeBuyerRound) continue;
    if (log.nextDueDate.getTime() >= tx.activeBuyerRound.createdAt.getTime()) continue;
    const clampedAnchor = tx.activeBuyerRound.createdAt;
    const newDue = setUkChaseTime(addDays(clampedAnchor, log.reminderRule.graceDays));
    b7Targets.push({
      logId: log.id,
      txId: log.transactionId,
      address: tx.propertyAddress,
      ruleName: log.reminderRule.name,
      targetCode: log.reminderRule.targetMilestoneCode ?? "",
      oldNextDueDate: log.nextDueDate,
      newNextDueDate: newDue,
    });
  }
  lines.push("-".repeat(78));
  lines.push(`B7 — stale vendor-reset ReminderLog rows (${b7Targets.length})`);
  lines.push("-".repeat(78));
  for (const t of b7Targets) {
    lines.push(
      `  ${t.logId}  tx=${t.txId}  ${t.targetCode.padEnd(4)} "${t.ruleName}"`,
    );
    lines.push(
      `       ${t.address}`,
    );
    lines.push(
      `       nextDueDate  ${t.oldNextDueDate.toISOString()}  →  ${t.newNextDueDate.toISOString()}`,
    );
  }
  if (b7Targets.length === 0) lines.push("  (none)");
  lines.push("");

  // ── B7b — stranded pending ChaseTasks attached to clamped ReminderLogs
  //
  // When my earlier one-shot clamped a stale vendor-reset ReminderLog
  // forward (e.g. VM7 nextDueDate 2026-04-19 → 2026-06-10), any pending
  // ChaseTask already generated against that log kept its original
  // dueDate (2026-04-19), so it reads as "47d overdue" on the risk
  // popover and the file-detail Reminders surface. Forward-clamp those
  // ChaseTask.dueDate values to match the log's clamped nextDueDate.
  const allActiveLogs = await prisma.reminderLog.findMany({
    where: {
      status: "active",
      transactionId: { in: [...txById.keys()] },
    },
    select: {
      id: true,
      transactionId: true,
      nextDueDate: true,
      reminderRule: { select: { targetMilestoneCode: true } },
    },
  });
  const logsById = new Map(allActiveLogs.map((l) => [l.id, l]));
  const stranded = await prisma.chaseTask.findMany({
    where: {
      transactionId: { in: [...txById.keys()] },
      status: "pending",
      reminderLogId: { in: allActiveLogs.map((l) => l.id) },
    },
    select: { id: true, transactionId: true, reminderLogId: true, dueDate: true },
  });
  type B7bStamp = {
    chaseId: string;
    txId: string;
    address: string;
    target: string;
    oldDue: Date;
    newDue: Date;
  };
  const b7bTargets: B7bStamp[] = [];
  for (const t of stranded) {
    const log = logsById.get(t.reminderLogId);
    if (!log) continue;
    if (t.dueDate.getTime() >= log.nextDueDate.getTime()) continue;
    const tx = txById.get(t.transactionId);
    if (!tx) continue;
    b7bTargets.push({
      chaseId: t.id,
      txId: t.transactionId,
      address: tx.propertyAddress,
      target: log.reminderRule.targetMilestoneCode ?? "",
      oldDue: t.dueDate,
      newDue: log.nextDueDate,
    });
  }
  lines.push("-".repeat(78));
  lines.push(`B7b — stranded ChaseTasks attached to clamped logs (${b7bTargets.length})`);
  lines.push("-".repeat(78));
  for (const t of b7bTargets) {
    lines.push(`  ${t.chaseId}  tx=${t.txId}  ${t.target}  ${t.address}`);
    lines.push(`       dueDate  ${t.oldDue.toISOString()}  →  ${t.newDue.toISOString()}`);
  }
  if (b7bTargets.length === 0) lines.push("  (none)");
  lines.push("");

  // ── Apply ────────────────────────────────────────────────────────────
  let b6Written = 0;
  let b8Written = 0;
  let b7Written = 0;
  let b7bWritten = 0;
  if (APPLY) {
    if (b6Targets.length > 0) {
      const res = await prisma.propertyTransaction.updateMany({
        where: { id: { in: b6Targets.map((t) => t.id) }, clientEmailsPaused: true },
        data: { clientEmailsPaused: false },
      });
      b6Written = res.count;
    }
    for (const t of b8Targets) {
      const res = await prisma.propertyTransaction.updateMany({
        where: { id: t.id, expectedExchangeDate: null },
        data: { expectedExchangeDate: t.newForecast },
      });
      b8Written += res.count;
    }
    for (const t of b7Targets) {
      const res = await prisma.reminderLog.updateMany({
        where: { id: t.logId, status: "active" },
        data: { nextDueDate: t.newNextDueDate },
      });
      b7Written += res.count;
    }
    for (const t of b7bTargets) {
      const res = await prisma.chaseTask.updateMany({
        where: { id: t.chaseId, status: "pending" },
        data: { dueDate: t.newDue },
      });
      b7bWritten += res.count;
    }
  }

  lines.push("=".repeat(78));
  lines.push(`SUMMARY${APPLY ? " (APPLIED)" : " (DRY-RUN)"}`);
  lines.push("=".repeat(78));
  lines.push(`B6 clientEmailsPaused cleared:  ${APPLY ? b6Written : b6Targets.length}`);
  lines.push(`B8 expectedExchangeDate set:    ${APPLY ? b8Written : b8Targets.length}`);
  lines.push(`B7 ReminderLog rows clamped:    ${APPLY ? b7Written : b7Targets.length}`);
  lines.push(`B7b ChaseTask rows clamped:     ${APPLY ? b7bWritten : b7bTargets.length}`);
  lines.push("");

  const report = lines.join("\n");
  console.log(report);

  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outPath = resolve(`scripts/output/retro-pass-3-stranded-relists-${stamp}.txt`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, report + "\n", "utf8");
  console.log(`Report written to: ${outPath}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
