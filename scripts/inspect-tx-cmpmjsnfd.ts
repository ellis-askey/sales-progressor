// One-shot inspection: dump CCS/ReminderLog/ChaseTask state for the
// 2 The Courtyard, Leighton Buzzard file (the one in the screenshot
// from 2026-06-17). Confirming the "stale CCS rows on withdrawn tx"
// theory: after fall-through, are the old buyer's CCS rows still
// status=active with chaseCount 1, causing the preview UI to predict
// upcoming chases that the cron will never actually fire?
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const txId = "cmpmjsnfd0052ltxowy2ss249";

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: {
      id: true,
      propertyAddress: true,
      status: true,
      fallThroughReason: true,
      withdrawalReason: true,
      activeBuyerRoundId: true,
      clientEmailsPaused: true,
      createdAt: true,
      agency: { select: { name: true, chaseEmailsEnabled: true } },
    },
  });
  console.log("=== TX ===");
  console.log(tx);

  const rounds = await prisma.buyerRound.findMany({
    where: { transactionId: txId },
    orderBy: { roundNumber: "asc" },
    select: { id: true, roundNumber: true, status: true, archivedAt: true },
  });
  console.log("\n=== ROUNDS ===");
  for (const r of rounds) console.log(r);

  const contacts = await prisma.contact.findMany({
    where: { propertyTransactionId: txId, roleType: "purchaser" },
    select: { id: true, name: true, email: true, buyerRoundId: true, unsubscribedAt: true, portalToken: true, createdAt: true },
  });
  console.log("\n=== PURCHASER CONTACTS ===");
  for (const c of contacts) console.log(c);

  const ccs = await prisma.clientChaseState.findMany({
    where: { transactionId: txId },
    select: {
      id: true,
      contactId: true,
      milestoneCode: true,
      status: true,
      chaseCount: true,
      firstChasedAt: true,
      lastChasedAt: true,
      lastEngagedAt: true,
      buyerRoundId: true,
      contact: { select: { name: true, roleType: true } },
    },
    orderBy: [{ milestoneCode: "asc" }],
  });
  console.log("\n=== CLIENT CHASE STATE ===");
  console.log(`(${ccs.length} rows)`);
  for (const r of ccs) {
    console.log(`  ${r.status.padEnd(10)} ${r.milestoneCode.padEnd(6)} cnt=${r.chaseCount} last=${r.lastChasedAt?.toISOString() ?? "—"} contact=${r.contact?.name} (${r.contact?.roleType}) round=${r.buyerRoundId ?? "—"} id=${r.id}`);
  }

  const reminderLogs = await prisma.reminderLog.findMany({
    where: { transactionId: txId },
    select: {
      id: true,
      status: true,
      statusReason: true,
      buyerRoundId: true,
      reminderRule: { select: { targetMilestoneCode: true } },
    },
    orderBy: [{ id: "asc" }],
  });
  console.log("\n=== REMINDER LOG ===");
  console.log(`(${reminderLogs.length} rows)`);
  for (const r of reminderLogs) {
    console.log(`  ${r.status.padEnd(10)} ${(r.reminderRule.targetMilestoneCode ?? "—").padEnd(6)} reason=${r.statusReason ?? "—"} round=${r.buyerRoundId ?? "—"} id=${r.id}`);
  }

  const chaseTasks = await prisma.chaseTask.findMany({
    where: { transactionId: txId },
    select: {
      id: true,
      status: true,
      dueAt: true,
      buyerRoundId: true,
    },
    orderBy: [{ dueAt: "asc" }],
  });
  console.log("\n=== CHASE TASKS ===");
  console.log(`(${chaseTasks.length} rows)`);
  for (const t of chaseTasks) {
    console.log(`  ${t.status.padEnd(10)} due=${t.dueAt?.toISOString() ?? "—"} round=${t.buyerRoundId ?? "—"} id=${t.id}`);
  }

  const queued = await prisma.outboundEmailQueue.findMany({
    where: { recipientContact: { propertyTransactionId: txId } },
    select: {
      id: true, emailType: true, scheduledFor: true, sentAt: true, errorAt: true,
      recipientContact: { select: { name: true, roleType: true } },
    },
    orderBy: { scheduledFor: "desc" },
    take: 20,
  });
  console.log("\n=== OUTBOUND EMAIL QUEUE (latest 20) ===");
  for (const q of queued) {
    console.log(`  ${q.emailType.padEnd(22)} sched=${q.scheduledFor.toISOString()} sent=${q.sentAt?.toISOString() ?? "—"} err=${q.errorAt?.toISOString() ?? "—"} to=${q.recipientContact?.name}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
