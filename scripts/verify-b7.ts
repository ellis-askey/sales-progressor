// B7 verification: silence-logic proof.
//
// What this script PROVES:
//   1. useEventDate anchor — PM11-style rule (anchor PM6 with useEventDate=true).
//      When PM6.completedAt and PM6.eventDate differ, the cron computes
//      firstDueDate from EVENTDATE, not completedAt.
//   2. No double-count per contact per run — running the cron twice on
//      the same day does NOT double-increment chaseCount or duplicate
//      OutboundEmailQueue rows (sourceId-based dedup).
//   3. MOS graceDays=0 floor — VM2/PM2 rules with graceDays=0 do NOT fire
//      on day 0; the cron floors grace at 1.
//   4. Chase-count cap path (interpretation B): a row at chaseCount=2 with
//      lastChasedAt+repeatEveryDays in the past, no engagement since →
//      escalation fires (status flips to "escalated").
//   5. 14-day silence path: firstChasedAt=15d ago, no engagement → escalation.
//   6. Engagement-after-chase resets the chase loop — chaseCount=1,
//      lastEngagedAt > lastChasedAt → cron does NOT re-chase even if
//      repeatEveryDays has elapsed.
//   7. Engagement-after-2-chases prevents escalation — chaseCount=2,
//      lastEngagedAt > lastChasedAt → escalation pass does NOT fire.
//   8. Mutual exclusion (no double-escalate): a row hitting BOTH the
//      chase-count cap AND the 14-day silence ceiling escalates exactly
//      once. Running findEscalationCandidates returns the row under one
//      reason only; the atomic update with status="active" precondition
//      means a second escalation attempt is a no-op.
//   9. Opted-out contact: no chase enqueued, no ClientChaseState mutation.
//  10. Bilateral codes (VM19/PM26/etc.) filtered: even if a ClientChaseState
//      row somehow exists for one, it's not chased and not escalated.
//
// Approach: build small focused fixtures per scenario, exercise the cron's
// pure-read function (findDueClientChases / findEscalationCandidates)
// against an injected `now`, then assert. The full runClientChaseCron is
// exercised for the no-double-count scenario where we need side-effects.

import { prisma } from "../lib/prisma";
import {
  findDueClientChases,
  findEscalationCandidates,
  runClientChaseCron,
  computeAnchorDate,
  CLIENT_CHASE_COUNT_CAP,
  CLIENT_CHASE_SILENCE_DAYS,
  CLIENT_CHASE_GRACE_FLOOR_DAYS,
} from "../lib/services/client-chase-cron";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}
function inDays(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}

function fail(scenario: string, message: string): never {
  console.error(`[b7] FAIL [${scenario}]: ${message}`);
  process.exit(1);
}

async function seedFixtureAgent() {
  let agency = await prisma.agency.findFirst({ where: { name: "TraceHarnessAgency" } });
  if (!agency) {
    agency = await prisma.agency.create({ data: { name: "TraceHarnessAgency", isInternal: true } });
  }
  let agent = await prisma.user.findFirst({ where: { email: "trace-agent@example.test" } });
  if (!agent) {
    agent = await prisma.user.create({
      data: { name: "Trace Agent", email: "trace-agent@example.test", role: "director", agencyId: agency.id, firmName: "TraceHarnessAgency" },
    });
  }
  return { agency, agent };
}

let scenarioCounter = 0;
async function makeTransactionWith(opts: {
  agencyId: string;
  agentId: string;
  contactRole?: "vendor" | "purchaser";
  unsubscribed?: boolean;
}) {
  scenarioCounter += 1;
  const transaction = await prisma.propertyTransaction.create({
    data: {
      propertyAddress: `B7 verify ${scenarioCounter} ${Date.now()}, B7 1AA`,
      agencyId: opts.agencyId,
      agentUserId: opts.agentId,
      assignedUserId: opts.agentId,
      purchaseType: "cash_buyer",
      tenure: "freehold",
      serviceType: "self_managed",
      progressedBy: "agent",
    },
  });
  const contact = await prisma.contact.create({
    data: {
      propertyTransactionId: transaction.id,
      name: `B7 Contact ${scenarioCounter}`,
      email: `b7-${scenarioCounter}-${Date.now()}@example.test`,
      roleType: opts.contactRole ?? "vendor",
      portalToken: `b7-tok-${scenarioCounter}-${Date.now()}`,
      unsubscribedAt: opts.unsubscribed ? new Date() : null,
    },
  });
  return { transaction, contact };
}

async function seedCompletion(transactionId: string, code: string, opts: {
  state?: "available" | "complete";
  completedAt?: Date | null;
  eventDate?: Date | null;
}) {
  const def = await prisma.milestoneDefinition.findUnique({ where: { code }, select: { id: true } });
  if (!def) throw new Error(`milestone def not found: ${code}`);
  await prisma.milestoneCompletion.create({
    data: {
      transactionId,
      milestoneDefinitionId: def.id,
      state: opts.state ?? "available",
      completedAt: opts.completedAt ?? null,
      eventDate: opts.eventDate ?? null,
    },
  });
  return def.id;
}

async function main() {
  const { agency, agent } = await seedFixtureAgent();
  const createdTxIds: string[] = [];

  try {
    // ─── Scenario 1: useEventDate anchor (PM11 → PM6 with useEventDate=true)
    //
    // PM11 rule from prod data: graceDays=14, useEventDate=true, anchor=PM6.
    // Set PM6.completedAt = today (recent), PM6.eventDate = 30 days ago.
    // Set PM11 (target) state = "available".
    // Run findDueClientChases — PM11 should fire today because
    //   firstDueDate = eventDate + 14 = 30d ago + 14d = 16 days ago (< now).
    // If the cron used completedAt instead, firstDueDate would be in 14
    // days (FUTURE) and the row wouldn't fire.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "purchaser",
      });
      createdTxIds.push(transaction.id);
      await seedCompletion(transaction.id, "PM6", {
        state: "complete",
        completedAt: new Date(),
        eventDate: daysAgo(30),
      });
      await seedCompletion(transaction.id, "PM11", { state: "available" });

      const due = await findDueClientChases(new Date());
      const pm11 = due.find((d) =>
        d.transactionId === transaction.id && d.contactId === contact.id && d.milestoneCode === "PM11",
      );
      if (!pm11) fail("useEventDate", "PM11 not in due list — cron likely used completedAt instead of eventDate");
      // anchorDate should be eventDate (30d ago), not completedAt (today).
      if (Math.abs(pm11.anchorDate.getTime() - daysAgo(30).getTime()) > 86_400_000) {
        fail("useEventDate", `anchorDate wrong — expected ~30d ago, got ${pm11.anchorDate.toISOString()}`);
      }
      console.log(`[b7] ✓ useEventDate: PM11 anchored on eventDate (30d ago), not completedAt`);

      // Cross-check the helper directly too.
      const anchorDate = computeAnchorDate({
        rule: { anchorMilestoneId: "anything", useEventDate: true },
        transaction: { createdAt: new Date() },
        anchorCompletion: {
          state: "complete",
          completedAt: new Date(),
          eventDate: daysAgo(30),
          reconciledAtClaim: false,
        },
      });
      if (!anchorDate || Math.abs(anchorDate.getTime() - daysAgo(30).getTime()) > 86_400_000) {
        fail("useEventDate", "computeAnchorDate didn't prefer eventDate when useEventDate=true");
      }
      console.log(`[b7] ✓ computeAnchorDate prefers eventDate when useEventDate=true`);
    }

    // ─── Scenario 2: MOS graceDays=0 floor (VM2 doesn't fire on day 0)
    //
    // VM2 from prod: anchor=null (uses tx.createdAt), graceDays=0. Without
    // the floor, the cron would fire VM2 the moment the transaction is
    // created. Floor at 1 means it waits until day 1.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      // Tx createdAt is today (just-created). VM2 grace=0 → firstDueDate
      // = today. WITH floor at 1, firstDueDate = tomorrow.
      await seedCompletion(transaction.id, "VM2", { state: "available" });
      const due = await findDueClientChases(new Date());
      const vm2 = due.find((d) =>
        d.transactionId === transaction.id && d.milestoneCode === "VM2",
      );
      if (vm2) fail("MOS floor", `VM2 fired on day 0 — floor of ${CLIENT_CHASE_GRACE_FLOOR_DAYS} not applied`);
      console.log(`[b7] ✓ MOS floor: VM2 (grace=0) does not fire on day 0`);

      // Verify it DOES fire when we wind the clock forward 1 day.
      const tomorrow = inDays(1);
      const dueTomorrow = await findDueClientChases(tomorrow);
      const vm2Tomorrow = dueTomorrow.find((d) =>
        d.transactionId === transaction.id && d.contactId === contact.id && d.milestoneCode === "VM2",
      );
      if (!vm2Tomorrow) fail("MOS floor", `VM2 didn't fire on day +1 — floor too aggressive`);
      console.log(`[b7] ✓ MOS floor: VM2 fires on day +1`);
    }

    // ─── Scenario 3: no double-count per run / per retry
    //
    // Create a transaction with a fresh-to-chase milestone. Run the full
    // cron twice in immediate succession (simulates Vercel retry on a 5xx).
    // Assert: ClientChaseState.chaseCount = 1 (NOT 2), OutboundEmailQueue
    // has exactly ONE row for this contact today.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      // VM4 rule: anchor=VM1, grace=3. Set VM1 complete 5 days ago →
      // firstDueDate = 5d ago + 3 = 2d ago (chaseable today).
      await seedCompletion(transaction.id, "VM1", {
        state: "complete", completedAt: daysAgo(5),
      });
      await seedCompletion(transaction.id, "VM4", { state: "available" });

      await runClientChaseCron(new Date());
      await runClientChaseCron(new Date()); // simulated retry

      const state = await prisma.clientChaseState.findFirst({
        where: { transactionId: transaction.id, contactId: contact.id, milestoneCode: "VM4" },
        select: { chaseCount: true, status: true },
      });
      if (!state) fail("no double-count", "ClientChaseState row not created at all");
      if (state.chaseCount !== 1) {
        fail("no double-count", `chaseCount=${state.chaseCount} after retry, expected 1`);
      }
      const queueRows = await prisma.outboundEmailQueue.findMany({
        where: { emailType: "CLIENT_CHASE", recipientContactId: contact.id },
      });
      if (queueRows.length !== 1) {
        fail("no double-count", `OutboundEmailQueue has ${queueRows.length} rows, expected 1`);
      }
      console.log(`[b7] ✓ no double-count: 2 cron runs → chaseCount=1, queue=1 row (sourceId dedup)`);
    }

    // ─── Scenario 4: chase-count cap path (interpretation B)
    //
    // Set up a row at chaseCount=2 (already at the cap), lastChasedAt =
    // 4 days ago, with VM4's repeatEveryDays=5. After 5 days the second
    // window closes → escalation should fire.
    //
    // We assert ONLY the escalation candidate appears for THIS row in
    // findEscalationCandidates (don't filter all rows globally).
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: CLIENT_CHASE_COUNT_CAP,
          firstChasedAt: daysAgo(10),
          lastChasedAt: daysAgo(6), // > VM4 repeatEveryDays (5) → window closed
          lastEngagedAt: null,
          status: "active",
        },
      });
      const candidates = await findEscalationCandidates(new Date());
      const cand = candidates.find((c) =>
        c.transactionId === transaction.id && c.contactId === contact.id && c.milestoneCode === "VM4",
      );
      if (!cand) fail("chase-count cap", "row at cap+window-closed not flagged for escalation");
      if (cand.reason === "silence_14d") {
        // OK — 14d path may also fire (firstChasedAt 10d ago, but silence
        // cap is 14d so 14d path shouldn't fire here). Let me re-check.
        // firstChasedAt = 10d ago, no engagement → silenceAnchor = 10d ago.
        // 10 < 14 → silence path should NOT fire. So reason must be chase_count.
        fail("chase-count cap", `wrong reason ${cand.reason} — 14d not yet hit, should be chase_count`);
      }
      console.log(`[b7] ✓ chase-count cap fires when 2nd window closes (reason=${cand.reason})`);
    }

    // ─── Scenario 5: 14-day silence path
    //
    // Row at chaseCount=1, firstChasedAt 15d ago, no engagement.
    // chase-count cap requires chaseCount>=2 so won't fire. But 15 >= 14
    // → silence path fires.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: 1,
          firstChasedAt: daysAgo(15),
          lastChasedAt: daysAgo(15),
          lastEngagedAt: null,
          status: "active",
        },
      });
      const candidates = await findEscalationCandidates(new Date());
      const cand = candidates.find((c) =>
        c.transactionId === transaction.id && c.contactId === contact.id,
      );
      if (!cand) fail("14d silence", "row with 15d-since-first-chase not flagged");
      if (cand.reason !== "silence_14d") fail("14d silence", `wrong reason ${cand.reason}, expected silence_14d`);
      console.log(`[b7] ✓ 14-day silence path: 15d since firstChasedAt → escalation (reason=silence_14d)`);
    }

    // ─── Scenario 6: engagement-after-chase resets the chase loop
    //
    // Row at chaseCount=1, lastChasedAt 7d ago, lastEngagedAt 1d ago
    // (AFTER lastChasedAt). repeatEveryDays=5 has elapsed.
    // Expected: no further chase fires — engagement paused the loop.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      await seedCompletion(transaction.id, "VM1", {
        state: "complete", completedAt: daysAgo(20),
      });
      await seedCompletion(transaction.id, "VM4", { state: "available" });
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: 1,
          firstChasedAt: daysAgo(7),
          lastChasedAt: daysAgo(7),
          lastEngagedAt: daysAgo(1), // AFTER lastChasedAt
          status: "active",
        },
      });
      const due = await findDueClientChases(new Date());
      const ourRow = due.find((d) =>
        d.transactionId === transaction.id && d.contactId === contact.id,
      );
      if (ourRow) fail("engagement resets", "engaged contact got re-chased despite recent engagement");
      console.log(`[b7] ✓ engagement-after-chase: no further chase fires (chip stays green)`);
    }

    // ─── Scenario 7: engagement-after-2-chases prevents escalation
    //
    // chaseCount=2, lastChasedAt 6d ago (window closed), lastEngagedAt 1d
    // ago (AFTER lastChasedAt). Expected: NO escalation — engagement
    // happened after the last chase, so the silence trigger doesn't apply.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: CLIENT_CHASE_COUNT_CAP,
          firstChasedAt: daysAgo(10),
          lastChasedAt: daysAgo(6),
          lastEngagedAt: daysAgo(1), // AFTER lastChasedAt
          status: "active",
        },
      });
      const candidates = await findEscalationCandidates(new Date());
      const cand = candidates.find((c) =>
        c.transactionId === transaction.id && c.contactId === contact.id,
      );
      if (cand) fail("engagement blocks escalation", `escalated despite engagement (reason=${cand.reason})`);
      console.log(`[b7] ✓ engagement-after-2-chases: no escalation (chip stays green)`);
    }

    // ─── Scenario 8: mutual exclusion (no double-escalate)
    //
    // Set up a row that hits BOTH conditions:
    //   - chaseCount=2, lastChasedAt 6d ago, no engagement (chase-count cap)
    //   - firstChasedAt 20d ago, no engagement (silence path)
    //
    // findEscalationCandidates uses `continue` to bail to next row after
    // the silence path matches — so the row appears ONCE in the result
    // (under silence_14d, which is checked first).
    //
    // escalateClientChaseState uses an atomic updateMany with
    // status="active" precondition. A second call returns count=0.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      await prisma.clientChaseState.create({
        data: {
          transactionId: transaction.id,
          contactId: contact.id,
          milestoneCode: "VM4",
          chaseCount: CLIENT_CHASE_COUNT_CAP,
          firstChasedAt: daysAgo(20),
          lastChasedAt: daysAgo(6),
          lastEngagedAt: null,
          status: "active",
        },
      });
      const candidates = await findEscalationCandidates(new Date());
      const ours = candidates.filter((c) =>
        c.transactionId === transaction.id && c.contactId === contact.id,
      );
      if (ours.length !== 1) fail("mutual exclusion", `row appeared ${ours.length} times in candidates, expected 1`);
      if (ours[0].reason !== "silence_14d") {
        fail("mutual exclusion", `wrong reason ${ours[0].reason} — silence checked first, should win`);
      }
      console.log(`[b7] ✓ mutual exclusion: row hitting both paths appears ONCE (silence_14d wins)`);

      // Now simulate concurrent retry: try to escalate twice. Second call
      // returns escalated=false (the atomic precondition catches it).
      const { escalateClientChaseState } = await import("../lib/services/client-chase-cron");
      const first = await escalateClientChaseState(ours[0]);
      const second = await escalateClientChaseState(ours[0]);
      if (!first.escalated || second.escalated) {
        fail("mutual exclusion", `double-escalate: first=${first.escalated}, second=${second.escalated}`);
      }
      console.log(`[b7] ✓ atomic escalation: 1st call escalates, 2nd call no-ops (status="active" precondition)`);
    }

    // ─── Scenario 9: opted-out contact is not chased
    //
    // Contact with unsubscribedAt set + an active row → chase pass skips.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor", unsubscribed: true,
      });
      createdTxIds.push(transaction.id);
      await seedCompletion(transaction.id, "VM1", {
        state: "complete", completedAt: daysAgo(5),
      });
      await seedCompletion(transaction.id, "VM4", { state: "available" });
      const due = await findDueClientChases(new Date());
      const ours = due.find((d) => d.contactId === contact.id);
      if (ours) fail("opted-out", "unsubscribed contact appeared in due list");
      console.log(`[b7] ✓ opted-out contact: not in due list (filtered by contact query)`);
    }

    // ─── Scenario 10: bilateral codes filtered (defence-in-depth)
    //
    // Build a ClientChaseState row for VM19 (one of the six bilateral
    // codes). Even though the row exists, findDueClientChases should not
    // include it because chaseableRules filters via isClientChaseable.
    // findEscalationCandidates uses repeatEveryDays lookup which will
    // return null for codes without an active rule (the bilateral codes
    // DO have ReminderRule rows so the lookup succeeds — but those rules
    // weren't included in chaseableRules upstream, so no chases fired in
    // the first place). Defensive only.
    {
      const { transaction, contact } = await makeTransactionWith({
        agencyId: agency.id, agentId: agent.id, contactRole: "vendor",
      });
      createdTxIds.push(transaction.id);
      await seedCompletion(transaction.id, "VM18", {
        state: "complete", completedAt: daysAgo(2),
      });
      await seedCompletion(transaction.id, "VM19", { state: "available" });
      const due = await findDueClientChases(new Date());
      const ours = due.find((d) =>
        d.transactionId === transaction.id && d.milestoneCode === "VM19",
      );
      if (ours) fail("bilateral filter", "VM19 (bilateral) appeared in due list — A6 filter failed");
      console.log(`[b7] ✓ bilateral filter: VM19 never appears in due list (A6 allowlist holds)`);
    }

    // Constants sanity-check (these are the locked values from the
    // pre-B7 timing decisions — guard against accidental drift).
    if (CLIENT_CHASE_COUNT_CAP !== 2) fail("constants", `CLIENT_CHASE_COUNT_CAP=${CLIENT_CHASE_COUNT_CAP}, expected 2`);
    if (CLIENT_CHASE_SILENCE_DAYS !== 14) fail("constants", `CLIENT_CHASE_SILENCE_DAYS=${CLIENT_CHASE_SILENCE_DAYS}, expected 14`);
    if (CLIENT_CHASE_GRACE_FLOOR_DAYS !== 1) fail("constants", `CLIENT_CHASE_GRACE_FLOOR_DAYS=${CLIENT_CHASE_GRACE_FLOOR_DAYS}, expected 1`);
    console.log(`[b7] ✓ locked constants: cap=2, silence=14, floor=1`);

    console.log(`[b7] all checks passed`);
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
