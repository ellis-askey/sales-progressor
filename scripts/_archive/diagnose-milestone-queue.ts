// Diagnose missing milestone-confirmation emails on a specific transaction.
//
// Run:
//   npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' --require tsconfig-paths/register scripts/diagnose-milestone-queue.ts <txId>
//
// Walks every step of the path: queue rows for the tx, comms log rows
// for the tx, recent global queue state, and the inferred failure point.

import { PrismaClient } from "@prisma/client";

const txId = process.argv[2];
if (!txId) {
  console.error("Usage: scripts/diagnose-milestone-queue.ts <transactionId>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log(`\nDIAGNOSING transaction ${txId}\n${"=".repeat(72)}`);

  // 1. Transaction shape — needed to know if EMAIL_SKELETON_MODE applies.
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: txId },
    select: {
      id: true,
      propertyAddress: true,
      tenure: true,
      purchaseType: true,
      serviceType: true,
      assignedUser: { select: { id: true, name: true, email: true } },
      agentUser: { select: { id: true, name: true, email: true } },
      contacts: {
        where: { roleType: { in: ["vendor", "purchaser"] } },
        select: { id: true, name: true, email: true, roleType: true, portalToken: true },
      },
    },
  });
  if (!tx) {
    console.error(`Transaction ${txId} not found.`);
    return;
  }
  console.log(`\n[1] TRANSACTION SHAPE`);
  console.log(`  address:      ${tx.propertyAddress}`);
  console.log(`  tenure:       ${tx.tenure}`);
  console.log(`  purchaseType: ${tx.purchaseType}`);
  console.log(`  serviceType:  ${tx.serviceType}`);
  console.log(`  contacts:     ${tx.contacts.length}`);
  for (const c of tx.contacts) {
    console.log(`    - ${c.roleType}: ${c.name} <${c.email ?? "NO EMAIL"}> portalToken=${c.portalToken ? "set" : "MISSING"}`);
  }

  // 2. Recent MilestoneCompletion rows on this tx — confirms what was ticked.
  const completions = await prisma.milestoneCompletion.findMany({
    where: {
      transactionId: txId,
      state: "complete",
      completedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) }, // last 6h
    },
    select: {
      id: true,
      completedAt: true,
      milestoneDefinition: { select: { code: true, name: true } },
    },
    orderBy: { completedAt: "desc" },
  });
  console.log(`\n[2] MILESTONE COMPLETIONS (last 6h)`);
  if (completions.length === 0) {
    console.log("  (none — nothing was completed on this tx in the last 6h)");
  }
  for (const c of completions) {
    console.log(`  - ${c.completedAt?.toISOString()}  ${c.milestoneDefinition?.code ?? "?"}  ${c.milestoneDefinition?.name ?? ""}`);
  }

  // 3. OutboundEmailQueue rows — were they enqueued? Did they send?
  const queueRows = await prisma.outboundEmailQueue.findMany({
    where: {
      emailType: "MILESTONE_CONFIRMATION",
      sourceId: { startsWith: `${txId}:` },
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      emailType: true,
      sourceId: true,
      recipientEmail: true,
      recipientContactId: true,
      scheduledFor: true,
      sentAt: true,
      errorAt: true,
      errorMessage: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\n[3] OUTBOUND EMAIL QUEUE rows for this tx (last 6h, type=MILESTONE_CONFIRMATION)`);
  if (queueRows.length === 0) {
    console.log("  (none — enqueue did NOT happen)");
  }
  for (const r of queueRows) {
    const status = r.sentAt
      ? `sent at ${r.sentAt.toISOString()}`
      : r.errorAt
      ? `ERROR at ${r.errorAt.toISOString()}: ${r.errorMessage ?? "no message"}`
      : `pending; scheduledFor=${r.scheduledFor.toISOString()}`;
    console.log(`  - ${r.createdAt.toISOString()}  ${r.sourceId}  → ${r.recipientEmail}  [${status}]`);
  }

  // 4. OutboundMessage rows (the in-app comms log) — proves the
  //    contact loop ran, isolates whether logAutomatedEmail fired.
  const outboundMessages = await prisma.outboundMessage.findMany({
    where: {
      transactionId: txId,
      method: "email",
      isAutomated: true,
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      createdAt: true,
      contactIds: true,
      content: true,
    },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\n[4] IN-APP COMMS LOG rows (OutboundMessage, last 6h, automated email)`);
  if (outboundMessages.length === 0) {
    console.log("  (none — logAutomatedEmail did NOT fire)");
  }
  for (const m of outboundMessages) {
    const subjectLine = m.content.split("\n")[0]?.slice(0, 100) ?? "";
    console.log(`  - ${m.createdAt.toISOString()}  contacts=${m.contactIds?.length ?? 0}  "${subjectLine}"`);
  }

  // 5. Global queue health check — any failures on other rows?
  const recentFailures = await prisma.outboundEmailQueue.findMany({
    where: {
      emailType: "MILESTONE_CONFIRMATION",
      errorAt: { not: null },
      createdAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      recipientEmail: true,
      errorAt: true,
      errorMessage: true,
    },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  console.log(`\n[5] GLOBAL MILESTONE_CONFIRMATION FAILURES (last 6h, any tx)`);
  if (recentFailures.length === 0) {
    console.log("  (none)");
  }
  for (const f of recentFailures) {
    console.log(`  - ${f.errorAt?.toISOString()}  ${f.recipientEmail}  err=${f.errorMessage}`);
  }

  // 6. Sentinel: did the cron fire at all in the last hour?
  //    Any MILESTONE_CONFIRMATION row with sentAt set in the last hour is
  //    evidence the cron ran.
  const recentSends = await prisma.outboundEmailQueue.findMany({
    where: {
      emailType: "MILESTONE_CONFIRMATION",
      sentAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: { id: true, sentAt: true, recipientEmail: true },
    take: 5,
    orderBy: { sentAt: "desc" },
  });
  console.log(`\n[6] EVIDENCE OF CRON FIRING (any MILESTONE_CONFIRMATION sent in last 60 min, any tx)`);
  if (recentSends.length === 0) {
    console.log("  (none — no MILESTONE_CONFIRMATION row has been drained in the last hour)");
  }
  for (const s of recentSends) {
    console.log(`  - ${s.sentAt?.toISOString()}  ${s.recipientEmail}`);
  }

  // 7. Was the OutboundEmailQueue table recently migrated? Schema sanity.
  const sample = await prisma.outboundEmailQueue.findFirst({
    select: { id: true },
  });
  console.log(`\n[7] SCHEMA CHECK`);
  console.log(`  OutboundEmailQueue accessible: ${sample ? "yes" : "yes (table empty)"}`);

  console.log(`\n${"=".repeat(72)}\nDONE\n`);
}

main()
  .catch((err) => {
    console.error("FATAL", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
