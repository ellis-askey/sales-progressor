// PR 3 verification — exchange snapshot + billable marker.
//
// Exercises maybeStampExchange against the staging DB, covering the four
// concerns Ellis emphasised:
//
//   1. Non-trial vendor file: VM19 sets exchangedAt + billedAtExchange +
//      priceAtExchange snapshot.
//   2. Bilateral non-double-stamp: the SAME transaction's PM26 call (which
//      production fires automatically as the bilateral partner) does NOT
//      overwrite billedAtExchange. The NULL-guarded updateMany means the
//      second call's WHERE matches 0 rows.
//   3. Trial file (freeOnExchange = true): exchangedAt set but billedAtExchange
//      and priceAtExchange stay null. Trial files exchange without billing.
//   4. Price-edit immunity: changing purchasePrice after exchange does NOT
//      alter priceAtExchange. The snapshot is durable.
//
// Plus a smoke check that a non-exchange milestone code (e.g. VM3) is a no-op.
//
// The helper is called directly to exercise its truth table exhaustively.
// Its wiring into completeMilestone is unambiguous in the diff
// (single unconditional call inside the function body, gated by code only
// inside the helper itself).
//
// Cleans up its own test data by prefix. Re-runnable.
//
// Run: npx ts-node --transpile-only --compiler-options
//        '{"module":"CommonJS","moduleResolution":"node","baseUrl":".",
//          "paths":{"@/*":["./*"]}}'
//        --require tsconfig-paths/register
//        scripts/verify-pr3-exchange-stamp-staging.ts

import { PrismaClient } from "@prisma/client";
import { maybeStampExchange } from "../lib/services/billing-trigger";

const p = new PrismaClient();
const TEST_PREFIX = "PR3-VERIFY-";

async function cleanup() {
  await p.milestoneCompletion.deleteMany({
    where: { transaction: { agency: { name: { startsWith: TEST_PREFIX } } } },
  });
  await p.propertyTransaction.deleteMany({
    where: { agency: { name: { startsWith: TEST_PREFIX } } },
  });
  await p.agency.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
}

function fmt(v: Date | number | null | undefined): string {
  if (v === null || v === undefined) return "null";
  if (v instanceof Date) return v.toISOString();
  return String(v);
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

async function makeTestTx(opts: {
  agencyName: string;
  freeOnExchange: boolean;
  purchasePrice: number;
}) {
  const agency = await p.agency.create({
    data: {
      name: opts.agencyName,
      // Anchor firstSubmissionAt to long-ago so the stamp doesn't accidentally
      // matter — we set freeOnExchange explicitly below.
      firstSubmissionAt: new Date("2025-01-01"),
    },
  });
  const tx = await p.propertyTransaction.create({
    data: {
      propertyAddress: `${opts.agencyName} — Test`,
      agencyId: agency.id,
      freeOnExchange: opts.freeOnExchange,
      purchasePrice: opts.purchasePrice,
    },
  });
  return { agency, tx };
}

async function main() {
  await cleanup();

  try {
    // ─── Scenario 1 ────────────────────────────────────────────────────
    divider("1. Non-trial file: VM19 stamps exchangedAt + billing + price snapshot");
    const { tx: tx1 } = await makeTestTx({
      agencyName: `${TEST_PREFIX}non-trial-1`,
      freeOnExchange: false,
      purchasePrice: 45_000_000, // £450k in pence (mid band — would bill £300)
    });
    await p.$transaction(async (db) => {
      await maybeStampExchange(tx1.id, "VM19", db);
    });
    const tx1After = await p.propertyTransaction.findUnique({ where: { id: tx1.id } });
    console.log(`  exchangedAt:      ${fmt(tx1After!.exchangedAt)}`);
    console.log(`  billedAtExchange: ${fmt(tx1After!.billedAtExchange)}`);
    console.log(`  priceAtExchange:  ${fmt(tx1After!.priceAtExchange)}`);
    check("exchangedAt set", tx1After!.exchangedAt !== null);
    check("billedAtExchange set", tx1After!.billedAtExchange !== null);
    check(
      "priceAtExchange === purchasePrice snapshot",
      tx1After!.priceAtExchange === 45_000_000,
      `expected 45000000, got ${tx1After!.priceAtExchange}`,
    );

    // ─── Scenario 2 ────────────────────────────────────────────────────
    divider("2. Bilateral non-double-stamp: PM26 partner call doesn't overwrite");
    const { tx: tx2 } = await makeTestTx({
      agencyName: `${TEST_PREFIX}bilateral-2`,
      freeOnExchange: false,
      purchasePrice: 60_000_000, // £600k (top band)
    });
    // Mimic confirmMilestoneAction: both primary and bilateral partner in one $transaction
    const { afterPrimary, afterPartner } = await p.$transaction(async (db) => {
      // Primary side (user confirmed VM19)
      await maybeStampExchange(tx2.id, "VM19", db);
      const a = await db.propertyTransaction.findUnique({
        where: { id: tx2.id },
        select: { exchangedAt: true, billedAtExchange: true, priceAtExchange: true },
      });
      // Bilateral partner (PM26 auto-completed by the caller's bilateral logic)
      await maybeStampExchange(tx2.id, "PM26", db);
      const b = await db.propertyTransaction.findUnique({
        where: { id: tx2.id },
        select: { exchangedAt: true, billedAtExchange: true, priceAtExchange: true },
      });
      return { afterPrimary: a, afterPartner: b };
    });
    console.log(`  after primary VM19:    billedAt=${fmt(afterPrimary!.billedAtExchange)} priceAt=${fmt(afterPrimary!.priceAtExchange)}`);
    console.log(`  after partner PM26:    billedAt=${fmt(afterPartner!.billedAtExchange)} priceAt=${fmt(afterPartner!.priceAtExchange)}`);
    check(
      "billedAtExchange identical after partner call (no double-stamp)",
      afterPrimary!.billedAtExchange!.getTime() === afterPartner!.billedAtExchange!.getTime(),
      `primary=${fmt(afterPrimary!.billedAtExchange)} partner=${fmt(afterPartner!.billedAtExchange)}`,
    );
    check(
      "exchangedAt identical after partner call (no double-stamp)",
      afterPrimary!.exchangedAt!.getTime() === afterPartner!.exchangedAt!.getTime(),
    );
    check(
      "priceAtExchange identical after partner call",
      afterPrimary!.priceAtExchange === afterPartner!.priceAtExchange,
    );
    check(
      "billedAtExchange has a real value (control: stamp actually fires)",
      afterPrimary!.billedAtExchange !== null,
    );

    // ─── Scenario 3 ────────────────────────────────────────────────────
    divider("3. Trial file: exchanges but does NOT bill");
    const { tx: tx3 } = await makeTestTx({
      agencyName: `${TEST_PREFIX}trial-3`,
      freeOnExchange: true,
      purchasePrice: 30_000_000, // £300k (would have been bottom band if billed)
    });
    await p.$transaction(async (db) => {
      await maybeStampExchange(tx3.id, "VM19", db);
    });
    const tx3After = await p.propertyTransaction.findUnique({ where: { id: tx3.id } });
    console.log(`  exchangedAt:      ${fmt(tx3After!.exchangedAt)}`);
    console.log(`  billedAtExchange: ${fmt(tx3After!.billedAtExchange)}`);
    console.log(`  priceAtExchange:  ${fmt(tx3After!.priceAtExchange)}`);
    check("exchangedAt set (trial files still exchange)", tx3After!.exchangedAt !== null);
    check("billedAtExchange NULL (trial files don't bill)", tx3After!.billedAtExchange === null);
    check("priceAtExchange NULL (trial files don't snapshot)", tx3After!.priceAtExchange === null);

    // ─── Scenario 4 ────────────────────────────────────────────────────
    divider("4. Price-edit immunity: post-exchange purchasePrice edit doesn't move priceAtExchange");
    const { tx: tx4 } = await makeTestTx({
      agencyName: `${TEST_PREFIX}immunity-4`,
      freeOnExchange: false,
      purchasePrice: 20_000_000, // £200k (bottom band — would bill £250)
    });
    await p.$transaction(async (db) => {
      await maybeStampExchange(tx4.id, "VM19", db);
    });
    const tx4AtExchange = await p.propertyTransaction.findUnique({ where: { id: tx4.id } });
    console.log(`  priceAtExchange at exchange: ${fmt(tx4AtExchange!.priceAtExchange)}`);
    // Renegotiation simulation
    await p.propertyTransaction.update({
      where: { id: tx4.id },
      data: { purchasePrice: 99_999_900 },
    });
    // Retry the stamp (simulating a duplicate completion call after the edit)
    await p.$transaction(async (db) => {
      await maybeStampExchange(tx4.id, "VM19", db);
    });
    const tx4Final = await p.propertyTransaction.findUnique({ where: { id: tx4.id } });
    console.log(`  purchasePrice after edit:    ${fmt(tx4Final!.purchasePrice)}`);
    console.log(`  priceAtExchange after retry: ${fmt(tx4Final!.priceAtExchange)}`);
    check(
      "priceAtExchange unchanged after purchasePrice edit",
      tx4Final!.priceAtExchange === 20_000_000,
      `expected 20000000, got ${tx4Final!.priceAtExchange}`,
    );
    check(
      "purchasePrice does reflect the edit (control)",
      tx4Final!.purchasePrice === 99_999_900,
    );

    // ─── Scenario 5 ────────────────────────────────────────────────────
    divider("5. Non-exchange milestone code: no-op (early return guard)");
    const { tx: tx5 } = await makeTestTx({
      agencyName: `${TEST_PREFIX}noop-5`,
      freeOnExchange: false,
      purchasePrice: 40_000_000,
    });
    await p.$transaction(async (db) => {
      await maybeStampExchange(tx5.id, "VM3", db); // arbitrary non-exchange code
    });
    const tx5After = await p.propertyTransaction.findUnique({ where: { id: tx5.id } });
    console.log(`  exchangedAt:      ${fmt(tx5After!.exchangedAt)}`);
    console.log(`  billedAtExchange: ${fmt(tx5After!.billedAtExchange)}`);
    check("exchangedAt remains NULL (non-exchange code)", tx5After!.exchangedAt === null);
    check("billedAtExchange remains NULL (non-exchange code)", tx5After!.billedAtExchange === null);
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
