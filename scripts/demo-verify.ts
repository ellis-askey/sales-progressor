// scripts/demo-verify.ts
//
// Read-only verification + portal-URL printer for the demo agency.
// Runs after seed-demo and prints:
//   - Status counts per surface (hub, work queue, completions, automated emails)
//   - Hero file's portal URLs (vendor + purchaser)
//   - Per-fixture summary (address, status, owner)
//
// No safety rails — it's strictly SELECT.
//
// Run via: npm run demo:verify

// React.cache shim (same reason as seed-demo.ts — see that file for context).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const __react = require("react") as { cache?: <T>(fn: T) => T };
if (typeof __react.cache !== "function") {
  __react.cache = ((fn: unknown) => fn) as <T>(fn: T) => T;
}

import { PrismaClient } from "@prisma/client";
import { DEMO_AGENCY_NAME } from "./seed-demo";

async function main() {
  const prisma = new PrismaClient();
  try {
    const agency = await prisma.agency.findFirst({
      where: { name: DEMO_AGENCY_NAME },
      select: { id: true, name: true, firstSubmissionAt: true, stripeCustomerId: true },
    });
    if (!agency) {
      console.log("(no demo agency found — run npm run demo:seed first)");
      process.exit(1);
    }

    const agencyId = agency.id;
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "https://portal.thesalesprogressor.co.uk";

    console.log(`=== DEMO VERIFY — ${agency.name} (${agencyId}) ===\n`);

    // ── Counts ─────────────────────────────────────────────────────────────
    const [statusCounts, contactCount, milestoneCount, reminderCount, chaseTaskCount, manualTaskCount, queueCount, ccsCount, holdCount, chainCount] = await Promise.all([
      prisma.propertyTransaction.groupBy({
        by: ["status"],
        where: { agencyId },
        _count: { _all: true },
      }),
      prisma.contact.count({ where: { transaction: { agencyId } } }),
      prisma.milestoneCompletion.count({ where: { transaction: { agencyId }, state: "complete" } }),
      prisma.reminderLog.count({ where: { transaction: { agencyId }, status: "active" } }),
      prisma.chaseTask.count({ where: { transaction: { agencyId } } }),
      prisma.manualTask.count({ where: { agencyId } }),
      prisma.outboundEmailQueue.count({ where: { recipientContact: { transaction: { agencyId } } } }),
      prisma.clientChaseState.count({ where: { transaction: { agencyId }, status: "active" } }),
      prisma.transactionHoldPeriod.count({ where: { transaction: { agencyId } } }),
      prisma.propertyChain.count({ where: { agencyId } }),
    ]);

    console.log("Counts:");
    console.log("  PropertyTransaction by status:");
    for (const r of statusCounts) console.log(`    ${r.status.padEnd(10)}: ${r._count._all}`);
    console.log(`  Contact:                ${contactCount}`);
    console.log(`  MilestoneCompletion (complete): ${milestoneCount}`);
    console.log(`  ReminderLog (active):   ${reminderCount}`);
    console.log(`  ChaseTask:              ${chaseTaskCount}`);
    console.log(`  ManualTask:             ${manualTaskCount}`);
    console.log(`  OutboundEmailQueue:     ${queueCount}`);
    console.log(`  ClientChaseState (act): ${ccsCount}`);
    console.log(`  TransactionHoldPeriod:  ${holdCount}`);
    console.log(`  PropertyChain:          ${chainCount}\n`);

    // ── Work queue distribution (drives hub badge colours + work queue page) ──
    const now = new Date();
    const reminders = await prisma.reminderLog.findMany({
      where: { transaction: { agencyId }, status: "active" },
      select: {
        nextDueDate: true,
        chaseTasks: { select: { chaseCount: true, priority: true } },
      },
    });
    let overdue = 0, dueToday = 0, comingUp = 0, escalated = 0;
    const todayStart = new Date(now.toDateString());
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    const in3DayCutoff = new Date(todayStart.getTime() + 5 * 86_400_000); // ~3 business days
    for (const r of reminders) {
      const due = r.nextDueDate;
      const isEsc = r.chaseTasks.some((c) => c.priority === "escalated" || c.chaseCount >= 3);
      if (isEsc) escalated++;
      if (due < todayStart) overdue++;
      else if (due >= todayStart && due < tomorrowStart) dueToday++;
      else if (due < in3DayCutoff) comingUp++;
    }
    console.log("Work queue buckets:");
    console.log(`  Overdue:     ${overdue}`);
    console.log(`  Due today:   ${dueToday}`);
    console.log(`  Coming up:   ${comingUp}`);
    console.log(`  Escalated:   ${escalated}\n`);

    // ── Completions distribution ───────────────────────────────────────────
    const completing = await prisma.propertyTransaction.findMany({
      where: { agencyId, exchangedAt: { not: null } },
      select: { id: true, propertyAddress: true, completionDate: true, status: true },
    });
    console.log(`Exchanged files (${completing.length}):`);
    for (const t of completing) {
      const cd = t.completionDate
        ? t.completionDate.toISOString().slice(0, 10)
        : "—";
      console.log(`  [${t.status.padEnd(9)}] ${cd}  ${t.propertyAddress}`);
    }
    console.log();

    // ── Per-fixture summary + hero portal URLs ─────────────────────────────
    const allTx = await prisma.propertyTransaction.findMany({
      where: { agencyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, propertyAddress: true, status: true, tenure: true,
        purchaseType: true, purchasePrice: true, exchangedAt: true,
        completionDate: true, agentUserId: true, chainLinkId: true,
        agentUser: { select: { name: true } },
        contacts: { select: { name: true, roleType: true, portalToken: true } },
      },
    });

    console.log(`All transactions (${allTx.length}):`);
    for (const t of allTx) {
      const price = t.purchasePrice ? `£${(t.purchasePrice / 100).toLocaleString("en-GB")}` : "(no price)";
      const exch  = t.exchangedAt ? " ✓exchanged" : "";
      const chain = t.chainLinkId ? " ⛓in-chain" : "";
      console.log(`  [${t.status.padEnd(9)}] ${price.padEnd(10)} ${t.propertyAddress} (${t.tenure}×${t.purchaseType})${exch}${chain}`);
      console.log(`            owner: ${t.agentUser?.name ?? "—"}`);
    }
    console.log();

    // ── Hero portal URLs ──────────────────────────────────────────────────
    const hero = allTx.find((t) => t.propertyAddress.startsWith("42 Hawthorn Road"));
    if (hero) {
      console.log("Hero file portal URLs:");
      for (const c of hero.contacts) {
        if (!c.portalToken) continue;
        console.log(`  [${c.roleType}] ${c.name}: ${baseUrl}/portal/${c.portalToken}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
