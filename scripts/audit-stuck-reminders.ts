// Read-only sweep: find ReminderLog rows stuck in "Coming up" with a
// stale nextDueDate. The classifier at lib/reminders/classify.ts:40
// short-circuits ANY chased row to "upcoming" regardless of date, so
// these stay invisible in the agent's actionable view forever.
//
// Run against production DB before deploying the classifier fix to know
// the magnitude of the backlog. No writes.
//
// Run:
//   npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/audit-stuck-reminders.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = {
  id: string;
  transactionId: string | null;
  propertyAddress: string;
  targetMilestoneCode: string | null;
  nextDueDate: Date;
  chaseCount: number;
  priority: string;
  daysOverdue: number;
  status: string;
};

async function main() {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Find every active ReminderLog with at least one pending ChaseTask
  // whose chaseCount >= 1 AND nextDueDate is in the past. Excludes
  // already-escalated and currently-snoozed rows (those have their own
  // surface, not the stuck-coming-up bug).
  const logs = await prisma.reminderLog.findMany({
    where: {
      status: "active",
      nextDueDate: { lt: startOfToday },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: now } }],
      chaseTasks: {
        some: {
          status: "pending",
          chaseCount: { gte: 1 },
          priority: { not: "escalated" },
        },
      },
    },
    select: {
      id: true,
      transactionId: true,
      nextDueDate: true,
      transaction: { select: { propertyAddress: true, status: true, agency: { select: { name: true } } } },
      reminderRule: { select: { targetMilestoneCode: true } },
      chaseTasks: {
        where: { status: "pending", chaseCount: { gte: 1 }, priority: { not: "escalated" } },
        select: { chaseCount: true, priority: true },
      },
    },
  });

  const rows: Row[] = logs.map((l) => ({
    id: l.id,
    transactionId: l.transactionId,
    propertyAddress: l.transaction?.propertyAddress ?? "(unknown)",
    targetMilestoneCode: l.reminderRule?.targetMilestoneCode ?? null,
    nextDueDate: l.nextDueDate,
    chaseCount: l.chaseTasks[0]?.chaseCount ?? 0,
    priority: l.chaseTasks[0]?.priority ?? "?",
    daysOverdue: Math.floor((startOfToday.getTime() - l.nextDueDate.getTime()) / (1000 * 60 * 60 * 24)),
    status: l.transaction?.status ?? "?",
  })).sort((a, b) => b.daysOverdue - a.daysOverdue);

  console.log(`\n${"=".repeat(80)}`);
  console.log(`STUCK REMINDERS — chased ≥1×, pending, next due in the past, not escalated, not snoozed`);
  console.log(`Today (UTC): ${startOfToday.toISOString().slice(0, 10)}`);
  console.log(`${"=".repeat(80)}\n`);
  console.log(`Total stuck: ${rows.length}\n`);

  if (rows.length === 0) {
    console.log("Nothing to report — backlog is clean.\n");
    await prisma.$disconnect();
    return;
  }

  // Bucket spread by days-overdue
  const buckets = { "≤7d": 0, "8-30d": 0, "31-60d": 0, "61-90d": 0, "90+d": 0 };
  for (const r of rows) {
    if (r.daysOverdue <= 7) buckets["≤7d"]++;
    else if (r.daysOverdue <= 30) buckets["8-30d"]++;
    else if (r.daysOverdue <= 60) buckets["31-60d"]++;
    else if (r.daysOverdue <= 90) buckets["61-90d"]++;
    else buckets["90+d"]++;
  }
  console.log(`Spread by days-overdue:`);
  for (const [k, v] of Object.entries(buckets)) {
    if (v > 0) console.log(`  ${k.padEnd(10)} ${v}`);
  }

  // Tx-status spread (active / on_hold / withdrawn / etc.) — withdrawn
  // files shouldn't have actionable reminders, so any here would be a
  // separate signal.
  const statusSpread = new Map<string, number>();
  for (const r of rows) {
    statusSpread.set(r.status, (statusSpread.get(r.status) ?? 0) + 1);
  }
  console.log(`\nSpread by transaction status:`);
  for (const [k, v] of statusSpread) {
    console.log(`  ${k.padEnd(12)} ${v}`);
  }

  // Top 20 by days-overdue
  console.log(`\nTop 20 by days-overdue:`);
  console.log(
    `  ${"Days".padStart(5)} ${"Next due".padEnd(11)} ${"Code".padEnd(6)} ${"Chases".padEnd(7)} ${"TxStatus".padEnd(10)} Property`,
  );
  for (const r of rows.slice(0, 20)) {
    const dateStr = r.nextDueDate.toISOString().slice(0, 10);
    const addr = r.propertyAddress.length > 50 ? r.propertyAddress.slice(0, 47) + "…" : r.propertyAddress;
    console.log(
      `  ${String(r.daysOverdue).padStart(5)} ${dateStr.padEnd(11)} ${(r.targetMilestoneCode ?? "?").padEnd(6)} ${String(r.chaseCount).padEnd(7)} ${r.status.padEnd(10)} ${addr}`,
    );
  }

  // Distinct file count — gives a sense of whether this is concentrated
  // on a few files or sprawled across many.
  const distinctFiles = new Set(rows.map((r) => r.transactionId));
  console.log(`\nDistinct transactions affected: ${distinctFiles.size}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
