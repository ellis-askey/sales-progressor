// One-shot data correction for the multi-contact chase-count inflation bug
// (see docs/active/chase-count-fix-and-agent-email-log-brief.md, Part A2).
//
// enqueueClientChaseDigest ran once per contact and applied the chase to the
// same ChaseTask N times per round, so on multi-contact files:
//   - ChaseTask.chaseCount is inflated (e.g. Walnut Tree Barn "Chased 6x" from
//     2 real rounds x 3 seller contacts).
//   - ReminderLog.nextDueDate is over-advanced (compounding repeatEveryDays),
//     leaving the client UNDER-chased.
//
// The per-contact records (ClientChaseState.chaseCount) were always correct, so
// they are the source of truth for the real number of rounds.
//
// Correction, for every PENDING ChaseTask whose rule targets a milestone code
// that has ClientChaseState rows on the same transaction:
//   trueRounds = MAX(ClientChaseState.chaseCount) across that tx's contacts for
//                the target code.
//   - task.chaseCount  -> trueRounds        (only where current > trueRounds; pull down, never up)
//   - reminderLog.nextDueDate -> setUkChaseTime(task.lastChasedAt + repeatEveryDays)
//                (only where the stored date is LATER; pull back, never push out)
//   - priority is NOT touched (a live escalation may be legitimate: after 2
//     unanswered chases per contact the design hands off to a human).
//
// SAFETY: dry-run by default. Pass --apply to write. Monotonic by construction
// (counts only decrease, due dates only move earlier), so re-running is safe.
//
// Run (staging first, dry-run):
//   dotenv -e .env.preview --override -- ts-node --transpile-only \
//     --compiler-options "{\"module\":\"CommonJS\",\"moduleResolution\":\"node\",\"esModuleInterop\":true,\"baseUrl\":\".\",\"paths\":{\"@/*\":[\"./*\"]}}" \
//     -r tsconfig-paths/register scripts/fix-chase-count-inflation.ts
//   ...add --apply once the dry-run looks right, then repeat with .env.production.
//
// Needs the engine-equipped Prisma client (plain `npx prisma generate`, NOT
// --no-engine).
//
// Deletion criteria: remove once applied to production and Walnut Tree Barn is
// verified corrected (task cmsry1eq30032t8grytbbodas: 6 -> 2, nextDue ~19 Aug).
// Tracked in docs/SCRIPTS_REGISTRY.md.

import { prisma } from "../lib/prisma";
import { setUkChaseTime } from "../lib/services/reminders";

const APPLY = process.argv.includes("--apply");

function maskDbHost(url: string | undefined): string {
  if (!url) return "(no DATABASE_URL)";
  const m = url.match(/@([^/:?]+)/);
  return m ? m[1] : "(unparsed)";
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Change = {
  taskId: string;
  transactionId: string;
  address: string;
  code: string;
  contacts: number;
  oldCount: number;
  newCount: number | null; // null = unchanged
  oldDue: Date;
  newDue: Date | null; // null = unchanged
};

async function main() {
  console.log(`\n=== chase-count inflation correction ===`);
  console.log(`DB host : ${maskDbHost(process.env.DATABASE_URL)}`);
  console.log(`Mode    : ${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"}\n`);

  // All pending tasks with their rule + reminder log, plus the file address for
  // readable output.
  const tasks = await prisma.chaseTask.findMany({
    where: {
      status: "pending",
      reminderLog: { reminderRule: { targetMilestoneCode: { not: null } } },
    },
    select: {
      id: true,
      transactionId: true,
      chaseCount: true,
      lastChasedAt: true,
      reminderLog: {
        select: {
          id: true,
          nextDueDate: true,
          reminderRule: { select: { targetMilestoneCode: true, repeatEveryDays: true } },
        },
      },
      transaction: { select: { propertyAddress: true } },
    },
  });

  const changes: Change[] = [];

  for (const t of tasks) {
    const code = t.reminderLog.reminderRule.targetMilestoneCode;
    if (!code) continue;

    // Per-contact truth for this tx + code.
    const states = await prisma.clientChaseState.findMany({
      where: { transactionId: t.transactionId, milestoneCode: code },
      select: { chaseCount: true },
    });
    if (states.length === 0) continue; // not a client-chase-driven task

    const trueRounds = states.reduce((max, s) => Math.max(max, s.chaseCount), 0);

    // Count correction: pull down to the real number of rounds only.
    const newCount = t.chaseCount > trueRounds ? trueRounds : null;

    // Due correction: the next chase should sit repeatEveryDays after the last
    // real chase. Pull the over-advanced date back; never push it out.
    let newDue: Date | null = null;
    if (t.lastChasedAt) {
      const repeatDays = t.reminderLog.reminderRule.repeatEveryDays;
      const base = new Date(t.lastChasedAt);
      base.setDate(base.getDate() + repeatDays);
      const correctDue = setUkChaseTime(base);
      if (t.reminderLog.nextDueDate.getTime() > correctDue.getTime()) {
        newDue = correctDue;
      }
    }

    if (newCount === null && newDue === null) continue;

    changes.push({
      taskId: t.id,
      transactionId: t.transactionId,
      address: t.transaction.propertyAddress ?? "(no address)",
      code,
      contacts: states.length,
      oldCount: t.chaseCount,
      newCount,
      oldDue: t.reminderLog.nextDueDate,
      newDue,
    });
  }

  if (changes.length === 0) {
    console.log("No inflated tasks found. Nothing to correct.\n");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${changes.length} task(s) to correct:\n`);
  for (const c of changes) {
    const countPart =
      c.newCount !== null ? `count ${c.oldCount} -> ${c.newCount}` : `count ${c.oldCount} (unchanged)`;
    const duePart =
      c.newDue !== null
        ? `nextDue ${fmtDate(c.oldDue)} -> ${fmtDate(c.newDue)}`
        : `nextDue ${fmtDate(c.oldDue)} (unchanged)`;
    console.log(
      `  [${c.code}] ${c.address}  (${c.contacts} contacts)\n` +
        `      task ${c.taskId}\n` +
        `      ${countPart}, ${duePart}`
    );
  }
  console.log("");

  if (!APPLY) {
    console.log("DRY-RUN complete. Re-run with --apply to write these changes.\n");
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (const c of changes) {
    const taskData: { chaseCount?: number } = {};
    if (c.newCount !== null) taskData.chaseCount = c.newCount;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(taskData).length > 0) {
        await tx.chaseTask.update({ where: { id: c.taskId }, data: taskData });
      }
      if (c.newDue !== null) {
        // Resolve the log id via the task to keep the write self-contained.
        const task = await tx.chaseTask.findUnique({
          where: { id: c.taskId },
          select: { reminderLogId: true },
        });
        if (task) {
          await tx.reminderLog.update({
            where: { id: task.reminderLogId },
            data: { nextDueDate: c.newDue as Date },
          });
        }
      }
    });
    written++;
  }

  console.log(`APPLIED ${written} correction(s).\n`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
