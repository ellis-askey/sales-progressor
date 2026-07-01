// B2 post-apply verification.
//
// Confirms the migration landed and both new fields are writable + readable
// end-to-end. No production behaviour to test (no callers yet); this just
// proves the schema is usable for B3+.

import { prisma } from "../lib/prisma";

async function main() {
  // 1. Schema state — confirm column + table exist
  const columnCheck = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_name = 'MilestoneCompletion' AND column_name = 'expectedDate'`,
  );
  console.log(`[b2] MilestoneCompletion.expectedDate:`, columnCheck);
  if (columnCheck.length !== 1 || columnCheck[0].data_type !== "timestamp without time zone" || columnCheck[0].is_nullable !== "YES") {
    console.error(`[b2] FAIL: expectedDate column missing or wrong shape`);
    process.exit(1);
  }

  const tableCheck = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'ClientChaseState'`,
  );
  console.log(`[b2] ClientChaseState table exists: ${tableCheck.length > 0 ? "YES" : "NO (FAIL)"}`);
  if (tableCheck.length === 0) {
    console.error(`[b2] FAIL: ClientChaseState table missing`);
    process.exit(1);
  }

  const ccsColumns = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_name = 'ClientChaseState'
     ORDER BY ordinal_position`,
  );
  console.log(`[b2] ClientChaseState columns:`);
  for (const c of ccsColumns) {
    console.log(`  - ${c.column_name} ${c.data_type} ${c.is_nullable === "YES" ? "(nullable)" : "(NOT NULL)"}`);
  }

  // 2. Build a fixture to exercise both fields
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
  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `B2 verify ${Date.now()}, B2 1AA`,
      agencyId: agency.id,
      agentUserId: agent.id,
      assignedUserId: agent.id,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });
  const contact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: "B2 Verify Contact",
      email: "b2-verify@example.test",
      roleType: "vendor",
      portalToken: `b2-verify-${transaction.id}`,
    },
  });
  console.log(`[b2] fixture: tx ${transaction.id}, contact ${contact.id}`);

  // 3. Write a ClientChaseState row
  const row = await prisma.clientChaseState.create({
    data: {
      transactionId: transaction.id,
      contactId: contact.id,
      milestoneCode: "PM8",
      chaseCount: 0,
      status: "active",
    },
  });
  console.log(`[b2] ClientChaseState created:`, {
    id: row.id, status: row.status, chaseCount: row.chaseCount,
    firstChasedAt: row.firstChasedAt, lastEngagedAt: row.lastEngagedAt,
  });

  // 4. Update it (simulate first chase)
  const updated = await prisma.clientChaseState.update({
    where: { id: row.id },
    data: {
      chaseCount: 1,
      firstChasedAt: new Date(),
      lastChasedAt: new Date(),
    },
  });
  console.log(`[b2] ClientChaseState updated: chaseCount=${updated.chaseCount} firstChasedAt=${updated.firstChasedAt?.toISOString()}`);

  // 5. Unique constraint check — can't create a duplicate
  let dupError: Error | null = null;
  try {
    await prisma.clientChaseState.create({
      data: {
        transactionId: transaction.id,
        contactId: contact.id,
        milestoneCode: "PM8", // same triple
        chaseCount: 0,
        status: "active",
      },
    });
  } catch (e) {
    dupError = e instanceof Error ? e : null;
  }
  console.log(`[b2] duplicate insert → ${dupError ? "rejected ✓" : "INSERTED (FAIL)"}`);
  if (!dupError) {
    console.error(`[b2] FAIL: unique constraint missing`);
    process.exit(1);
  }

  // 6. Different milestone code on same (tx, contact) → allowed
  const row2 = await prisma.clientChaseState.create({
    data: {
      transactionId: transaction.id,
      contactId: contact.id,
      milestoneCode: "PM7", // different code
      chaseCount: 0,
      status: "active",
    },
  });
  console.log(`[b2] second row with different milestoneCode: id=${row2.id} (correctly allowed)`);

  // 7. expectedDate write — seed a milestone completion + set expectedDate
  const defs = await prisma.milestoneDefinition.findMany({ where: { code: "PM8" }, select: { id: true } });
  if (defs.length > 0) {
    const comp = await prisma.milestoneCompletion.upsert({
      where: {
        transactionId_milestoneDefinitionId: {
          transactionId: transaction.id,
          milestoneDefinitionId: defs[0].id,
        },
      },
      create: {
        transactionId: transaction.id,
        milestoneDefinitionId: defs[0].id,
        state: "available",
        expectedDate: new Date("2026-06-15T00:00:00Z"),
      },
      update: {
        expectedDate: new Date("2026-06-15T00:00:00Z"),
      },
      select: { id: true, state: true, expectedDate: true, eventDate: true, completedAt: true },
    });
    console.log(`[b2] MilestoneCompletion.expectedDate write:`, {
      state: comp.state, expectedDate: comp.expectedDate?.toISOString(), eventDate: comp.eventDate, completedAt: comp.completedAt,
    });
    if (!comp.expectedDate || comp.state !== "available") {
      console.error(`[b2] FAIL: expectedDate not persisted, or state changed unexpectedly`);
      process.exit(1);
    }
  }

  // 8. Cascade behaviour — delete the transaction, ClientChaseState rows go too
  await prisma.propertyTransaction.delete({ where: { id: transaction.id } });
  const remaining = await prisma.clientChaseState.count({ where: { contactId: contact.id } });
  console.log(`[b2] After transaction delete, ClientChaseState rows for this contact: ${remaining} (expect 0 — cascade)`);
  if (remaining !== 0) {
    console.error(`[b2] FAIL: cascade delete didn't fire`);
    process.exit(1);
  }

  await prisma.$disconnect();
  console.log(`[b2] all checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
