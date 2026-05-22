// B3 verification: all five FallbackKind values write the right artefacts.
//
// For each kind:
//   - statusReason on ReminderLog matches FALLBACK_REASON[kind]
//   - ChaseTask.fallbackKind = kind
//   - OutboundMessage internal-note content includes the kind-specific
//     phrasing (each kind has a unique format string)
//
// Idempotency unchanged from A4 (task/log reused; audit notes accumulate).
//
// Does NOT verify the UI chip rendering — that's covered by a Storybook-
// style check at copy review time; here we verify the data shape that
// drives the chip (task.fallbackKind ends up correctly populated for each
// kind).

import { prisma } from "../lib/prisma";
import { createAgentChaseTaskForMilestone, type FallbackInput } from "../lib/services/reminders";

async function main() {
  // Fixture
  let agency = await prisma.agency.findFirst({ where: { name: "TraceHarnessAgency" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "TraceHarnessAgency", isInternal: true } });
  }
  let agent = await prisma.user.findFirst({ where: { email: "trace-agent@example.test" } });
  if (!agent) {
    agent = await prisma.user.create({
      data: {
        name: "Trace Agent",
        email: "trace-agent@example.test",
        role: "director",
        agencyId: agency.id,
        firmName: "TraceHarnessAgency",
      },
    });
  }

  // ReminderRule for PM8 must exist (production data)
  const rule = await prisma.reminderRule.findFirst({
    where: { isActive: true, targetMilestoneCode: "PM8" },
    select: { id: true, name: true },
  });
  if (!rule) {
    console.error("[b3] FAIL: no active ReminderRule targets PM8");
    process.exit(1);
  }

  const expected: Record<FallbackInput["kind"], { reasonContains: string; activityContains: string[]; }> = {
    client_opted_out: {
      reasonContains: "Client opted out of automated chases",
      activityContains: ["opted out on", "Trace Contact"],
    },
    max_chases_exhausted: {
      reasonContains: "Client chased twice, no response",
      activityContains: ["chased 2 times", "Trace Contact"],
    },
    days_cap_exhausted: {
      reasonContains: "Client silent for 14 days",
      activityContains: ["silent since first chase", "14-day cap reached"],
    },
    no_email_on_contact: {
      reasonContains: "missing email address",
      activityContains: ["has no email address on file"],
    },
    no_portalToken_on_contact: {
      reasonContains: "missing portal access",
      activityContains: ["no portal access", "no token issued"],
    },
  };

  const failures: string[] = [];

  for (const kind of Object.keys(expected) as FallbackInput["kind"][]) {
    // Fresh transaction + contact per kind so the find-or-create idempotency
    // in createAgentChaseTaskForMilestone doesn't reuse rows across kinds.
    const transaction = await prisma.propertyTransaction.create({
      data: {
        propertyAddress: `B3 verify ${kind} ${Date.now()}, B3 1AA`,
        agencyId: agency.id,
        agentUserId: agent.id,
        assignedUserId: agent.id,
        purchaseType: "cash_buyer",
        tenure: "freehold",
        serviceType: "self_managed",
        progressedBy: "agent",
      },
    });

    // Build the kind-specific input
    let input: FallbackInput;
    switch (kind) {
      case "client_opted_out":
        input = {
          transactionId: transaction.id,
          milestoneCode: "PM8",
          kind,
          contactName: "Trace Contact",
          optedOutAt: new Date("2026-05-22T12:00:00Z"),
        };
        break;
      case "max_chases_exhausted":
        input = {
          transactionId: transaction.id,
          milestoneCode: "PM8",
          kind,
          contactName: "Trace Contact",
          chaseCount: 2,
          lastChasedAt: new Date("2026-05-20T10:00:00Z"),
        };
        break;
      case "days_cap_exhausted":
        input = {
          transactionId: transaction.id,
          milestoneCode: "PM8",
          kind,
          contactName: "Trace Contact",
          firstChasedAt: new Date("2026-05-08T10:00:00Z"),
        };
        break;
      case "no_email_on_contact":
        input = {
          transactionId: transaction.id,
          milestoneCode: "PM8",
          kind,
          contactName: "Trace Contact",
        };
        break;
      case "no_portalToken_on_contact":
        input = {
          transactionId: transaction.id,
          milestoneCode: "PM8",
          kind,
          contactName: "Trace Contact",
        };
        break;
    }

    const result = await createAgentChaseTaskForMilestone(input);
    if (!result) {
      failures.push(`${kind}: helper returned null`);
      await prisma.propertyTransaction.delete({ where: { id: transaction.id } });
      continue;
    }

    const log = await prisma.reminderLog.findUnique({
      where: { id: result.logId },
      select: { statusReason: true, status: true },
    });
    if (!log?.statusReason?.includes(expected[kind].reasonContains)) {
      failures.push(`${kind}: ReminderLog.statusReason missing "${expected[kind].reasonContains}" (got: "${log?.statusReason}")`);
    }
    if (log?.status !== "active") {
      failures.push(`${kind}: ReminderLog.status expected "active" (got: "${log?.status}")`);
    }

    const task = await prisma.chaseTask.findUnique({
      where: { id: result.taskId },
      select: { fallbackKind: true, assignedToId: true, priority: true, status: true },
    });
    if (task?.fallbackKind !== kind) {
      failures.push(`${kind}: ChaseTask.fallbackKind expected "${kind}" (got: "${task?.fallbackKind}")`);
    }
    if (task?.assignedToId !== agent.id) {
      failures.push(`${kind}: assignedToId not the agent`);
    }

    const note = await prisma.outboundMessage.findFirst({
      where: { chaseTaskId: result.taskId, type: "internal_note" },
      orderBy: { createdAt: "asc" },
      select: { content: true, isAutomated: true },
    });
    for (const fragment of expected[kind].activityContains) {
      if (!note?.content.includes(fragment)) {
        failures.push(`${kind}: activity note missing "${fragment}" (got: "${note?.content}")`);
      }
    }
    if (!note?.isAutomated) {
      failures.push(`${kind}: activity note isAutomated should be true`);
    }

    console.log(`[b3] ${kind} ✓`);
    console.log(`     statusReason: ${log?.statusReason}`);
    console.log(`     activity:     ${note?.content?.slice(0, 100)}${(note?.content?.length ?? 0) > 100 ? "…" : ""}`);

    // Tear down per-kind so the next iteration starts clean
    await prisma.propertyTransaction.delete({ where: { id: transaction.id } });
  }

  if (failures.length > 0) {
    console.error(`[b3] ${failures.length} failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  await prisma.$disconnect();
  console.log(`[b3] all checks passed (5 kinds)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
