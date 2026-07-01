// Phase 1 commit 4d post-fix demonstration.
//
// Picks a real PM-targeted ChaseTask on staging, builds a contactIds
// array that mimics the chase drawer's "send to purchaser + solicitor"
// shape (Contact rows of roleType purchaser AND solicitor — the
// canonical solicitor-targeted chase). Calls createCommunicationRecord
// directly (no auth layer) and inspects the resulting OutboundMessage
// row's buyerRoundId stamp.
//
// Expected: buyerRoundId set to the transaction's activeBuyerRoundId
// because the chaseTaskId resolves to a PM* targetMilestoneCode, which
// triggers the side-hint path in decideBuyerSideStamp.
//
// Read-only-ish: writes one sentinel OutboundMessage, then deletes it.

// React.cache polyfill (see banner in parity harness).
const React = require("react");
React.cache = (fn: unknown) => fn;

import { PrismaClient } from "@prisma/client";
import { createCommunicationRecord } from "@/lib/services/comms";

const prisma = new PrismaClient();

async function main() {
  // Find a PM-targeted ChaseTask with the surrounding data we need.
  const candidates = await prisma.chaseTask.findMany({
    where: {
      reminderLog: {
        reminderRule: { targetMilestoneCode: { startsWith: "PM" } },
      },
    },
    include: {
      reminderLog: {
        select: {
          reminderRule: { select: { targetMilestoneCode: true } },
        },
      },
      transaction: {
        select: {
          id: true,
          propertyAddress: true,
          activeBuyerRoundId: true,
          agencyId: true,
          contacts: { select: { id: true, roleType: true, name: true } },
        },
      },
    },
    take: 50,
  });

  // Filter for a tx with both a purchaser Contact AND a solicitor Contact —
  // that's the canonical "chase to purchaser's solicitor" scenario.
  const usable = candidates.find((c) => {
    const cs = c.transaction.contacts;
    return cs.some((x) => x.roleType === "purchaser") && cs.some((x) => x.roleType === "solicitor");
  });
  if (!usable) {
    console.log("No staging file has both a purchaser AND a solicitor Contact + a PM chase task.");
    console.log("Cannot demonstrate the canonical scenario — falling back to PM-only.");
    if (candidates.length === 0) throw new Error("No PM chase tasks on staging");
  }
  const task = usable ?? candidates[0]!;
  const tx = task.transaction;
  const contactIds = tx.contacts
    .filter((c) => ["purchaser", "solicitor", "vendor"].includes(c.roleType))
    .map((c) => c.id);

  console.log("Demonstration setup");
  console.log(`  chaseTask:           ${task.id}`);
  console.log(`  targetMilestoneCode: ${task.reminderLog.reminderRule.targetMilestoneCode}`);
  console.log(`  transactionId:       ${tx.id}`);
  console.log(`  propertyAddress:     ${tx.propertyAddress}`);
  console.log(`  activeBuyerRoundId:  ${tx.activeBuyerRoundId}`);
  console.log(`  contactIds passed:   ${contactIds.length} contacts`);
  for (const c of tx.contacts) {
    const inUse = contactIds.includes(c.id) ? "USED" : "skip";
    console.log(`    [${inUse}] ${c.id}  roleType=${c.roleType}  name="${c.name}"`);
  }

  // Pick any user on the tx as the createdById.
  const someUser = await prisma.user.findFirst({ where: { agencyId: tx.agencyId }, select: { id: true } });
  if (!someUser) throw new Error("no user on this agency");

  // Sentinel marker on content so we can find + delete the row.
  const sentinelTag = `__BUYER_ROUND_DEMO_${Date.now()}__`;
  const content = `${sentinelTag} demo chase comm — should be round-stamped via side-hint from chaseTaskId.`;

  console.log(`\nInvoking createCommunicationRecord...`);
  const record = await createCommunicationRecord({
    transactionId: tx.id,
    chaseTaskId: task.id,
    type: "outbound",
    method: "email",
    contactIds,
    content,
    createdById: someUser.id,
    scope: { kind: "all" }, // admin scope so the ownership check passes
  });

  console.log(`\nWritten OutboundMessage:`);
  console.log(`  id:           ${record.id}`);
  console.log(`  buyerRoundId: ${record.buyerRoundId}`);
  console.log(`  chaseTaskId:  ${record.chaseTaskId}`);
  console.log(`  contactIds:   ${JSON.stringify(record.contactIds)}`);

  // Verify the stamp is correct.
  const expectedRoundId = tx.activeBuyerRoundId;
  const passed = record.buyerRoundId === expectedRoundId;
  console.log(`\nVerification:`);
  console.log(`  expected buyerRoundId: ${expectedRoundId}`);
  console.log(`  actual   buyerRoundId: ${record.buyerRoundId}`);
  console.log(`  result:                ${passed ? "PASS" : "FAIL"}`);

  // Tear down the sentinel.
  await prisma.outboundMessage.delete({ where: { id: record.id } });
  console.log(`\nSentinel deleted.`);

  if (!passed) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
