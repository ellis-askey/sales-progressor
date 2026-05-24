// PR 5 verification — accrual + director running total.
//
// Covers Ellis's explicit asks plus the two carryover items from PR 3/4.
//
// Sections:
//   A. computeFee — all four cases (in-house, outsourced low/mid/high)
//   B. Accrual creates one Invoice per agency-month with correct lines
//      (in-house + outsourced together; line amounts via shared computeFee)
//   C. Accrual idempotency — re-run adds 0 new invoices and 0 new lines
//   D. Outsourced lines read priceAtExchange, NOT the live purchasePrice
//      (the headline immunity check at accrual time)
//   E. Branch (a) reversal AFTER accrual: re-accrue removes orphan line
//   F. Live running total reads PropertyTransaction directly — matches
//      reality before any cron runs, AND ignores InvoiceLine state (proving
//      it's not cron-dependent)
//   G. CreditNote application: unapplied credit becomes credit_applied
//      line; CreditNote.appliedAt + appliedToInvoiceId get set
//   H. Partial unique index: a second unapplied CreditNote for the same
//      transaction fails with a unique violation
//
// Cleans up by PR5-VERIFY- prefix. Re-runnable.
//
// Run: npx ts-node --transpile-only --compiler-options
//        '{"module":"CommonJS","moduleResolution":"node","baseUrl":".",
//          "paths":{"@/*":["./*"]}}'
//        --require tsconfig-paths/register
//        scripts/verify-pr5-accrual-staging.ts

import { PrismaClient } from "@prisma/client";
import { accrueInvoicesForCurrentMonth } from "../lib/billing/accrual";
import { getCurrentMonthRunningTotal } from "../lib/billing/running-total";
import { computeFee } from "../lib/billing/fee";
import { billingMonthRange } from "../lib/billing/period";

const p = new PrismaClient();
const TEST_PREFIX = "PR5-VERIFY-";

async function cleanup() {
  await p.invoiceLine.deleteMany({
    where: { invoice: { agency: { name: { startsWith: TEST_PREFIX } } } },
  });
  await p.creditNote.deleteMany({
    where: { agency: { name: { startsWith: TEST_PREFIX } } },
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
    const now = new Date();

    // ─── A. computeFee unit truth table ────────────────────────────────
    divider("A. computeFee — shared helper covers in-house + 3 outsourced bands");
    const inHouse = computeFee("self_managed", 30_000_000);
    const outLow = computeFee("outsourced", 30_000_000);   // £300k → low band
    const outMid = computeFee("outsourced", 40_000_000);   // £400k → mid band
    const outHigh = computeFee("outsourced", 60_000_000);  // £600k → high band
    check("in-house: 5900p, kind=in_house_fee", inHouse.amountPence === 5900 && inHouse.kind === "in_house_fee");
    check("outsourced ≤ £349,999: 25000p, label includes 'up to £349,999'",
      outLow.amountPence === 25000 && outLow.bandLabel.includes("up to £349,999"));
    check("outsourced £350k–£499,999: 30000p, label includes '£350,000–£499,999'",
      outMid.amountPence === 30000 && outMid.bandLabel.includes("£350,000–£499,999"));
    check("outsourced ≥ £500,000: 35000p, label includes '£500,000+'",
      outHigh.amountPence === 35000 && outHigh.bandLabel.includes("£500,000+"));

    // ─── B. Accrual creates one Invoice with correct mixed lines ───────
    divider("B. Accrual: one Invoice per agency-month, lines via shared computeFee");
    const agencyB = await p.agency.create({ data: { name: `${TEST_PREFIX}accrual-B`, firstSubmissionAt: new Date("2025-01-01") } });
    // Three exchanged files this month: 1 in-house, 1 outsourced mid, 1 outsourced high
    const txB1 = await p.propertyTransaction.create({ data: {
      propertyAddress: "B1 In-house Lane", agencyId: agencyB.id, serviceType: "self_managed",
      purchasePrice: 30_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 30_000_000,
    }});
    const txB2 = await p.propertyTransaction.create({ data: {
      propertyAddress: "B2 Outsourced Mid", agencyId: agencyB.id, serviceType: "outsourced",
      purchasePrice: 40_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 40_000_000,
    }});
    const txB3 = await p.propertyTransaction.create({ data: {
      propertyAddress: "B3 Outsourced High", agencyId: agencyB.id, serviceType: "outsourced",
      purchasePrice: 60_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 60_000_000,
    }});
    const accrual1 = await accrueInvoicesForCurrentMonth();
    console.log(`  accrual: ${JSON.stringify(accrual1)}`);
    const invoicesB = await p.invoice.findMany({ where: { agencyId: agencyB.id } });
    const linesB = await p.invoiceLine.findMany({
      where: { invoiceId: invoicesB[0]?.id },
      orderBy: { totalPence: "asc" },
    });
    console.log(`  invoices for agency B: ${invoicesB.length}, status: ${invoicesB[0]?.status}`);
    console.log(`  lines: ${linesB.map(l => `${l.kind}=${l.totalPence}`).join(", ")}`);
    check("exactly ONE Invoice for agency B", invoicesB.length === 1);
    check("Invoice status = building", invoicesB[0]?.status === "building");
    check("3 lines (one per billed file)", linesB.length === 3);
    const sumB = linesB.reduce((s, l) => s + l.totalPence, 0);
    check("total = 5900 + 30000 + 35000 = 70900p", sumB === 70900, `got ${sumB}`);
    const txIdToLine = new Map(linesB.map(l => [l.transactionId, l]));
    check("in-house file → in_house_fee kind, 5900p",
      txIdToLine.get(txB1.id)?.kind === "in_house_fee" && txIdToLine.get(txB1.id)?.totalPence === 5900);
    check("£400k outsourced → outsourced_fee, 30000p",
      txIdToLine.get(txB2.id)?.kind === "outsourced_fee" && txIdToLine.get(txB2.id)?.totalPence === 30000);
    check("£600k outsourced → outsourced_fee, 35000p",
      txIdToLine.get(txB3.id)?.kind === "outsourced_fee" && txIdToLine.get(txB3.id)?.totalPence === 35000);

    // ─── C. Accrual idempotency ────────────────────────────────────────
    divider("C. Idempotency: re-running adds 0 invoices, 0 lines");
    const beforeLines = await p.invoiceLine.count({ where: { invoice: { agencyId: agencyB.id } } });
    const accrual2 = await accrueInvoicesForCurrentMonth();
    const afterLines = await p.invoiceLine.count({ where: { invoice: { agencyId: agencyB.id } } });
    console.log(`  before re-run: ${beforeLines} lines, after: ${afterLines} lines`);
    console.log(`  re-run result: ${JSON.stringify(accrual2)}`);
    check("line count unchanged", beforeLines === afterLines);
    check("invoicesCreated = 0 on re-run", accrual2.invoicesCreated === 0);
    check("linesAdded = 0 on re-run", accrual2.linesAdded === 0);

    // ─── D. Price-edit immunity at accrual ─────────────────────────────
    divider("D. Outsourced line reads priceAtExchange, NOT live purchasePrice");
    // Change purchasePrice on the £600k file to £40k (would have dropped fee
    // from £350 to £250 if accrual read live). Then re-accrue.
    await p.propertyTransaction.update({
      where: { id: txB3.id },
      data: { purchasePrice: 4_000_000 }, // £40k now — but priceAtExchange stays at £600k
    });
    await accrueInvoicesForCurrentMonth();
    const lineB3After = await p.invoiceLine.findFirst({ where: { transactionId: txB3.id } });
    console.log(`  line for txB3 after purchasePrice edit: kind=${lineB3After?.kind} total=${lineB3After?.totalPence}`);
    check("line still 35000p (read from priceAtExchange £600k, not live £40k)",
      lineB3After?.totalPence === 35000);

    // ─── E. Branch (a) reversal after accrual: re-accrue removes orphan ─
    divider("E. Reversal under branch (a) → re-accrual removes the line");
    // Simulate branch (a): clear billing fields on txB1 (in-house file)
    await p.propertyTransaction.update({
      where: { id: txB1.id },
      data: { billedAtExchange: null, priceAtExchange: null, exchangedAt: null },
    });
    const accrual3 = await accrueInvoicesForCurrentMonth();
    console.log(`  re-accrue after reversal: ${JSON.stringify(accrual3)}`);
    const lineB1After = await p.invoiceLine.findFirst({ where: { transactionId: txB1.id, kind: { in: ["in_house_fee", "outsourced_fee"] } } });
    const totalAfterReversal = await p.invoiceLine.aggregate({
      where: { invoice: { agencyId: agencyB.id }, kind: { in: ["in_house_fee", "outsourced_fee"] } },
      _sum: { totalPence: true },
    });
    check("line for reversed file removed", lineB1After === null);
    check("linesRemoved = 1", accrual3.linesRemoved === 1);
    check("invoice fee-line total now 30000 + 35000 = 65000",
      totalAfterReversal._sum.totalPence === 65000, `got ${totalAfterReversal._sum.totalPence}`);

    // ─── F. Live running total reads PropertyTransaction directly ──────
    divider("F. Live total: matches reality independently of cron state");
    // Setup a fresh agency, billed exchanges, but DO NOT run the cron.
    const agencyF = await p.agency.create({ data: { name: `${TEST_PREFIX}live-F`, firstSubmissionAt: new Date("2025-01-01") } });
    await p.propertyTransaction.create({ data: {
      propertyAddress: "F1 No Cron Lane", agencyId: agencyF.id, serviceType: "outsourced",
      purchasePrice: 40_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 40_000_000,
    }});
    await p.propertyTransaction.create({ data: {
      propertyAddress: "F2 No Cron Avenue", agencyId: agencyF.id, serviceType: "self_managed",
      purchasePrice: 30_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 30_000_000,
    }});
    const invoicesFBefore = await p.invoice.count({ where: { agencyId: agencyF.id } });
    const liveBeforeCron = await getCurrentMonthRunningTotal(agencyF.id);
    console.log(`  Invoice rows for agency F (cron NOT run): ${invoicesFBefore}`);
    console.log(`  live total reports: £${liveBeforeCron.totalPence / 100} (${liveBeforeCron.inHouseCount} in-house, ${liveBeforeCron.outsourcedCount} outsourced)`);
    check("no Invoice rows yet (cron hasn't run)", invoicesFBefore === 0);
    check("live total = 30000 + 5900 = 35900p", liveBeforeCron.totalPence === 35900);
    check("counts: 1 in-house, 1 outsourced", liveBeforeCron.inHouseCount === 1 && liveBeforeCron.outsourcedCount === 1);
    // Now run cron and confirm the page total doesn't change
    await accrueInvoicesForCurrentMonth();
    const liveAfterCron = await getCurrentMonthRunningTotal(agencyF.id);
    check("live total identical after cron (proves no dependency)",
      liveBeforeCron.totalPence === liveAfterCron.totalPence);

    // ─── G. CreditNote application during accrual ──────────────────────
    divider("G. Unapplied CreditNote becomes a credit_applied line, gets marked applied");
    const agencyG = await p.agency.create({ data: { name: `${TEST_PREFIX}credit-G`, firstSubmissionAt: new Date("2025-01-01") } });
    const txG = await p.propertyTransaction.create({ data: {
      propertyAddress: "G1 Credit File", agencyId: agencyG.id, serviceType: "outsourced",
      purchasePrice: 40_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 40_000_000,
    }});
    // Simulate a CreditNote from a prior-month reversal (branch b)
    const credit = await p.creditNote.create({ data: {
      agencyId: agencyG.id, transactionId: null,
      amountPence: 30000, reason: "Test pre-existing credit",
    }});
    await accrueInvoicesForCurrentMonth();
    const invoiceG = await p.invoice.findFirst({ where: { agencyId: agencyG.id } });
    const linesG = await p.invoiceLine.findMany({ where: { invoiceId: invoiceG!.id } });
    const creditAfter = await p.creditNote.findUnique({ where: { id: credit.id } });
    console.log(`  invoice lines: ${linesG.map(l => `${l.kind}=${l.totalPence}`).join(", ")}`);
    console.log(`  credit.appliedAt: ${creditAfter?.appliedAt?.toISOString()}, appliedToInvoiceId set: ${creditAfter?.appliedToInvoiceId === invoiceG?.id}`);
    const creditLine = linesG.find(l => l.kind === "credit_applied");
    const feeLine = linesG.find(l => l.kind === "outsourced_fee");
    check("credit_applied line present with negative amount", creditLine?.totalPence === -30000);
    check("outsourced_fee line present alongside", feeLine?.totalPence === 30000);
    check("net total for agency G = 0", (creditLine!.totalPence + feeLine!.totalPence) === 0);
    check("CreditNote.appliedAt now set", creditAfter?.appliedAt !== null);
    check("CreditNote.appliedToInvoiceId = the building invoice", creditAfter?.appliedToInvoiceId === invoiceG?.id);
    // Re-run: should NOT re-apply the same credit
    await accrueInvoicesForCurrentMonth();
    const linesG2 = await p.invoiceLine.count({ where: { invoiceId: invoiceG!.id } });
    check("credit not re-applied on subsequent cron runs", linesG2 === linesG.length);

    // ─── H. Partial unique index: second unapplied credit fails ────────
    divider("H. Partial unique index: 2nd unapplied CreditNote per tx fails");
    const agencyH = await p.agency.create({ data: { name: `${TEST_PREFIX}unique-H`, firstSubmissionAt: new Date("2025-01-01") } });
    const txH = await p.propertyTransaction.create({ data: {
      propertyAddress: "H1 Unique-test File", agencyId: agencyH.id,
    }});
    await p.creditNote.create({ data: {
      agencyId: agencyH.id, transactionId: txH.id, amountPence: 30000, reason: "first credit",
    }});
    let secondInsertThrew = false;
    try {
      await p.creditNote.create({ data: {
        agencyId: agencyH.id, transactionId: txH.id, amountPence: 30000, reason: "second credit (should fail)",
      }});
    } catch (e: any) {
      secondInsertThrew = true;
      console.log(`  second insert blocked: ${e.code ?? "unknown"} ${e.meta?.target ?? ""}`);
    }
    check("second unapplied CreditNote for same tx FAILS at DB layer", secondInsertThrew);
    // Now apply the first, then a second unapplied insert SHOULD succeed
    await p.creditNote.updateMany({
      where: { transactionId: txH.id, appliedAt: null },
      data: { appliedAt: new Date() },
    });
    let postApplyInsertSucceeded = false;
    try {
      await p.creditNote.create({ data: {
        agencyId: agencyH.id, transactionId: txH.id, amountPence: 30000, reason: "post-apply credit (should succeed)",
      }});
      postApplyInsertSucceeded = true;
    } catch {
      postApplyInsertSucceeded = false;
    }
    check("after applying the first, a new unapplied credit is allowed",
      postApplyInsertSucceeded);
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
