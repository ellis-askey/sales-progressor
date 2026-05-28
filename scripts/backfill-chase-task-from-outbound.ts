/**
 * Backfill ChaseTask.chaseCount and lastChasedAt from OutboundMessage.
 *
 * Context (2026-05-28): the old reminder engine ticked chaseCount on
 * calendar arithmetic alone, so existing values mix "real chases" with
 * "phantom cadence ticks." OutboundMessage records linked to a chase
 * task (type=outbound, chaseTaskId not null) are the canonical ground
 * truth for "a real chase happened." After the honest-chase-count
 * migration we rebuild every pending task's count + lastChasedAt from
 * its outbound messages.
 *
 * Cancelled / done tasks are left untouched (their counters are frozen).
 *
 * Run once immediately after deploying the honest-chase-count change.
 * Idempotent — running twice produces the same result.
 *
 * Usage: npx tsx scripts/backfill-chase-task-from-outbound.ts [--dry-run]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

type OutboundAgg = {
  chaseTaskId: string;
  _count: { _all: number };
  _max: { createdAt: Date | null };
};

async function main() {
  console.log(`[backfill] starting${DRY_RUN ? " (DRY RUN — no writes)" : ""}`);

  // Pull every outbound message linked to a chase task, aggregated by task.
  // `_count` gives us the true chase count; `_max.createdAt` is lastChasedAt.
  const aggregated = (await prisma.outboundMessage.groupBy({
    by: ["chaseTaskId"],
    where: { type: "outbound", chaseTaskId: { not: null } },
    _count: { _all: true },
    _max: { createdAt: true },
  })) as unknown as OutboundAgg[];

  console.log(`[backfill] found outbound messages for ${aggregated.length} chase tasks`);

  // Also pull every pending ChaseTask so we can reset ones with phantom
  // chaseCount > 0 but no outbound history. (Cancelled/done tasks are
  // not touched — their counters are historical.)
  const pendingTasks = await prisma.chaseTask.findMany({
    where: { status: "pending" },
    select: { id: true, chaseCount: true, lastChasedAt: true, priority: true },
  });
  console.log(`[backfill] pending tasks in scope: ${pendingTasks.length}`);

  const aggMap = new Map<string, { count: number; last: Date | null }>();
  for (const row of aggregated) {
    if (!row.chaseTaskId) continue;
    aggMap.set(row.chaseTaskId, {
      count: row._count._all,
      last: row._max.createdAt,
    });
  }

  let updated = 0;
  let unchanged = 0;
  let phantomReset = 0;
  let deescalated = 0;

  for (const task of pendingTasks) {
    const truth = aggMap.get(task.id);
    const trueCount = truth?.count ?? 0;
    const trueLast = truth?.last ?? null;

    const countChanged = task.chaseCount !== trueCount;
    const lastChanged = (task.lastChasedAt?.getTime() ?? null) !== (trueLast?.getTime() ?? null);

    if (!countChanged && !lastChanged) {
      unchanged++;
      continue;
    }

    if (task.chaseCount > 0 && trueCount === 0) phantomReset++;
    if (task.priority === "escalated" && trueCount === 0) deescalated++;

    if (!DRY_RUN) {
      await prisma.chaseTask.update({
        where: { id: task.id },
        data: {
          chaseCount: trueCount,
          lastChasedAt: trueLast,
          // If the task was escalated under the old rules but no real
          // chase ever fired, the new model says it should not be
          // escalated. Reset priority to normal — the engine will
          // re-escalate on the next cron pass if the gate is genuinely
          // met (which it won't be, because chaseCount is 0).
          priority: trueCount === 0 && task.priority === "escalated" ? "normal" : task.priority,
        },
      });
    }
    updated++;
  }

  console.log(`[backfill] updated:        ${updated}`);
  console.log(`[backfill] unchanged:      ${unchanged}`);
  console.log(`[backfill] phantom reset:  ${phantomReset}  (chaseCount was > 0, no outbound history)`);
  console.log(`[backfill] de-escalated:   ${deescalated}  (escalated with no real chases)`);
  console.log(`[backfill] done${DRY_RUN ? " (no writes performed)" : ""}`);
}

main()
  .catch((err) => {
    console.error("[backfill] failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
