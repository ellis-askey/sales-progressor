// B6 verification.
//
// Proves the aggregation rules in lib/services/client-chase-state.ts. The
// chip rendered by MilestoneRow is a pure function of what that helper
// returns, so this is the load-bearing surface to test.
//
// Rules (transcribed from the helper's header comment):
//   - status="opted_out"  → kind="opted_out"  (grey chip wins over all)
//   - status="escalated"  → kind="opted_out"  (same chip, agent owns it)
//   - lastEngagedAt > lastChasedAt → kind="engaged" (green)
//   - chaseCount > 0     → kind="chased"   (amber)
//   - status="completed" → excluded entirely (no chip)
//   - empty group        → empty map
//
// Multi-contact precedence (joint sellers/purchasers on one milestone):
// opted_out > escalated-as-opted-out > engaged > chased > nothing.

import { prisma } from "../lib/prisma";
import { getClientChaseStatesForTransaction } from "../lib/services/client-chase-state";

async function seedAgencyAndAgent() {
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
  return { agency, agent };
}

async function makeTransactionWithContact(agencyId: string, agentId: string, label: string) {
  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `B6 verify ${label} ${Date.now()}, B6 1AA`,
      agencyId,
      agentUserId: agentId,
      assignedUserId: agentId,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });
  const contact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: `B6 ${label} Vendor`,
      email: `b6-${label}-${Date.now()}@example.test`,
      roleType: "vendor",
      portalToken: `b6-${label}-${transaction.id}`,
    },
  });
  return { transaction, contact };
}

async function makeSecondContact(transactionId: string, label: string) {
  return prisma.contact.create({
    data: {
      propertyTransactionId: transactionId,
      name: `B6 ${label} Co-Vendor`,
      email: `b6-${label}-co-${Date.now()}@example.test`,
      roleType: "vendor",
      portalToken: `b6-${label}-co-${Date.now()}`,
    },
  });
}

function fail(scenario: string, expected: unknown, got: unknown): never {
  console.error(`[b6] FAIL [${scenario}]: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  process.exit(1);
}

async function main() {
  const { agency, agent } = await seedAgencyAndAgent();
  const createdTxIds: string[] = [];

  try {
    // ─── Scenario 1: empty transaction → {} ──────────────────────────────
    {
      const { transaction } = await makeTransactionWithContact(agency.id, agent.id, "empty");
      createdTxIds.push(transaction.id);
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (Object.keys(out).length !== 0) fail("empty tx", {}, out);
      console.log(`[b6] ✓ empty transaction → no entries`);
    }

    // ─── Scenario 2: single active, chaseCount=1 → "chased" ──────────────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "chased");
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM3",
          chaseCount: 1,
          firstChasedAt: new Date(Date.now() - 86400000),
          lastChasedAt: new Date(),
          status: "active",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM3"]?.kind !== "chased") fail("active+chase", "chased", out["VM3"]);
      if (out["VM3"]?.contactCount !== 1) fail("contactCount", 1, out["VM3"]?.contactCount);
      console.log(`[b6] ✓ active + chaseCount>0 → "chased" (amber)`);
    }

    // ─── Scenario 3: engaged AFTER chase → "engaged" ─────────────────────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "engaged");
      createdTxIds.push(transaction.id);
      const chasedAt = new Date(Date.now() - 86400000); // yesterday
      const engagedAt = new Date(); // now (after chasedAt)
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: 1,
          firstChasedAt: chasedAt,
          lastChasedAt: chasedAt,
          lastEngagedAt: engagedAt,
          status: "active",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM4"]?.kind !== "engaged") fail("engaged-after-chase", "engaged", out["VM4"]);
      console.log(`[b6] ✓ lastEngagedAt > lastChasedAt → "engaged" (green)`);
    }

    // ─── Scenario 4: engaged BEFORE most recent chase → "chased" ─────────
    // (client engaged once, then we chased again, they've gone quiet)
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "re-chased");
      createdTxIds.push(transaction.id);
      const engagedAt = new Date(Date.now() - 7 * 86400000); // a week ago
      const chasedAt = new Date(); // now (after engagement)
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: 2,
          firstChasedAt: new Date(Date.now() - 14 * 86400000),
          lastChasedAt: chasedAt,
          lastEngagedAt: engagedAt,
          status: "active",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM4"]?.kind !== "chased") fail("engaged-before-chase", "chased", out["VM4"]);
      console.log(`[b6] ✓ engagement BEFORE latest chase → "chased" (chip re-flags)`);
    }

    // ─── Scenario 5: opted_out → "opted_out" ─────────────────────────────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "optedout");
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM5",
          chaseCount: 3,
          firstChasedAt: new Date(Date.now() - 7 * 86400000),
          lastChasedAt: new Date(Date.now() - 86400000),
          status: "opted_out",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM5"]?.kind !== "opted_out") fail("opted_out", "opted_out", out["VM5"]);
      console.log(`[b6] ✓ status="opted_out" → "opted_out" (grey)`);
    }

    // ─── Scenario 6: escalated → "opted_out" (handed off to agent) ───────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "escalated");
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM5",
          chaseCount: 2,
          firstChasedAt: new Date(Date.now() - 14 * 86400000),
          lastChasedAt: new Date(Date.now() - 86400000),
          status: "escalated",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM5"]?.kind !== "opted_out") fail("escalated", "opted_out", out["VM5"]);
      console.log(`[b6] ✓ status="escalated" → "opted_out" chip (agent owns it now)`);
    }

    // ─── Scenario 7: completed → excluded (no chip) ──────────────────────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "completed");
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM5",
          chaseCount: 1,
          firstChasedAt: new Date(Date.now() - 86400000),
          lastChasedAt: new Date(Date.now() - 86400000),
          status: "completed",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM5"]) fail("completed-excluded", "undefined", out["VM5"]);
      console.log(`[b6] ✓ status="completed" → excluded from map (no chip)`);
    }

    // ─── Scenario 8: active row with chaseCount=0 and no engagement → no chip
    // (the "skip" branch in the helper — covers fixture / race-window state)
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "zerochase");
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM3",
          chaseCount: 0,
          status: "active",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM3"]) fail("active-zero-chase", "undefined", out["VM3"]);
      console.log(`[b6] ✓ active + chaseCount=0 + no engagement → no entry`);
    }

    // ─── Scenario 9: multi-contact — opted_out beats engaged ─────────────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "multi-optedout");
      createdTxIds.push(transaction.id);
      const contact2 = await makeSecondContact(transaction.id, "multi-optedout");
      // Contact 1: engaged
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM3",
          chaseCount: 1,
          firstChasedAt: new Date(Date.now() - 86400000),
          lastChasedAt: new Date(Date.now() - 86400000),
          lastEngagedAt: new Date(),
          status: "active",
        },
      });
      // Contact 2: opted_out
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact2.id,
          milestoneCode: "VM3",
          chaseCount: 2,
          firstChasedAt: new Date(Date.now() - 7 * 86400000),
          lastChasedAt: new Date(Date.now() - 86400000),
          status: "opted_out",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM3"]?.kind !== "opted_out") fail("multi-optout-wins", "opted_out", out["VM3"]);
      if (out["VM3"]?.contactCount !== 2) fail("multi-contactCount", 2, out["VM3"]?.contactCount);
      console.log(`[b6] ✓ multi-contact: opted_out beats engaged (chip=opted_out, n=2)`);
    }

    // ─── Scenario 10: multi-contact — engaged beats chased ───────────────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "multi-engaged");
      createdTxIds.push(transaction.id);
      const contact2 = await makeSecondContact(transaction.id, "multi-engaged");
      // Contact 1: chased only
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: 1,
          firstChasedAt: new Date(Date.now() - 86400000),
          lastChasedAt: new Date(Date.now() - 86400000),
          status: "active",
        },
      });
      // Contact 2: engaged after chase
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact2.id,
          milestoneCode: "VM4",
          chaseCount: 1,
          firstChasedAt: new Date(Date.now() - 2 * 86400000),
          lastChasedAt: new Date(Date.now() - 2 * 86400000),
          lastEngagedAt: new Date(),
          status: "active",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM4"]?.kind !== "engaged") fail("multi-engaged-wins", "engaged", out["VM4"]);
      console.log(`[b6] ✓ multi-contact: engaged beats chased (one engaged is enough)`);
    }

    // ─── Scenario 11: multi-milestone — independent keys in the map ──────
    {
      const { transaction, contact } = await makeTransactionWithContact(agency.id, agent.id, "multi-ms");
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM3",
          chaseCount: 1,
          firstChasedAt: new Date(),
          lastChasedAt: new Date(),
          status: "active",
        },
      });
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: 1,
          firstChasedAt: new Date(Date.now() - 86400000),
          lastChasedAt: new Date(Date.now() - 86400000),
          lastEngagedAt: new Date(),
          status: "active",
        },
      });
      const out = await getClientChaseStatesForTransaction(transaction.id);
      if (out["VM3"]?.kind !== "chased") fail("multi-ms VM3", "chased", out["VM3"]);
      if (out["VM4"]?.kind !== "engaged") fail("multi-ms VM4", "engaged", out["VM4"]);
      console.log(`[b6] ✓ multi-milestone: VM3=chased, VM4=engaged (keyed independently)`);
    }

    console.log(`[b6] all checks passed`);
  } finally {
    for (const id of createdTxIds) {
      try { await prisma.propertyTransaction.delete({ where: { id } }); } catch {}
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
