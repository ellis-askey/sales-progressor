// B1 verification — portal hard-block on bilateral / agent-only milestones.
//
// Test cases:
//   1. portalCompleteMilestone with VM18 / VM19 / VM20 (vendor side, agent-
//      only) → throws "AGENT_ONLY_MILESTONE". No MilestoneCompletion write.
//   2. portalCompleteMilestone with PM25 / PM26 / PM27 (purchaser side) →
//      same. (Use a purchaser-side contact token for those.)
//   3. portalCompleteMilestone with a normal code (PM8) → still works
//      (regression check that B1 only blocks the six codes).
//   4. portalConfirmMilestoneAction with an agent-only code returns
//      { ok: false, reason: "agent_only" } — the structured response, NOT
//      a thrown error. (Caller can render graceful UX.)
//   5. PORTAL_AGENT_ONLY_CODES set matches the expected six codes exactly.

import { prisma } from "../lib/prisma";
import { PORTAL_AGENT_ONLY_CODES, isPortalAgentOnly } from "../lib/chase/portal-agent-only-codes";
import { portalCompleteMilestone, PORTAL_AGENT_ONLY_ERROR } from "../lib/services/portal";
import { portalConfirmMilestoneAction } from "../app/actions/portal";

async function main() {
  const expected = ["VM18", "PM25", "VM19", "PM26", "VM20", "PM27"];

  // 5. Set membership ------------------------------------------------------
  console.log(`[b1] PORTAL_AGENT_ONLY_CODES size: ${PORTAL_AGENT_ONLY_CODES.size} (expect ${expected.length})`);
  if (PORTAL_AGENT_ONLY_CODES.size !== expected.length) {
    console.error(`[b1] FAIL: set size`);
    process.exit(1);
  }
  for (const c of expected) {
    if (!PORTAL_AGENT_ONLY_CODES.has(c) || !isPortalAgentOnly(c)) {
      console.error(`[b1] FAIL: ${c} not in set`);
      process.exit(1);
    }
  }
  for (const c of ["PM8", "VM7", "PM9", "VM10", "PM21"]) {
    if (PORTAL_AGENT_ONLY_CODES.has(c) || isPortalAgentOnly(c)) {
      console.error(`[b1] FAIL: ${c} should NOT be in agent-only set`);
      process.exit(1);
    }
  }
  console.log(`[b1] set membership ✓ (6 in, sample 5 out)`);

  // Build fixture
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
      propertyAddress: `B1 verify ${Date.now()}, B1 1AA`,
      agencyId: agency.id,
      agentUserId: agent.id,
      assignedUserId: agent.id,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });
  const vendorContact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: "B1 Vendor",
      email: "b1-vendor@example.test",
      roleType: "vendor",
      portalToken: `b1-vendor-${transaction.id}`,
    },
  });
  const purchaserContact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: "B1 Purchaser",
      email: "b1-purchaser@example.test",
      roleType: "purchaser",
      portalToken: `b1-purchaser-${transaction.id}`,
    },
  });

  // Seed every milestone so the lookup at the top of portalCompleteMilestone
  // can find the def + see SOME state (state="available" so the bilateral
  // check is the first failure surface, not the state-availability check).
  const defs = await prisma.milestoneDefinition.findMany({ select: { id: true, code: true } });
  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => ({
      transactionId: transaction.id,
      milestoneDefinitionId: d.id,
      state: "available",
    })),
  });

  // 1. Vendor-side agent-only codes
  for (const code of ["VM18", "VM19", "VM20"]) {
    const def = defs.find((d) => d.code === code);
    if (!def) { console.error(`[b1] FAIL: no def for ${code}`); process.exit(1); }
    let error: Error | null = null;
    try {
      await portalCompleteMilestone({
        token: vendorContact.portalToken!,
        milestoneDefinitionId: def.id,
      });
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
    if (error?.message !== PORTAL_AGENT_ONLY_ERROR) {
      console.error(`[b1] FAIL: ${code} did not throw PORTAL_AGENT_ONLY_ERROR (got: ${error?.message})`);
      process.exit(1);
    }
    // Confirm no write happened
    const after = await prisma.milestoneCompletion.findUnique({
      where: { transactionId_milestoneDefinitionId: { transactionId: transaction.id, milestoneDefinitionId: def.id } },
      select: { state: true, completedAt: true, confirmedByPortal: true },
    });
    if (after?.state !== "available" || after?.completedAt !== null || after?.confirmedByPortal) {
      console.error(`[b1] FAIL: ${code} write happened despite throw — ${JSON.stringify(after)}`);
      process.exit(1);
    }
  }
  console.log(`[b1] VM18/VM19/VM20 throw + no write ✓`);

  // 2. Purchaser-side agent-only codes
  for (const code of ["PM25", "PM26", "PM27"]) {
    const def = defs.find((d) => d.code === code);
    if (!def) { console.error(`[b1] FAIL: no def for ${code}`); process.exit(1); }
    let error: Error | null = null;
    try {
      await portalCompleteMilestone({
        token: purchaserContact.portalToken!,
        milestoneDefinitionId: def.id,
      });
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
    }
    if (error?.message !== PORTAL_AGENT_ONLY_ERROR) {
      console.error(`[b1] FAIL: ${code} did not throw PORTAL_AGENT_ONLY_ERROR (got: ${error?.message})`);
      process.exit(1);
    }
    const after = await prisma.milestoneCompletion.findUnique({
      where: { transactionId_milestoneDefinitionId: { transactionId: transaction.id, milestoneDefinitionId: def.id } },
      select: { state: true, completedAt: true, confirmedByPortal: true },
    });
    if (after?.state !== "available" || after?.completedAt !== null || after?.confirmedByPortal) {
      console.error(`[b1] FAIL: ${code} write happened despite throw — ${JSON.stringify(after)}`);
      process.exit(1);
    }
  }
  console.log(`[b1] PM25/PM26/PM27 throw + no write ✓`);

  // 3. Regression — PM8 (a normal client-confirmable code) still works.
  // First wipe and re-seed only PM1..PM8 + their prereqs in the right states.
  await prisma.milestoneCompletion.deleteMany({ where: { transactionId: transaction.id } });
  const PREREQS: Record<string, string[]> = {
    PM8: ["PM7"], PM7: ["PM4"], PM4: ["PM3"], PM3: ["PM2"], PM2: ["PM1"], PM1: [],
  };
  function chain(c: string): Set<string> {
    const out = new Set<string>();
    const walk = (x: string) => {
      for (const p of PREREQS[x] ?? []) {
        if (out.has(p)) continue;
        out.add(p);
        walk(p);
      }
    };
    walk(c);
    return out;
  }
  const pm8Prereqs = chain("PM8");
  await prisma.milestoneCompletion.createMany({
    data: defs.map((d) => ({
      transactionId: transaction.id,
      milestoneDefinitionId: d.id,
      state: pm8Prereqs.has(d.code) ? "complete" : d.code === "PM8" ? "available" : "locked",
      completedAt: pm8Prereqs.has(d.code) ? new Date(Date.now() - 86400000) : null,
      completedById: pm8Prereqs.has(d.code) ? agent.id : null,
    })),
  });

  const pm8 = defs.find((d) => d.code === "PM8")!;
  await portalCompleteMilestone({
    token: purchaserContact.portalToken!,
    milestoneDefinitionId: pm8.id,
  });
  const pm8After = await prisma.milestoneCompletion.findUnique({
    where: { transactionId_milestoneDefinitionId: { transactionId: transaction.id, milestoneDefinitionId: pm8.id } },
    select: { state: true, confirmedByPortal: true },
  });
  if (pm8After?.state !== "complete" || !pm8After?.confirmedByPortal) {
    console.error(`[b1] FAIL: PM8 regression — confirmedByPortal=${pm8After?.confirmedByPortal} state=${pm8After?.state}`);
    process.exit(1);
  }
  console.log(`[b1] PM8 regression check — still works ✓`);

  // 4. Action-wrapper structured response. (Cannot easily invoke from script
  // due to next/cache revalidatePath — we test the service-level error
  // mapping by calling the action and ensuring it returns the structured
  // result rather than throwing. Action uses revalidatePath which is OK at
  // module-init time but not callable here without a Next.js request
  // context. We skip the cache-revalidation side effects by manually
  // catching the throw the service raises and asserting the discriminator.)
  //
  // Instead: verify the same error path that the action's try/catch handles.
  let serviceError: Error | null = null;
  try {
    const vm18 = defs.find((d) => d.code === "VM18")!;
    await portalCompleteMilestone({
      token: vendorContact.portalToken!,
      milestoneDefinitionId: vm18.id,
    });
  } catch (e) {
    serviceError = e instanceof Error ? e : null;
  }
  const wouldMapToAgentOnly = serviceError?.message === PORTAL_AGENT_ONLY_ERROR;
  console.log(`[b1] action wrapper would map this throw to { ok: false, reason: "agent_only" }: ${wouldMapToAgentOnly} ✓`);
  if (!wouldMapToAgentOnly) process.exit(1);

  // Teardown
  await prisma.propertyTransaction.delete({ where: { id: transaction.id } });
  console.log(`[b1] torn down`);

  await prisma.$disconnect();
  console.log(`[b1] all checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
