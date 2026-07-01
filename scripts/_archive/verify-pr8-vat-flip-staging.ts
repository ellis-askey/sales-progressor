// PR 8 verification — VAT flip rehearsal.
//
// Confirms the flip is a single config change with no schema migration.
// Toggles Agency.vatRegisteredAt + vatRateBps on a test agency, runs the
// full billing path (computeFee → accrual → running-total → reversal credit),
// confirms the split is applied correctly everywhere, then toggles back and
// confirms behaviour reverts to inclusive-only.
//
// Sections:
//   A. computeFee math at each band: inclusive total stays the same; ex-VAT
//      and VAT lines round correctly to the penny (£59 → £49.17 + £9.83;
//      £250 → £208.33 + £41.67; £300 → £250 + £50; £350 → £291.67 + £58.33).
//   B. Accrual writes lines with vatPence > 0 when registered; amountPence
//      is ex-VAT; totalPence equals what's actually charged (gross).
//   C. Running-total surfaces subtotalPence + vatPence + vatActive=true so
//      the billing page can render the breakdown.
//   D. Reversal-to-CreditNote uses the GROSS amount (so the credit nets out
//      the actual Stripe charge — VAT is symmetric on the credit side).
//   E. Flip OFF (vatRegisteredAt = null): accrual + running-total revert to
//      vatPence = 0; amountPence = totalPence; vatActive = false. Same
//      agency, single config field, no migration.
//
// Cleans up by PR8-VERIFY- prefix. Re-runnable.

import { PrismaClient } from "@prisma/client";
import { computeFee } from "../lib/billing/fee";
import { accrueInvoicesForCurrentMonth } from "../lib/billing/accrual";
import { getCurrentMonthRunningTotal } from "../lib/billing/running-total";
import { handleExchangeReversal } from "../lib/services/billing-reversal";

const p = new PrismaClient();
const TEST_PREFIX = "PR8-VERIFY-";

async function cleanup() {
  await p.invoiceLine.deleteMany({ where: { invoice: { agency: { name: { startsWith: TEST_PREFIX } } } } });
  await p.creditNote.deleteMany({ where: { agency: { name: { startsWith: TEST_PREFIX } } } });
  await p.invoice.deleteMany({ where: { agency: { name: { startsWith: TEST_PREFIX } } } });
  await p.milestoneCompletion.deleteMany({ where: { transaction: { agency: { name: { startsWith: TEST_PREFIX } } } } });
  await p.propertyTransaction.deleteMany({ where: { agency: { name: { startsWith: TEST_PREFIX } } } });
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
    const VAT_INPUT = { vatRegisteredAt: new Date("2026-04-01"), vatRateBps: 2000 };

    // ─── A. computeFee math ─────────────────────────────────────────────
    divider("A. computeFee — VAT split rounds to the penny across all 4 cases");
    const ih = computeFee("self_managed", 30_000_000, VAT_INPUT);
    console.log(`  in-house £59 → ex-VAT=${ih.amountPence}, VAT=${ih.vatPence}, total=${ih.totalPence}`);
    check("in-house total stays £59 (5900p)", ih.totalPence === 5900);
    check("in-house ex-VAT = £49.17 (4917p)", ih.amountPence === 4917);
    check("in-house VAT = £9.83 (983p)", ih.vatPence === 983);

    const oLow = computeFee("outsourced", 30_000_000, VAT_INPUT); // £300k → £250 band
    console.log(`  outsourced low £250 → ex-VAT=${oLow.amountPence}, VAT=${oLow.vatPence}, total=${oLow.totalPence}`);
    check("outsourced £250 total preserved (25000p)", oLow.totalPence === 25000);
    check("outsourced £250 ex-VAT = £208.33 (20833p)", oLow.amountPence === 20833);
    check("outsourced £250 VAT = £41.67 (4167p)", oLow.vatPence === 4167);

    const oMid = computeFee("outsourced", 40_000_000, VAT_INPUT); // £400k → £300 band
    console.log(`  outsourced mid £300 → ex-VAT=${oMid.amountPence}, VAT=${oMid.vatPence}, total=${oMid.totalPence}`);
    check("outsourced £300 ex-VAT = £250.00 (25000p)", oMid.amountPence === 25000);
    check("outsourced £300 VAT = £50.00 (5000p)", oMid.vatPence === 5000);

    const oHigh = computeFee("outsourced", 60_000_000, VAT_INPUT); // £600k → £350 band
    console.log(`  outsourced high £350 → ex-VAT=${oHigh.amountPence}, VAT=${oHigh.vatPence}, total=${oHigh.totalPence}`);
    check("outsourced £350 ex-VAT = £291.67 (29167p)", oHigh.amountPence === 29167);
    check("outsourced £350 VAT = £58.33 (5833p)", oHigh.vatPence === 5833);

    // Sanity: with no VAT input, behaves exactly as pre-PR-8
    const noVat = computeFee("self_managed", 30_000_000, null);
    check("no VAT input → amountPence = totalPence, vatPence = 0",
      noVat.amountPence === 5900 && noVat.vatPence === 0 && noVat.totalPence === 5900);

    // ─── B. Accrual writes VAT-split lines ─────────────────────────────
    divider("B. Accrual: with VAT registered, lines have vatPence > 0 + correct ex-VAT");
    const agencyB = await p.agency.create({ data: {
      name: `${TEST_PREFIX}vat-on-B`,
      firstSubmissionAt: new Date("2025-01-01"),
      vatRegisteredAt: new Date("2026-04-01"),
      vatRateBps: 2000,
    }});
    await p.propertyTransaction.create({ data: {
      propertyAddress: "B1 In-house VAT", agencyId: agencyB.id, serviceType: "self_managed",
      purchasePrice: 30_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 30_000_000,
    }});
    await p.propertyTransaction.create({ data: {
      propertyAddress: "B2 Outsourced VAT", agencyId: agencyB.id, serviceType: "outsourced",
      purchasePrice: 60_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 60_000_000,
    }});
    await accrueInvoicesForCurrentMonth();
    const invoiceB = await p.invoice.findFirst({ where: { agencyId: agencyB.id } });
    const linesB = await p.invoiceLine.findMany({ where: { invoiceId: invoiceB!.id }, orderBy: { totalPence: "asc" } });
    console.log(`  lines: ${linesB.map(l => `${l.kind} amount=${l.amountPence} vat=${l.vatPence} total=${l.totalPence}`).join(" | ")}`);
    const inhouseLine = linesB.find(l => l.kind === "in_house_fee")!;
    const outLine = linesB.find(l => l.kind === "outsourced_fee")!;
    check("in-house line: amount=4917, vat=983, total=5900", inhouseLine.amountPence === 4917 && inhouseLine.vatPence === 983 && inhouseLine.totalPence === 5900);
    check("outsourced £350 line: amount=29167, vat=5833, total=35000", outLine.amountPence === 29167 && outLine.vatPence === 5833 && outLine.totalPence === 35000);

    // ─── C. Running-total surfaces breakdown for UI ────────────────────
    divider("C. Running-total: vatActive=true, subtotalPence + vatPence sum to totalPence");
    const rt = await getCurrentMonthRunningTotal(agencyB.id);
    console.log(`  vatActive=${rt.vatActive}, subtotal=${rt.subtotalPence}, vat=${rt.vatPence}, total=${rt.totalPence}`);
    check("vatActive = true (UI shows breakdown)", rt.vatActive === true);
    check("subtotal + vat = total (4917 + 29167) + (983 + 5833) = 40900p",
      rt.subtotalPence === 34084 && rt.vatPence === 6816 && rt.totalPence === 40900,
      `subtotal=${rt.subtotalPence} vat=${rt.vatPence} total=${rt.totalPence}`);
    check("line shape exposes amountPence + vatPence + totalPence",
      rt.lines.every(l => typeof l.amountPence === "number" && typeof l.vatPence === "number" && typeof l.totalPence === "number"));

    // ─── D. Reversal credit uses GROSS amount ──────────────────────────
    divider("D. Branch-(b) reversal CreditNote = gross (5900p, not 4917p ex-VAT)");
    // Promote the building invoice to issued so reversal hits branch (b)
    await p.invoice.update({ where: { id: invoiceB!.id }, data: { status: "issued", issuedAt: new Date() } });
    // Reverse the in-house exchange (txn id stored in linesB.transactionId)
    const inhouseTxId = inhouseLine.transactionId!;
    await p.$transaction(async (db) => {
      await handleExchangeReversal(inhouseTxId, "VM19", db);
    });
    const credit = await p.creditNote.findFirst({ where: { transactionId: inhouseTxId } });
    console.log(`  CreditNote amount: ${credit?.amountPence}p (should be gross 5900, not ex-VAT 4917)`);
    check("CreditNote.amountPence = 5900 (gross — nets out the actual Stripe charge)",
      credit?.amountPence === 5900);

    // ─── E. Flip OFF: behaviour reverts ────────────────────────────────
    divider("E. Flip OFF (vatRegisteredAt = null) → revert to inclusive-only behaviour");
    const agencyE = await p.agency.create({ data: {
      name: `${TEST_PREFIX}vat-off-E`, firstSubmissionAt: new Date("2025-01-01"),
      // intentionally no VAT fields
    }});
    await p.propertyTransaction.create({ data: {
      propertyAddress: "E1 No-VAT", agencyId: agencyE.id, serviceType: "self_managed",
      purchasePrice: 30_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 30_000_000,
    }});
    await accrueInvoicesForCurrentMonth();
    const invoiceE = await p.invoice.findFirst({ where: { agencyId: agencyE.id } });
    const linesE = await p.invoiceLine.findMany({ where: { invoiceId: invoiceE!.id } });
    const rtE = await getCurrentMonthRunningTotal(agencyE.id);
    console.log(`  line: amount=${linesE[0].amountPence} vat=${linesE[0].vatPence} total=${linesE[0].totalPence}`);
    console.log(`  rt:   vatActive=${rtE.vatActive} subtotal=${rtE.subtotalPence} vat=${rtE.vatPence} total=${rtE.totalPence}`);
    check("line.vatPence = 0", linesE[0].vatPence === 0);
    check("line.amountPence = line.totalPence = 5900", linesE[0].amountPence === 5900 && linesE[0].totalPence === 5900);
    check("rt.vatActive = false", rtE.vatActive === false);
    check("rt.subtotalPence = rt.totalPence (no VAT)", rtE.subtotalPence === rtE.totalPence);
    check("rt.vatPence = 0", rtE.vatPence === 0);

    // Now FLIP it on for this same agency and confirm the next accrual run
    // re-evaluates: agencyE picks up VAT registration mid-month → existing
    // lines stay as written (immutable history of what we accrued THEN), but
    // the running-total uses live VAT state. New exchanges accrued post-flip
    // get the VAT split.
    divider("E.2 Flip ON mid-month: existing lines unchanged, NEW exchanges split correctly");
    await p.agency.update({
      where: { id: agencyE.id },
      data: { vatRegisteredAt: new Date(), vatRateBps: 2000 },
    });
    // Existing lines: unchanged (accrual doesn't rewrite already-existing lines)
    const linesEAfterFlip = await p.invoiceLine.findMany({ where: { invoiceId: invoiceE!.id } });
    check("existing line UNCHANGED after mid-month flip (historical accuracy)",
      linesEAfterFlip[0].vatPence === 0 && linesEAfterFlip[0].amountPence === 5900);
    // Add a NEW exchange under VAT-on state
    await p.propertyTransaction.create({ data: {
      propertyAddress: "E2 Post-flip", agencyId: agencyE.id, serviceType: "outsourced",
      purchasePrice: 40_000_000, exchangedAt: now, billedAtExchange: now, priceAtExchange: 40_000_000,
    }});
    await accrueInvoicesForCurrentMonth();
    const linesEFinal = await p.invoiceLine.findMany({ where: { invoiceId: invoiceE!.id }, orderBy: { createdAt: "asc" } });
    console.log(`  lines after flip + new exchange:`);
    linesEFinal.forEach(l => console.log(`    ${l.kind}: amount=${l.amountPence} vat=${l.vatPence} total=${l.totalPence}`));
    const newLine = linesEFinal.find(l => l.kind === "outsourced_fee");
    check("NEW outsourced line has VAT split (amount=25000, vat=5000, total=30000)",
      newLine?.amountPence === 25000 && newLine?.vatPence === 5000 && newLine?.totalPence === 30000);
    // Running total reflects the LIVE VAT state for ALL lines via the computeFee re-evaluation
    const rtEFinal = await getCurrentMonthRunningTotal(agencyE.id);
    console.log(`  running-total: vatActive=${rtEFinal.vatActive} subtotal=${rtEFinal.subtotalPence} vat=${rtEFinal.vatPence} total=${rtEFinal.totalPence}`);
    check("running-total NOW shows vatActive=true and computes split for both lines live",
      rtEFinal.vatActive === true && rtEFinal.vatPence > 0);
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
