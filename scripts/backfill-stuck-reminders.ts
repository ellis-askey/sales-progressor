// One-shot: move every stuck reminder's nextDueDate to today so the
// 2026-06-01 backlog clears in a single sweep instead of via individual
// chase clicks. Stuck = active, chaseCount>=1, not snoozed, not
// escalated, nextDueDate in the past.
//
// Setting nextDueDate to today drops the row into "Due today" — agent
// gets a clean triage view. Clicking Chase from there advances forward
// via applyChaseToTask (now stays stuck-free post-2026-06-01-da6effe
// engine fix).
//
// IMPORTANT: requires the engine-stomp fix (commit da6effe) deployed
// FIRST. Without it, evaluateTransactionReminders will rewrite these
// rows back to anchor+grace within minutes of running this script.
//
// Run dry first (no --apply flag) to see what would change.
// Run with --apply to actually write.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const now = new Date();
  // Midday UTC today — guaranteed to fall on today's UK date regardless of BST.
  const targetDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0));
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

  // Find candidates — same predicate as audit-stuck-reminders.ts so we
  // can sanity-check the count against the earlier sweep.
  const stuck = await prisma.reminderLog.findMany({
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
      nextDueDate: true,
      transaction: { select: { propertyAddress: true } },
      reminderRule: { select: { targetMilestoneCode: true } },
    },
  });

  console.log(`\nFound ${stuck.length} stuck rows.`);
  console.log(`Target nextDueDate: ${targetDate.toISOString()}\n`);

  if (stuck.length === 0) {
    console.log("Nothing to backfill — backlog already clean.\n");
    await prisma.$disconnect();
    return;
  }

  // Show what we'd touch
  for (const row of stuck.slice(0, 20)) {
    const days = Math.floor((startOfToday.getTime() - row.nextDueDate.getTime()) / 86400000);
    const addr = row.transaction?.propertyAddress?.slice(0, 50) ?? "(unknown)";
    console.log(`  ${row.reminderRule.targetMilestoneCode?.padEnd(6) ?? "?"} ${String(days).padStart(3)}d  ${addr}`);
  }
  if (stuck.length > 20) console.log(`  ... and ${stuck.length - 20} more.`);

  if (!APPLY) {
    console.log(`\nDRY RUN — re-run with --apply to write nextDueDate = ${targetDate.toISOString()} on ${stuck.length} rows.\n`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\nApplying...`);
  const result = await prisma.reminderLog.updateMany({
    where: { id: { in: stuck.map((s) => s.id) } },
    data: { nextDueDate: targetDate },
  });
  console.log(`Updated ${result.count} rows.\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
