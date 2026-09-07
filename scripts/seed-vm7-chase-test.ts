// STAGING ONLY. One-shot test file for the "chase the draft contract pack (VM7)"
// bug report. Stands up a REAL (non-demo) self-managed sale on an existing agent's
// agency, completes every step up to and INCLUDING VM7's prerequisites (so VM7
// "draft contract pack issued" sits available / not-yet-confirmed), then runs the
// real reminder engine so a due VM7 chase task exists to click "Chase" on.
//
// Also (re)sets the chosen agent's password to a known value and prints it so the
// tester can log in. Refuses to run against production.
//
// Run: npx -y dotenv -e .env -- npx ts-node --project tsconfig.scripts.json scripts/seed-vm7-chase-test.ts
//
// Deletion: one-shot. Delete this file and remove its SCRIPTS_REGISTRY entry once
// the VM7 chase fix has been verified. The seeded transaction can be removed from
// the agent UI or by deleting the PropertyTransaction row.

import { hash } from "bcryptjs";
import type { PurchaseType, Tenure } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { createTransaction } from "../lib/services/transactions";
import { initializeMilestoneCompletions } from "../lib/services/milestones";
import { evaluateTransactionReminders } from "../lib/services/reminders";
import { DIRECT_PREREQUISITES } from "../lib/milestone-prerequisites";
import { randomBytes } from "node:crypto";

// Who logs in. An existing staging director. Password reset to the value below.
const AGENT_EMAIL = "emily@hartwellpartners.co.uk";
const NEW_PASSWORD = "ChaseDraftPack-2026";

// The step we want left available-and-being-chased.
const TARGET = "VM7";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

// Transitive prerequisite closure of a code (not including the code itself).
function prereqClosure(code: string): Set<string> {
  const out = new Set<string>();
  const walk = (c: string) => {
    for (const p of DIRECT_PREREQUISITES[c] ?? []) {
      if (!out.has(p)) {
        out.add(p);
        walk(p);
      }
    }
  };
  walk(code);
  return out;
}

async function main() {
  if (process.env.DATABASE_URL?.includes("gmkfustgwipgihpmpjpr")) {
    throw new Error("Refusing to run on PRODUCTION");
  }

  const agent = await prisma.user.findUnique({
    where: { email: AGENT_EMAIL },
    select: { id: true, name: true, role: true, agencyId: true, agency: { select: { name: true } } },
  });
  if (!agent || !agent.agencyId) throw new Error(`Agent ${AGENT_EMAIL} not found or has no agency`);
  console.log(`Agent: ${agent.name} (${agent.role}) @ ${agent.agency?.name} [${agent.agencyId}]`);

  // Solicitors so the VM7 chase has a real "seller's solicitor" recipient to write to.
  const vFirm = await prisma.solicitorFirm.upsert({
    where: { name: "Test Vendor Legal LLP" }, update: {}, create: { name: "Test Vendor Legal LLP" }, select: { id: true },
  });
  let vSol = await prisma.solicitorContact.findFirst({ where: { firmId: vFirm.id, name: "Rachel Holt" }, select: { id: true } });
  if (!vSol) vSol = await prisma.solicitorContact.create({ data: { firmId: vFirm.id, name: "Rachel Holt", email: "rachel.holt@example.com", phone: "01727 000111" }, select: { id: true } });
  const pFirm = await prisma.solicitorFirm.upsert({
    where: { name: "Test Buyer Legal LLP" }, update: {}, create: { name: "Test Buyer Legal LLP" }, select: { id: true },
  });
  let pSol = await prisma.solicitorContact.findFirst({ where: { firmId: pFirm.id, name: "Tom Fielding" }, select: { id: true } });
  if (!pSol) pSol = await prisma.solicitorContact.create({ data: { firmId: pFirm.id, name: "Tom Fielding", email: "tom.fielding@example.com", phone: "01727 000222" }, select: { id: true } });

  // Real self-managed sale on the agent's agency, backdated ~30 days.
  const createdAt = daysAgo(30);
  const tx = await createTransaction({
    propertyAddress: "48 Willow Bank Road, St Albans, Hertfordshire, AL1 4RT",
    agencyId: agent.agencyId,
    agentUserId: agent.id,
    assignedUserId: agent.id,
    progressedBy: "agent",
    createdAt,
    purchasePrice: 47_500_000,
    tenure: "freehold" as Tenure,
    purchaseType: "mortgage" as PurchaseType,
    vendorSolicitorFirmId: vFirm.id,
    vendorSolicitorContactId: vSol.id,
    purchaserSolicitorFirmId: pFirm.id,
    purchaserSolicitorContactId: pSol.id,
  });
  console.log(`Created transaction ${tx.id}`);

  await prisma.contact.create({
    data: { propertyTransactionId: tx.id, roleType: "vendor", name: "Helen Marsh", email: "helen.marsh@example.com", phone: "07700 900555", portalToken: randomBytes(20).toString("base64url") },
  });
  await prisma.contact.create({
    data: { propertyTransactionId: tx.id, roleType: "purchaser", name: "James Cole", email: "james.cole@example.com", phone: "07700 900666", portalToken: randomBytes(20).toString("base64url") },
  });

  await initializeMilestoneCompletions(tx.id, "freehold" as Tenure, "mortgage" as PurchaseType, agent.id, tx.activeBuyerRoundId ?? undefined, prisma);

  // Complete everything VM7 depends on (backdated + spread), leave VM7 available.
  const rows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id },
    select: { id: true, state: true, milestoneDefinition: { select: { code: true, orderIndex: true } } },
  });
  const nrCodes = new Set(rows.filter((r) => r.state === "not_required").map((r) => r.milestoneDefinition?.code).filter(Boolean) as string[]);
  const closure = prereqClosure(TARGET);
  const toComplete = rows
    .filter((r) => r.milestoneDefinition && closure.has(r.milestoneDefinition.code) && r.state !== "not_required")
    .sort((a, b) => (a.milestoneDefinition!.orderIndex - b.milestoneDefinition!.orderIndex));

  for (let i = 0; i < toComplete.length; i++) {
    const c = toComplete[i];
    // Oldest first; the last prereq (VM6) lands ~9 days ago so the VM7 chase is due now.
    const offset = 28 - Math.round((i / Math.max(toComplete.length - 1, 1)) * 19);
    await prisma.milestoneCompletion.update({
      where: { id: c.id },
      data: { state: "complete", completedAt: daysAgo(offset), completedById: agent.id },
    });
    console.log(`  complete ${c.milestoneDefinition!.code} (${offset}d ago)`);
  }

  // Coherent states for the rest: available if all direct prereqs done, else locked.
  const completedCodes = new Set([...closure]);
  const targetRow = rows.find((r) => r.milestoneDefinition?.code === TARGET);
  if (targetRow) {
    await prisma.milestoneCompletion.update({ where: { id: targetRow.id }, data: { state: "available" } });
    console.log(`  ${TARGET} -> available (draft contract pack, NOT confirmed)`);
  }
  const availableIds: string[] = [];
  const lockedIds: string[] = [];
  for (const r of rows) {
    const code = r.milestoneDefinition?.code;
    if (!code || completedCodes.has(code) || code === TARGET || nrCodes.has(code)) continue;
    const prereqs = DIRECT_PREREQUISITES[code] ?? [];
    const ready = prereqs.every((p) => completedCodes.has(p) || nrCodes.has(p));
    (ready ? availableIds : lockedIds).push(r.id);
  }
  if (availableIds.length) await prisma.milestoneCompletion.updateMany({ where: { id: { in: availableIds } }, data: { state: "available" } });
  if (lockedIds.length) await prisma.milestoneCompletion.updateMany({ where: { id: { in: lockedIds } }, data: { state: "locked" } });

  // Real reminder engine: creates the ReminderLog threads + due ChaseTasks.
  await evaluateTransactionReminders(tx.id);

  // Make sure the VM7 chase is due NOW and has a pending, assigned ChaseTask.
  const vm7Log = await prisma.reminderLog.findFirst({
    where: { transactionId: tx.id, reminderRule: { targetMilestoneCode: TARGET } },
    include: { chaseTasks: true, reminderRule: { select: { name: true } } },
  });
  if (!vm7Log) {
    console.warn("!! No VM7 reminder log was created - check that a VM7 reminder rule exists on staging.");
  } else {
    if (vm7Log.nextDueDate > new Date()) {
      await prisma.reminderLog.update({ where: { id: vm7Log.id }, data: { nextDueDate: daysAgo(1) } });
    }
    const pending = vm7Log.chaseTasks.find((t) => t.status === "pending");
    if (!pending) {
      await prisma.chaseTask.create({
        data: { transactionId: tx.id, reminderLogId: vm7Log.id, assignedToId: agent.id, dueDate: daysAgo(1), status: "pending", priority: "normal", chaseCount: 0 },
      });
    }
    const logAfter = await prisma.reminderLog.findUnique({ where: { id: vm7Log.id }, include: { chaseTasks: { where: { status: "pending" } } } });
    console.log(`  VM7 reminder "${vm7Log.reminderRule?.name}" due ${logAfter?.nextDueDate.toISOString()}, pending chase tasks: ${logAfter?.chaseTasks.length}`);
  }

  // Login: reset the agent's password to a known value.
  await prisma.user.update({ where: { id: agent.id }, data: { password: await hash(NEW_PASSWORD, 12) } });

  console.log("\n==================== DONE ====================");
  console.log(`Login email:    ${AGENT_EMAIL}`);
  console.log(`Login password: ${NEW_PASSWORD}`);
  console.log(`Open the file:  /agent/transactions/${tx.id}`);
  console.log("Go to the Chase tab, find 'Draft contract pack issued' (VM7), click Chase.");
  console.log("=============================================");
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
