// PR 4 verification — exchange reversal handler.
//
// Mirror of PR 3's verifier. Exercises handleExchangeReversal directly,
// covering the four concerns Ellis emphasised for this PR:
//
//   1. Branch (a): non-trial file, billed, NO issued invoice → reversal
//      clears exchangedAt + billedAtExchange + priceAtExchange. File drops
//      off the building invoice cleanly.
//
//   2. Branch (a) bilateral: same setup, fire VM19 reversal then PM26
//      partner reversal in same $transaction. Second call is a no-op
//      via the NULL-guarded updateMany — fields stay cleared, no second
//      write.
//
//   3. Branch (b): non-trial file, billed, invoice ISSUED for that month →
//      reversal preserves billing fields, creates ONE CreditNote with the
//      correct fee amount (tested for both outsourced-tiered and in-house
//      flat £59).
//
//   4. Branch (b) bilateral (the headline): same setup, fire VM19 reversal
//      then PM26 partner reversal in same $transaction. Existing-credit
//      lookup short-circuits the second call — exactly ONE CreditNote
//      exists for the transaction, not two.
//
// Plus: trial file (billedAtExchange null at start) clears exchangedAt
// only; non-exchange code is a no-op.
//
// Cleans up by test prefix. Re-runnable.
//
// Run: npx ts-node --transpile-only --compiler-options
//        '{"module":"CommonJS","moduleResolution":"node","baseUrl":".",
//          "paths":{"@/*":["./*"]}}'
//        --require tsconfig-paths/register
//        scripts/verify-pr4-exchange-reversal-staging.ts

import { PrismaClient } from "@prisma/client";
import { handleExchangeReversal } from "../lib/services/billing-reversal";

const p = new PrismaClient();
const TEST_PREFIX = "PR4-VERIFY-";

async function cleanup() {
  await p.creditNote.deleteMany({
    where: { agency: { name: { startsWith: TEST_PREFIX } } },
  });
  await p.invoiceLine.deleteMany({
    where: { invoice: { agency: { name: { startsWith: TEST_PREFIX } } } },
  });
  await p.invoice.deleteMany({
    where: { agency: { name: { startsWith: TEST_PREFIX } } },
  });
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

function monthStartUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function makePostExchangeTx(opts: {
  agencyName: string;
  serviceType: "self_managed" | "outsourced";
  freeOnExchange: boolean;
  purchasePrice: number;
  billedAtExchange: Date | null;
  priceAtExchange: number | null;
  exchangedAt: Date | null;
}) {
  const agency = await p.agency.create({
    data: { name: opts.agencyName, firstSubmissionAt: new Date("2025-01-01") },
  });
  const tx = await p.propertyTransaction.create({
    data: {
      propertyAddress: `${opts.agencyName} — Test`,
      agencyId: agency.id,
      serviceType: opts.serviceType,
      freeOnExchange: opts.freeOnExchange,
      purchasePrice: opts.purchasePrice,
      exchangedAt: opts.exchangedAt,
      billedAtExchange: opts.billedAtExchange,
      priceAtExchange: opts.priceAtExchange,
    },
  });
  return { agency, tx };
}

async function main() {
  await cleanup();

  try {
    const now = new Date();

    // ─── Scenario 1 ────────────────────────────────────────────────────
    divider("1. Branch (a): non-trial, billed, NO issued invoice → reversal clears");
    const { tx: tx1 } = await makePostExchangeTx({
      agencyName: `${TEST_PREFIX}branch-a-1`,
      serviceType: "outsourced",
      freeOnExchange: false,
      purchasePrice: 45_000_000,
      billedAtExchange: now,
      priceAtExchange: 45_000_000,
      exchangedAt: now,
    });
    await p.$transaction(async (db) => {
      await handleExchangeReversal(tx1.id, "VM19", db);
    });
    const tx1After = await p.propertyTransaction.findUnique({ where: { id: tx1.id } });
    console.log(`  exchangedAt:      ${fmt(tx1After!.exchangedAt)}`);
    console.log(`  billedAtExchange: ${fmt(tx1After!.billedAtExchange)}`);
    console.log(`  priceAtExchange:  ${fmt(tx1After!.priceAtExchange)}`);
    check("exchangedAt cleared", tx1After!.exchangedAt === null);
    check("billedAtExchange cleared", tx1After!.billedAtExchange === null);
    check("priceAtExchange cleared", tx1After!.priceAtExchange === null);
    const creditsForTx1 = await p.creditNote.count({ where: { transactionId: tx1.id } });
    check("no CreditNote written (branch a doesn't credit)", creditsForTx1 === 0);

    // ─── Scenario 2 ────────────────────────────────────────────────────
    divider("2. Branch (a) bilateral: VM19 then PM26 partner reversal — second is no-op");
    const { tx: tx2 } = await makePostExchangeTx({
      agencyName: `${TEST_PREFIX}branch-a-bilateral-2`,
      serviceType: "outsourced",
      freeOnExchange: false,
      purchasePrice: 60_000_000,
      billedAtExchange: now,
      priceAtExchange: 60_000_000,
      exchangedAt: now,
    });
    const { afterPrimary, afterPartner } = await p.$transaction(async (db) => {
      await handleExchangeReversal(tx2.id, "VM19", db);
      const a = await db.propertyTransaction.findUnique({
        where: { id: tx2.id },
        select: { exchangedAt: true, billedAtExchange: true, priceAtExchange: true },
      });
      await handleExchangeReversal(tx2.id, "PM26", db);
      const b = await db.propertyTransaction.findUnique({
        where: { id: tx2.id },
        select: { exchangedAt: true, billedAtExchange: true, priceAtExchange: true },
      });
      return { afterPrimary: a, afterPartner: b };
    });
    console.log(`  after primary VM19 reversal:  billedAt=${fmt(afterPrimary!.billedAtExchange)} priceAt=${fmt(afterPrimary!.priceAtExchange)}`);
    console.log(`  after partner PM26 reversal:  billedAt=${fmt(afterPartner!.billedAtExchange)} priceAt=${fmt(afterPartner!.priceAtExchange)}`);
    check("billedAtExchange null after primary reversal", afterPrimary!.billedAtExchange === null);
    check("billedAtExchange still null after partner call (no re-stamp)", afterPartner!.billedAtExchange === null);
    check("priceAtExchange null after primary", afterPrimary!.priceAtExchange === null);
    check("priceAtExchange still null after partner (no re-write)", afterPartner!.priceAtExchange === null);

    // ─── Scenario 3a ───────────────────────────────────────────────────
    divider("3a. Branch (b): outsourced file, invoice ISSUED → CreditNote of correct fee");
    const billedDate3a = new Date(now);
    const { agency: agency3a, tx: tx3a } = await makePostExchangeTx({
      agencyName: `${TEST_PREFIX}branch-b-outsourced-3a`,
      serviceType: "outsourced",
      freeOnExchange: false,
      purchasePrice: 60_000_000, // top band → £350 fee = 35000 pence
      billedAtExchange: billedDate3a,
      priceAtExchange: 60_000_000,
      exchangedAt: billedDate3a,
    });
    // Simulate the cron having issued the invoice for the billing month.
    await p.invoice.create({
      data: {
        agencyId: agency3a.id,
        monthStart: monthStartUtc(billedDate3a),
        status: "issued",
        issuedAt: new Date(),
      },
    });
    await p.$transaction(async (db) => {
      await handleExchangeReversal(tx3a.id, "VM19", db);
    });
    const tx3aAfter = await p.propertyTransaction.findUnique({ where: { id: tx3a.id } });
    const credits3a = await p.creditNote.findMany({ where: { transactionId: tx3a.id } });
    console.log(`  billedAtExchange (post): ${fmt(tx3aAfter!.billedAtExchange)}`);
    console.log(`  priceAtExchange (post):  ${fmt(tx3aAfter!.priceAtExchange)}`);
    console.log(`  CreditNote count:        ${credits3a.length}`);
    if (credits3a[0]) {
      console.log(`  CreditNote amount:       ${credits3a[0].amountPence} pence (£${credits3a[0].amountPence / 100})`);
      console.log(`  CreditNote reason:       ${credits3a[0].reason}`);
    }
    check("billedAtExchange preserved (history)", tx3aAfter!.billedAtExchange !== null);
    check("priceAtExchange preserved", tx3aAfter!.priceAtExchange === 60_000_000);
    check("exactly ONE CreditNote written", credits3a.length === 1);
    check(
      "CreditNote amount = £350 (outsourced top band)",
      credits3a[0]?.amountPence === 35000,
      `expected 35000, got ${credits3a[0]?.amountPence}`,
    );

    // ─── Scenario 3b ───────────────────────────────────────────────────
    divider("3b. Branch (b): in-house file, invoice ISSUED → CreditNote of £59");
    const billedDate3b = new Date(now);
    const { agency: agency3b, tx: tx3b } = await makePostExchangeTx({
      agencyName: `${TEST_PREFIX}branch-b-inhouse-3b`,
      serviceType: "self_managed",
      freeOnExchange: false,
      purchasePrice: 30_000_000, // price doesn't matter for in-house
      billedAtExchange: billedDate3b,
      priceAtExchange: 30_000_000,
      exchangedAt: billedDate3b,
    });
    await p.invoice.create({
      data: {
        agencyId: agency3b.id,
        monthStart: monthStartUtc(billedDate3b),
        status: "issued",
        issuedAt: new Date(),
      },
    });
    await p.$transaction(async (db) => {
      await handleExchangeReversal(tx3b.id, "VM19", db);
    });
    const credits3b = await p.creditNote.findMany({ where: { transactionId: tx3b.id } });
    console.log(`  CreditNote amount: ${credits3b[0]?.amountPence} pence (£${(credits3b[0]?.amountPence ?? 0) / 100})`);
    check("exactly ONE CreditNote written", credits3b.length === 1);
    check(
      "CreditNote amount = £59 (in-house flat)",
      credits3b[0]?.amountPence === 5900,
      `expected 5900, got ${credits3b[0]?.amountPence}`,
    );

    // ─── Scenario 4 ────────────────────────────────────────────────────
    divider("4. Branch (b) bilateral: VM19 then PM26 — exactly ONE CreditNote (the headline)");
    const billedDate4 = new Date(now);
    const { agency: agency4, tx: tx4 } = await makePostExchangeTx({
      agencyName: `${TEST_PREFIX}branch-b-bilateral-4`,
      serviceType: "outsourced",
      freeOnExchange: false,
      purchasePrice: 40_000_000, // mid band → £300 = 30000 pence
      billedAtExchange: billedDate4,
      priceAtExchange: 40_000_000,
      exchangedAt: billedDate4,
    });
    await p.invoice.create({
      data: {
        agencyId: agency4.id,
        monthStart: monthStartUtc(billedDate4),
        status: "issued",
        issuedAt: new Date(),
      },
    });
    const { creditsAfterPrimary, creditsAfterPartner } = await p.$transaction(async (db) => {
      await handleExchangeReversal(tx4.id, "VM19", db);
      const a = await db.creditNote.findMany({ where: { transactionId: tx4.id } });
      await handleExchangeReversal(tx4.id, "PM26", db);
      const b = await db.creditNote.findMany({ where: { transactionId: tx4.id } });
      return { creditsAfterPrimary: a, creditsAfterPartner: b };
    });
    console.log(`  CreditNotes after primary VM19 reversal:   ${creditsAfterPrimary.length} (amount ${creditsAfterPrimary[0]?.amountPence ?? "—"})`);
    console.log(`  CreditNotes after partner PM26 reversal:   ${creditsAfterPartner.length}`);
    check("ONE CreditNote after primary reversal", creditsAfterPrimary.length === 1);
    check(
      "STILL exactly ONE CreditNote after partner reversal (no double-credit)",
      creditsAfterPartner.length === 1,
      `expected 1, got ${creditsAfterPartner.length}`,
    );
    check(
      "CreditNote amount unchanged after partner call",
      creditsAfterPrimary[0]?.amountPence === creditsAfterPartner[0]?.amountPence,
    );
    check(
      "CreditNote amount = £300 (mid band)",
      creditsAfterPartner[0]?.amountPence === 30000,
    );
    const tx4After = await p.propertyTransaction.findUnique({ where: { id: tx4.id } });
    check("billedAtExchange preserved through bilateral pair", tx4After!.billedAtExchange !== null);
    check("priceAtExchange preserved through bilateral pair", tx4After!.priceAtExchange === 40_000_000);

    // ─── Scenario 5 ────────────────────────────────────────────────────
    divider("5. Trial file reversal: clears exchangedAt only, no billing fields to touch");
    const { tx: tx5 } = await makePostExchangeTx({
      agencyName: `${TEST_PREFIX}trial-5`,
      serviceType: "self_managed",
      freeOnExchange: true,
      purchasePrice: 30_000_000,
      billedAtExchange: null, // trial files never had this set
      priceAtExchange: null,
      exchangedAt: now,       // but exchangedAt was set on VM19 completion
    });
    await p.$transaction(async (db) => {
      await handleExchangeReversal(tx5.id, "VM19", db);
    });
    const tx5After = await p.propertyTransaction.findUnique({ where: { id: tx5.id } });
    const credits5 = await p.creditNote.count({ where: { transactionId: tx5.id } });
    console.log(`  exchangedAt:      ${fmt(tx5After!.exchangedAt)}`);
    console.log(`  billedAtExchange: ${fmt(tx5After!.billedAtExchange)}`);
    console.log(`  CreditNote count: ${credits5}`);
    check("exchangedAt cleared", tx5After!.exchangedAt === null);
    check("billedAtExchange still null (was null)", tx5After!.billedAtExchange === null);
    check("no CreditNote for trial file", credits5 === 0);

    // ─── Scenario 6 ────────────────────────────────────────────────────
    divider("6. Non-exchange code reversal: full no-op");
    const { tx: tx6 } = await makePostExchangeTx({
      agencyName: `${TEST_PREFIX}noop-6`,
      serviceType: "outsourced",
      freeOnExchange: false,
      purchasePrice: 40_000_000,
      billedAtExchange: now,
      priceAtExchange: 40_000_000,
      exchangedAt: now,
    });
    await p.$transaction(async (db) => {
      await handleExchangeReversal(tx6.id, "VM3", db); // arbitrary non-exchange
    });
    const tx6After = await p.propertyTransaction.findUnique({ where: { id: tx6.id } });
    const credits6 = await p.creditNote.count({ where: { transactionId: tx6.id } });
    check("exchangedAt unchanged", tx6After!.exchangedAt !== null);
    check("billedAtExchange unchanged", tx6After!.billedAtExchange !== null);
    check("priceAtExchange unchanged", tx6After!.priceAtExchange === 40_000_000);
    check("no CreditNote", credits6 === 0);
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
