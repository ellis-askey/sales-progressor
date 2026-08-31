// STAGING ONLY: apply the "contracts exchanged" reminder re-tune (Option A) to
// the staging DB and seed one ready-to-exchange file so the single
// "Awaiting exchange" card can be seen. Guarded against prod. Delete after test.
//
// Run: npx dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json scripts/retune-exchange-reminders-staging.ts

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma";
import { computeAutoNrCodes } from "../lib/milestone-auto-nr";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";
import { evaluateTransactionReminders } from "../lib/services/reminders";

const AGENT_EMAIL = "emily@hartwellpartners.co.uk";
const BURNER = "ellisaskey+exchange@googlemail.com";
const POST_EXCHANGE = new Set(["VM19", "VM20", "PM26", "PM27"]);
const GATE_CODES = new Set(["VM18", "PM25"]);

function daysAgo(n: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - n);
  x.setHours(10, 0, 0, 0);
  return x;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) throw new Error("Refusing to run on PRODUCTION");
  console.log("=== Exchange reminder re-tune (staging) ===");

  // 1. Update the two rules.
  const vm19 = await prisma.reminderRule.updateMany({
    where: { targetMilestoneCode: "VM19" },
    data: { name: "Awaiting exchange", graceDays: 12, repeatEveryDays: 7, escalateAfterChases: 2 },
  });
  const pm26 = await prisma.reminderRule.updateMany({
    where: { targetMilestoneCode: "PM26" },
    data: { isActive: false, graceDays: 12, repeatEveryDays: 7, escalateAfterChases: 2 },
  });
  console.log(`Rules updated: VM19 x${vm19.count}, PM26 x${pm26.count} (PM26 now off)`);

  // 2. Retire existing buyer-side (PM26) reminders — the rule is off now, so the
  //    engine won't touch them; clear them so they drop off the queue.
  const pm26RuleIds = (await prisma.reminderRule.findMany({ where: { targetMilestoneCode: "PM26" }, select: { id: true } })).map((r) => r.id);
  if (pm26RuleIds.length) {
    const logIds = (await prisma.reminderLog.findMany({ where: { reminderRuleId: { in: pm26RuleIds }, status: "active" }, select: { id: true } })).map((l) => l.id);
    const t = await prisma.chaseTask.updateMany({ where: { reminderLogId: { in: logIds }, status: "pending" }, data: { status: "cancelled" } });
    const l = await prisma.reminderLog.updateMany({ where: { id: { in: logIds } }, data: { status: "inactive", statusReason: "Buyer exchange reminder retired (single Awaiting exchange reminder now)" } });
    console.log(`Retired ${l.count} buyer-exchange reminders, cancelled ${t.count} pending tasks`);
  }

  // 3. Seed one ready-to-exchange file (both gates confirmed 14 days ago).
  const emily = await prisma.user.findUnique({ where: { email: AGENT_EMAIL }, select: { id: true, agencyId: true } });
  if (!emily?.agencyId) throw new Error("no agent/agency");
  const defs = await prisma.milestoneDefinition.findMany({ orderBy: [{ side: "asc" }, { orderIndex: "asc" }] });
  const buyerToken = randomBytes(24).toString("base64url");
  const sellerToken = randomBytes(24).toString("base64url");
  const tx = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: "5 Exchange Point, Testfield, TF9 9AA",
      agencyId: emily.agencyId,
      agentUserId: emily.id,
      progressedBy: "agent",
      serviceType: "self_managed",
      status: "active",
      tenure: "freehold",
      purchaseType: "mortgage",
      purchasePrice: 500_000_00,
      createdAt: daysAgo(90),
      lastActivityAt: daysAgo(14),
    },
    select: { id: true },
  });
  await prisma.contact.createMany({
    data: [
      { propertyTransactionId: tx.id, name: "Morgan Reed", email: BURNER, roleType: "vendor", portalToken: sellerToken },
      { propertyTransactionId: tx.id, name: "Jordan Blake", email: BURNER, roleType: "purchaser", portalToken: buyerToken },
    ],
  });

  const autoNr = computeAutoNrCodes("mortgage", "freehold");
  const avail = new Set<string>();
  for (const def of defs) {
    if (autoNr.has(def.code)) continue;
    const prereqs = DIRECT_PREREQUISITES[def.code] ?? [];
    if (prereqs.length === 0 || prereqs.every((p) => autoNr.has(p))) avail.add(def.code);
  }
  await prisma.milestoneCompletion.createMany({
    data: defs.map((def) => {
      const isNr = autoNr.has(def.code);
      const state = (isNr ? "not_required" : avail.has(def.code) ? "available" : "locked") as "not_required" | "available" | "locked";
      return { transactionId: tx.id, milestoneDefinitionId: def.id, state, notRequiredReason: isNr ? "Auto" : null, completedById: emily.id };
    }),
  });
  // Complete everything except the post-exchange steps; the two readiness gates land 14 days ago.
  for (const def of defs) {
    if (POST_EXCHANGE.has(def.code) || autoNr.has(def.code)) continue;
    const when = GATE_CODES.has(def.code) ? daysAgo(14) : daysAgo(25);
    await prisma.milestoneCompletion.updateMany({
      where: { transactionId: tx.id, milestoneDefinitionId: def.id },
      data: { state: "complete", completedAt: when, completedById: emily.id },
    });
  }

  // 4. Run the engine → materialise the single "Awaiting exchange" reminder.
  await evaluateTransactionReminders(tx.id);

  const vm19Rule = await prisma.reminderRule.findFirst({ where: { targetMilestoneCode: "VM19" }, select: { id: true, name: true, graceDays: true, repeatEveryDays: true } });
  const log = await prisma.reminderLog.findFirst({ where: { transactionId: tx.id, reminderRuleId: vm19Rule!.id }, select: { status: true, nextDueDate: true } });
  const pm26Active = await prisma.reminderLog.count({ where: { transactionId: tx.id, reminderRule: { targetMilestoneCode: "PM26" }, status: "active" } });

  console.log(`\nDemo file ${tx.id}`);
  console.log(`  Rule: "${vm19Rule!.name}" grace ${vm19Rule!.graceDays}d, repeat ${vm19Rule!.repeatEveryDays}d`);
  console.log(`  Reminder: status=${log?.status ?? "none"} due=${log?.nextDueDate ? log.nextDueDate.toISOString().slice(0, 10) : "-"} (both ready 14d ago -> due ~2d ago)`);
  console.log(`  Active buyer-exchange reminders on this file: ${pm26Active} (want 0)`);
  console.log(`\n  Work queue: http://localhost:3000/agent/work-queue`);
  console.log(`  File Reminders tab: http://localhost:3000/agent/transactions/${tx.id}\n`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
