/**
 * Honest-chase-count verification.
 *
 * Proves the new contract for ChaseTask.chaseCount and escalation:
 *
 *   1. A dormant overdue task does NOT have chaseCount ticked by the
 *      reminder engine, no matter how many days pass.
 *   2. A dormant overdue task does NOT auto-escalate.
 *   3. A real chase (advanceChaseTask) bumps chaseCount and stamps
 *      lastChasedAt. Priority is reset to normal.
 *   4. After chaseCount >= escalateAfterChases, running the engine
 *      BEFORE another full cycle has elapsed does NOT escalate.
 *   5. After chaseCount >= escalateAfterChases AND another full cycle
 *      has elapsed since lastChasedAt, the engine flips priority to
 *      escalated.
 *
 * Run: npx tsx scripts/verify-honest-chase-count.ts
 */

import { prisma } from "../lib/prisma";
import { runReminderEngine, advanceChaseTask } from "../lib/services/reminders";

const FAIL_FAST = process.argv.includes("--fail-fast");
let failures = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`);
    return;
  }
  failures++;
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  if (FAIL_FAST) process.exit(1);
}

async function ensureFixtures() {
  let agency = await prisma.agency.findFirst({ where: { name: "HonestChaseHarness" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "HonestChaseHarness", isInternal: true } });
  }
  let user = await prisma.user.findFirst({ where: { email: "honest-chase@example.test" } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Honest Chase",
        email: "honest-chase@example.test",
        role: "director",
        agencyId: agency.id,
        firmName: "HonestChaseHarness",
      },
    });
  }
  return { agency, user };
}

async function makeTransaction(agencyId: string, userId: string, label: string) {
  // Create with createdAt 10 days in the past so MOS-received chases
  // (graceDays=0, repeatEveryDays=2, escalateAfterChases=2) are deep
  // into overdue territory by default.
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
  return prisma.propertyTransaction.create({
    data: {
      propertyAddress: `Honest ${label} ${Date.now()}, HC1 1AA`,
      agencyId,
      agentUserId: userId,
      assignedUserId: userId,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      createdAt: tenDaysAgo,
    },
    select: { id: true },
  });
}

async function getMosTask(transactionId: string, code: "VM2" | "PM2") {
  return prisma.chaseTask.findFirst({
    where: {
      transactionId,
      status: "pending",
      reminderLog: { reminderRule: { targetMilestoneCode: code } },
    },
    select: {
      id: true,
      chaseCount: true,
      priority: true,
      lastChasedAt: true,
      dueDate: true,
    },
  });
}

async function cleanup(transactionId: string) {
  await prisma.chaseTask.deleteMany({ where: { transactionId } });
  await prisma.reminderLog.deleteMany({ where: { transactionId } });
  await prisma.propertyTransaction.delete({ where: { id: transactionId } }).catch(() => {});
}

async function main() {
  console.log("[honest-chase-count] starting");
  const { agency, user } = await ensureFixtures();

  // ─── Scenario 1: dormant file does not tick chaseCount ─────────────
  console.log("\n[scenario 1] dormant 10-day-old file");
  {
    const tx = await makeTransaction(agency.id, user.id, "dormant");
    // Run engine twice — simulates two cron passes
    await runReminderEngine(agency.id);
    await runReminderEngine(agency.id);
    const t = await getMosTask(tx.id, "VM2");
    check("Seller MOS task exists", !!t);
    check("chaseCount stayed at 0", t?.chaseCount === 0, `got ${t?.chaseCount}`);
    check("priority NOT escalated", t?.priority === "normal", `got ${t?.priority}`);
    check("lastChasedAt is null", t?.lastChasedAt === null);
    await cleanup(tx.id);
  }

  // ─── Scenario 2: one real chase bumps count + stamps lastChasedAt ──
  console.log("\n[scenario 2] one real chase via advanceChaseTask");
  {
    const tx = await makeTransaction(agency.id, user.id, "one-chase");
    await runReminderEngine(agency.id);
    const before = await getMosTask(tx.id, "VM2");
    if (!before) throw new Error("expected MOS task to exist");

    await advanceChaseTask(before.id, { kind: "agency", agencyIds: [agency.id] });

    const after = await getMosTask(tx.id, "VM2");
    check("chaseCount = 1", after?.chaseCount === 1, `got ${after?.chaseCount}`);
    check("lastChasedAt is set", !!after?.lastChasedAt);
    check("priority = normal after chase", after?.priority === "normal");
    await cleanup(tx.id);
  }

  // ─── Scenario 3: chased to threshold, engine runs immediately → no escalation ─
  console.log("\n[scenario 3] chased twice immediately, engine sees no cycle elapsed");
  {
    const tx = await makeTransaction(agency.id, user.id, "rapid-double-chase");
    await runReminderEngine(agency.id);
    const t = await getMosTask(tx.id, "VM2");
    if (!t) throw new Error("expected MOS task to exist");

    const scope = { kind: "agency" as const, agencyIds: [agency.id] };
    await advanceChaseTask(t.id, scope);
    await advanceChaseTask(t.id, scope);

    // Cron runs right after — cycle has not elapsed (lastChasedAt = ~now)
    await runReminderEngine(agency.id);
    const after = await getMosTask(tx.id, "VM2");
    check("chaseCount = 2", after?.chaseCount === 2, `got ${after?.chaseCount}`);
    check("priority still NOT escalated", after?.priority === "normal", `got ${after?.priority}`);
    await cleanup(tx.id);
  }

  // ─── Scenario 4: chased to threshold, cycle has elapsed → escalation flips ─
  console.log("\n[scenario 4] chased to threshold, cycle elapsed since lastChasedAt");
  {
    const tx = await makeTransaction(agency.id, user.id, "cycle-elapsed");
    await runReminderEngine(agency.id);
    const t = await getMosTask(tx.id, "VM2");
    if (!t) throw new Error("expected MOS task to exist");

    // Manually set chaseCount=2 + lastChasedAt=3 days ago (repeatEveryDays=2,
    // so cycle has fully elapsed). Mimics: two real chases happened earlier,
    // then no action for a full cycle past.
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    await prisma.chaseTask.update({
      where: { id: t.id },
      data: { chaseCount: 2, lastChasedAt: threeDaysAgo, priority: "normal" },
    });

    await runReminderEngine(agency.id);
    const after = await getMosTask(tx.id, "VM2");
    check("priority flipped to escalated", after?.priority === "escalated", `got ${after?.priority}`);
    check("chaseCount unchanged at 2", after?.chaseCount === 2, `got ${after?.chaseCount}`);
    await cleanup(tx.id);
  }

  // ─── Scenario 5: escalated, then a real chase resets priority to normal ─
  console.log("\n[scenario 5] escalated, real chase de-escalates");
  {
    const tx = await makeTransaction(agency.id, user.id, "deescalate");
    await runReminderEngine(agency.id);
    const t = await getMosTask(tx.id, "VM2");
    if (!t) throw new Error("expected MOS task to exist");

    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    await prisma.chaseTask.update({
      where: { id: t.id },
      data: { chaseCount: 2, lastChasedAt: threeDaysAgo, priority: "escalated" },
    });

    await advanceChaseTask(t.id, { kind: "agency", agencyIds: [agency.id] });

    const after = await getMosTask(tx.id, "VM2");
    check("chaseCount bumped to 3", after?.chaseCount === 3, `got ${after?.chaseCount}`);
    check("priority reset to normal", after?.priority === "normal", `got ${after?.priority}`);
    check("lastChasedAt refreshed", !!after?.lastChasedAt && after!.lastChasedAt!.getTime() > threeDaysAgo.getTime());
    await cleanup(tx.id);
  }

  console.log(`\n[honest-chase-count] ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((err) => {
    console.error("[honest-chase-count] crashed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
