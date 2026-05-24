// PR 2 verification — trial stamp + freeOnExchange writes.
//
// Exercises the four scenarios Ellis asked for, against the staging DB:
//   1. Brand-new agency creates a file
//        → firstSubmissionAt set, freeOnExchange = true
//   2. Same agency creates a second file the same day
//        → freeOnExchange still true, firstSubmissionAt unchanged
//   3. A second agency with firstSubmissionAt backdated 8 days creates a file
//        → freeOnExchange = false, firstSubmissionAt unchanged
//   4. Fresh claim-signup (new Agency + User + claimed PropertyTransaction)
//        → claimed file freeOnExchange = true, firstSubmissionAt set on the new agency
//
// Scenarios 1–3 call createTransaction() directly so the real
// lib/services/transactions.ts path is exercised. Scenario 4 replicates the
// inline $transaction block from app/api/claim/route.ts (which now calls the
// same stampTrialState helper) so the integration is proven for both surfaces.
//
// Cleans up its own test data by prefix on the way in and out, so it can be
// re-run idempotently and never leaves orphans in staging.
//
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' \
//        scripts/verify-pr2-trial-stamp-staging.ts

import { PrismaClient } from "@prisma/client";
import { createTransaction } from "../lib/services/transactions";
import { stampTrialState } from "../lib/services/trial";

const p = new PrismaClient();
const TEST_PREFIX = "PR2-VERIFY-";

async function cleanup() {
  // Children before parents.
  await p.milestoneCompletion.deleteMany({
    where: { transaction: { agency: { name: { startsWith: TEST_PREFIX } } } },
  });
  await p.chainLink.deleteMany({
    where: { chain: { agency: { name: { startsWith: TEST_PREFIX } } } },
  });
  await p.propertyChain.deleteMany({
    where: { agency: { name: { startsWith: TEST_PREFIX } } },
  });
  await p.propertyTransaction.deleteMany({
    where: { agency: { name: { startsWith: TEST_PREFIX } } },
  });
  await p.user.deleteMany({
    where: { agency: { name: { startsWith: TEST_PREFIX } } },
  });
  await p.agency.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
}

function fmt(d: Date | null | undefined): string {
  return d ? d.toISOString() : "null";
}

function divider(label: string): void {
  console.log("");
  console.log(`── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`);
}

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function main() {
  await cleanup();

  try {
    // ─── Scenario 1 ────────────────────────────────────────────────────
    divider("1. Brand-new agency creates a file");
    const agency1 = await p.agency.create({ data: { name: `${TEST_PREFIX}fresh-1` } });
    console.log(`  agency.firstSubmissionAt (before): ${fmt(agency1.firstSubmissionAt)}`);
    const tx1 = await createTransaction({
      propertyAddress: "1 Test Lane, London",
      agencyId: agency1.id,
    });
    const agency1After = await p.agency.findUnique({ where: { id: agency1.id } });
    console.log(`  agency.firstSubmissionAt (after):  ${fmt(agency1After!.firstSubmissionAt)}`);
    console.log(`  tx.freeOnExchange:                 ${tx1.freeOnExchange}`);
    check("firstSubmissionAt set (was null, now non-null)", agency1After!.firstSubmissionAt !== null);
    check("freeOnExchange === true", tx1.freeOnExchange === true);

    // ─── Scenario 2 ────────────────────────────────────────────────────
    divider("2. Same agency creates a second file same day");
    const firstSubBefore = agency1After!.firstSubmissionAt!;
    const tx2 = await createTransaction({
      propertyAddress: "2 Test Lane, London",
      agencyId: agency1.id,
    });
    const agency1AfterSecond = await p.agency.findUnique({ where: { id: agency1.id } });
    console.log(`  agency.firstSubmissionAt (after 2nd create): ${fmt(agency1AfterSecond!.firstSubmissionAt)}`);
    console.log(`  tx2.freeOnExchange:                          ${tx2.freeOnExchange}`);
    check(
      "firstSubmissionAt unchanged",
      agency1AfterSecond!.firstSubmissionAt!.getTime() === firstSubBefore.getTime(),
      `before=${fmt(firstSubBefore)} after=${fmt(agency1AfterSecond!.firstSubmissionAt)}`,
    );
    check("freeOnExchange === true (still inside 7-day window)", tx2.freeOnExchange === true);

    // ─── Scenario 3 ────────────────────────────────────────────────────
    divider("3. Agency with firstSubmissionAt backdated 8 days creates a file");
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const agency3 = await p.agency.create({
      data: {
        name: `${TEST_PREFIX}backdated-3`,
        firstSubmissionAt: eightDaysAgo,
      },
    });
    console.log(`  agency.firstSubmissionAt (seeded 8d ago): ${fmt(agency3.firstSubmissionAt)}`);
    const tx3 = await createTransaction({
      propertyAddress: "3 Old Lane, London",
      agencyId: agency3.id,
    });
    const agency3After = await p.agency.findUnique({ where: { id: agency3.id } });
    console.log(`  agency.firstSubmissionAt (after create):  ${fmt(agency3After!.firstSubmissionAt)}`);
    console.log(`  tx3.freeOnExchange:                       ${tx3.freeOnExchange}`);
    check(
      "firstSubmissionAt unchanged (still the seeded 8-days-ago value)",
      agency3After!.firstSubmissionAt!.getTime() === eightDaysAgo.getTime(),
    );
    check("freeOnExchange === false (outside 7-day window)", tx3.freeOnExchange === false);

    // ─── Scenario 4 ────────────────────────────────────────────────────
    divider("4. Fresh claim-signup creates Agency + claimed file");
    // Mirror the production sequence: /api/register creates Agency+User,
    // then /api/claim's $transaction block creates the PropertyTransaction
    // tied to a chain link. We replicate the claim block here so the
    // integration is tested on the same code path as production (post-edit).

    // 4a. Stand up a chain with an unclaimed stub link, owned by a
    // separate originator agency, so the claim has somewhere to attach.
    const originatorAgency = await p.agency.create({ data: { name: `${TEST_PREFIX}originator` } });
    const originatorUser = await p.user.create({
      data: {
        name: "Originator Agent",
        email: `${TEST_PREFIX}originator@example.test`,
        password: "x",
        role: "director",
        agencyId: originatorAgency.id,
      },
    });
    const chain = await p.propertyChain.create({
      data: {
        agencyId: originatorAgency.id,
        createdByUserId: originatorUser.id,
      },
    });
    const stubLink = await p.chainLink.create({
      data: {
        chainId: chain.id,
        position: 1,
        stubPropertyAddress: "4 Stub Avenue, London",
        stubAgentEmail: `${TEST_PREFIX}claimer@example.test`,
        inviteToken: `${TEST_PREFIX}token-${Date.now()}`,
        inviteStatus: "SENT",
        createdByUserId: originatorUser.id,
      },
    });

    // 4b. Claim-signup: createDirectorWithAgency-equivalent
    // (fresh Agency + User, both brand-new in the same flow).
    const claimerAgency = await p.agency.create({ data: { name: `${TEST_PREFIX}claimer-agency` } });
    const claimerUser = await p.user.create({
      data: {
        name: "Fresh Claimer",
        email: `${TEST_PREFIX}claimer@example.test`,
        password: "x",
        role: "director",
        agencyId: claimerAgency.id,
      },
    });
    console.log(`  claimer agency.firstSubmissionAt (before): ${fmt(claimerAgency.firstSubmissionAt)}`);

    // 4c. The claim's $transaction block — copied shape-for-shape from
    // app/api/claim/route.ts action="create". stampTrialState is called
    // inside the same tx as propertyTransaction.create, just like the
    // route handler does post-edit.
    const claimResult = await p.$transaction(async (tx) => {
      const freeOnExchange = await stampTrialState(claimerAgency.id, tx);
      const newTxn = await tx.propertyTransaction.create({
        data: {
          propertyAddress: stubLink.stubPropertyAddress ?? "",
          agencyId: claimerAgency.id,
          agentUserId: claimerUser.id,
          progressedBy: "agent",
          serviceType: "self_managed",
          tenure: "freehold",
          purchaseType: "mortgage",
          isShareOfFreehold: false,
          freeOnExchange,
        },
      });
      await tx.chainLink.update({
        where: { id: stubLink.id },
        data: {
          transactionId: newTxn.id,
          claimedByUserId: claimerUser.id,
          claimedAt: new Date(),
          inviteStatus: "CLAIMED",
        },
      });
      await tx.propertyTransaction.update({
        where: { id: newTxn.id },
        data: { chainLinkId: stubLink.id },
      });
      return { transactionId: newTxn.id };
    });

    const claimedTx = await p.propertyTransaction.findUnique({ where: { id: claimResult.transactionId } });
    const claimerAgencyAfter = await p.agency.findUnique({ where: { id: claimerAgency.id } });
    console.log(`  claimer agency.firstSubmissionAt (after):  ${fmt(claimerAgencyAfter!.firstSubmissionAt)}`);
    console.log(`  claimed tx.freeOnExchange:                 ${claimedTx!.freeOnExchange}`);
    check(
      "firstSubmissionAt set on the new claimer agency",
      claimerAgencyAfter!.firstSubmissionAt !== null,
    );
    check("claimed tx.freeOnExchange === true", claimedTx!.freeOnExchange === true);
    check(
      "claimed tx anchored to claimer agency",
      claimedTx!.agencyId === claimerAgency.id,
    );
  } finally {
    divider("Cleanup");
    await cleanup();
    console.log("  test data removed");
    await p.$disconnect();
  }

  console.log("");
  if (failures === 0) {
    console.log("✓ All scenarios passed");
    process.exit(0);
  } else {
    console.log(`✗ ${failures} check(s) failed`);
    process.exit(1);
  }
}

void main();
