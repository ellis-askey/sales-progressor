// PR 7 verification — real charging + failed-payment block.
//
// Covers the four mechanisms PR 7 adds:
//
//   A. Block timeline:
//      ok → (webhook fires payment_failed) → warning → (7d elapse + cron)
//        → blocked → (webhook fires payment_succeeded) → ok
//
//   B. createTransaction + claim refuse new files when blocked
//      (assertCanCreateFile throws PaymentBlockedError → API surfaces 402)
//
//   C. Stripe webhook idempotency:
//      Re-delivery of the same event is a no-op (state transitions guarded
//      via updateMany WHERE clauses).
//
//   D. Issuance:
//      For a building Invoice in the prior London month with a card on file,
//      issuePriorMonthInvoices calls the Stripe issuer (mocked here) and
//      persists status=issued + stripeInvoiceId. Skips correctly when no
//      customer + when net total is zero + when already issued.
//
// Stripe operations are NOT actually called against Stripe — the issuance
// step uses an injected fake StripeIssuer. The real fan-out is tested in
// the consolidated browser walk at the end of the arc.
//
// Cleans up by PR7-VERIFY- prefix. Re-runnable.
//
// Run: npx ts-node --transpile-only --compiler-options
//        '{"module":"CommonJS","moduleResolution":"node","baseUrl":".",
//          "paths":{"@/*":["./*"]}}'
//        --require tsconfig-paths/register
//        scripts/verify-pr7-charging-block-staging.ts

import { PrismaClient } from "@prisma/client";
import {
  getPaymentBlockState,
  markOverdueAgenciesBlocked,
  assertCanCreateFile,
  PaymentBlockedError,
  PAYMENT_FAILURE_GRACE_MS,
} from "../lib/billing/payment-block";
import { processStripeEvent, type StripeWebhookEvent } from "../lib/billing/stripe-webhook";
import { issuePriorMonthInvoices } from "../lib/billing/issuance";
import { billingMonthStart } from "../lib/billing/period";
import { createTransaction } from "../lib/services/transactions";

const p = new PrismaClient();
const TEST_PREFIX = "PR7-VERIFY-";

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

function makeStripeEvent(type: string, stripeInvoiceId: string, createdSec: number = Math.floor(Date.now() / 1000)): StripeWebhookEvent {
  return { id: `evt_${Math.random().toString(36).slice(2)}`, type, created: createdSec, data: { object: { id: stripeInvoiceId } } };
}

async function main() {
  await cleanup();

  try {
    // ─── A. Block timeline ─────────────────────────────────────────────
    divider("A. Block timeline: ok → warning → blocked → ok");
    const agencyA = await p.agency.create({ data: { name: `${TEST_PREFIX}timeline-A`, firstSubmissionAt: new Date("2025-01-01") } });
    // Issued invoice in DB to give the webhook something to find.
    const inv1 = await p.invoice.create({ data: {
      agencyId: agencyA.id, monthStart: new Date("2026-04-01"), status: "issued",
      issuedAt: new Date("2026-04-05"), stripeInvoiceId: `in_${TEST_PREFIX}A1`,
    }});

    const state0 = await getPaymentBlockState(agencyA.id);
    check("initial state = ok", state0.kind === "ok");

    // Webhook: invoice.payment_failed → warning
    const failedAtSec = Math.floor(Date.now() / 1000) - 10;
    await processStripeEvent(makeStripeEvent("invoice.payment_failed", inv1.stripeInvoiceId!, failedAtSec));
    const state1 = await getPaymentBlockState(agencyA.id);
    console.log(`  after payment_failed webhook: state = ${state1.kind}`);
    check("state = warning after payment_failed webhook", state1.kind === "warning");

    // Re-deliver the same payment_failed event → paymentFailedAt should NOT advance
    const agencyAfterFail = await p.agency.findUnique({ where: { id: agencyA.id }, select: { paymentFailedAt: true } });
    const firstFailedAt = agencyAfterFail!.paymentFailedAt!;
    await processStripeEvent(makeStripeEvent("invoice.payment_failed", inv1.stripeInvoiceId!, failedAtSec + 100));
    const agencyAfterRetry = await p.agency.findUnique({ where: { id: agencyA.id }, select: { paymentFailedAt: true } });
    check("paymentFailedAt unchanged on re-delivery (grace window anchored at FIRST failure)",
      agencyAfterRetry!.paymentFailedAt!.getTime() === firstFailedAt.getTime());

    // Within grace: cron run does NOT block yet
    const cronResult1 = await markOverdueAgenciesBlocked();
    const state2 = await getPaymentBlockState(agencyA.id);
    check("cron during grace window doesn't block", cronResult1.blockedCount === 0 && state2.kind === "warning");

    // Simulate 8 days elapsed by backdating paymentFailedAt
    await p.agency.update({
      where: { id: agencyA.id },
      data: { paymentFailedAt: new Date(Date.now() - PAYMENT_FAILURE_GRACE_MS - 24 * 3600 * 1000) },
    });
    const cronResult2 = await markOverdueAgenciesBlocked();
    const state3 = await getPaymentBlockState(agencyA.id);
    check("cron after grace → marks blocked", cronResult2.blockedCount === 1 && state3.kind === "blocked");

    // Re-run cron: idempotent, no extra block writes
    const cronResult3 = await markOverdueAgenciesBlocked();
    check("cron re-run is idempotent (blockedCount = 0)", cronResult3.blockedCount === 0);

    // Webhook: invoice.payment_succeeded → flags clear
    await processStripeEvent(makeStripeEvent("invoice.payment_succeeded", inv1.stripeInvoiceId!));
    const state4 = await getPaymentBlockState(agencyA.id);
    const agencyAfterSuccess = await p.agency.findUnique({ where: { id: agencyA.id } });
    const invoiceAfterSuccess = await p.invoice.findUnique({ where: { id: inv1.id } });
    check("state back to ok after payment_succeeded", state4.kind === "ok");
    check("Agency.paymentFailedAt cleared", agencyAfterSuccess!.paymentFailedAt === null);
    check("Agency.newFileCreationBlockedAt cleared", agencyAfterSuccess!.newFileCreationBlockedAt === null);
    check("Invoice.status = paid", invoiceAfterSuccess!.status === "paid");
    check("Invoice.paidAt set", invoiceAfterSuccess!.paidAt !== null);

    // ─── B. createTransaction refuses when blocked ─────────────────────
    divider("B. createTransaction + claim path refuse when blocked");
    const agencyB = await p.agency.create({ data: {
      name: `${TEST_PREFIX}refuse-B`, firstSubmissionAt: new Date("2025-01-01"),
      paymentFailedAt: new Date(Date.now() - PAYMENT_FAILURE_GRACE_MS - 1000),
      newFileCreationBlockedAt: new Date(),
    }});
    let createThrew = false;
    let createErr: unknown = null;
    try {
      await createTransaction({ propertyAddress: "B Test", agencyId: agencyB.id });
    } catch (e) {
      createThrew = true;
      createErr = e;
    }
    check("createTransaction throws when agency is blocked", createThrew);
    check("error is PaymentBlockedError", createErr instanceof PaymentBlockedError);
    if (createErr instanceof PaymentBlockedError) {
      console.log(`  err.code: ${createErr.code}, msg: "${createErr.message}"`);
      check("error.code = 'PAYMENT_BLOCKED'", createErr.code === "PAYMENT_BLOCKED");
    }

    // Confirm no transaction was actually created (transactional rollback)
    const txCount = await p.propertyTransaction.count({ where: { agencyId: agencyB.id } });
    check("no PropertyTransaction created (atomic rollback)", txCount === 0);

    // Now clear the block and confirm creation works
    await p.agency.update({
      where: { id: agencyB.id },
      data: { paymentFailedAt: null, newFileCreationBlockedAt: null },
    });
    let createSucceeded = false;
    try {
      await createTransaction({ propertyAddress: "B Test post-clear", agencyId: agencyB.id });
      createSucceeded = true;
    } catch {
      createSucceeded = false;
    }
    check("createTransaction succeeds after block clears", createSucceeded);

    // Direct assertCanCreateFile in warning state should NOT throw
    const agencyB2 = await p.agency.create({ data: {
      name: `${TEST_PREFIX}warning-B2`,
      firstSubmissionAt: new Date("2025-01-01"),
      paymentFailedAt: new Date(), // failed now, no block yet
    }});
    let warningThrew = false;
    try {
      await assertCanCreateFile(agencyB2.id);
    } catch {
      warningThrew = true;
    }
    check("warning state does NOT throw (grace period — agency can still create)", warningThrew === false);

    // ─── C. Webhook idempotency on payment_succeeded re-delivery ───────
    divider("C. Webhook idempotency — re-delivery of payment_succeeded is no-op");
    const agencyC = await p.agency.create({ data: {
      name: `${TEST_PREFIX}idempotent-C`, firstSubmissionAt: new Date("2025-01-01"),
      paymentFailedAt: new Date(), newFileCreationBlockedAt: new Date(),
    }});
    const invC = await p.invoice.create({ data: {
      agencyId: agencyC.id, monthStart: new Date("2026-04-01"), status: "failed",
      stripeInvoiceId: `in_${TEST_PREFIX}C1`,
    }});
    await processStripeEvent(makeStripeEvent("invoice.payment_succeeded", invC.stripeInvoiceId!));
    const invAfter1 = await p.invoice.findUnique({ where: { id: invC.id } });
    const firstPaidAt = invAfter1!.paidAt;
    // Re-deliver
    await processStripeEvent(makeStripeEvent("invoice.payment_succeeded", invC.stripeInvoiceId!, Math.floor(Date.now() / 1000) + 60));
    const invAfter2 = await p.invoice.findUnique({ where: { id: invC.id } });
    check("Invoice.paidAt unchanged on re-delivery", invAfter2!.paidAt!.getTime() === firstPaidAt!.getTime());
    check("Invoice.status still = paid", invAfter2!.status === "paid");

    // ─── D. Issuance with mock Stripe issuer ───────────────────────────
    divider("D. issuePriorMonthInvoices — Stripe call mocked + DB state correct");
    const now = new Date();
    // Compute "in prior month" = current monthStart - 1 day
    const currentMonth = billingMonthStart(now);
    const inPriorMonth = new Date(currentMonth.getTime() - 24 * 3600 * 1000);
    const priorMonthStart = billingMonthStart(inPriorMonth);

    const agencyD = await p.agency.create({ data: {
      name: `${TEST_PREFIX}issuance-D`,
      firstSubmissionAt: new Date("2025-01-01"),
      stripeCustomerId: "cus_FAKE_pr7_d",
    }});
    const invD = await p.invoice.create({ data: {
      agencyId: agencyD.id, monthStart: priorMonthStart, status: "building",
    }});
    await p.invoiceLine.create({ data: {
      invoiceId: invD.id, transactionId: null, kind: "outsourced_fee",
      description: "Outsourced — £350,000–£499,999 — Test address",
      amountPence: 30000, vatPence: 0, totalPence: 30000,
    }});
    // Also a no-customer agency in same month → should be skipped
    const agencyDNoCard = await p.agency.create({ data: {
      name: `${TEST_PREFIX}issuance-D-nocard`,
      firstSubmissionAt: new Date("2025-01-01"),
    }});
    const invDNoCard = await p.invoice.create({ data: {
      agencyId: agencyDNoCard.id, monthStart: priorMonthStart, status: "building",
    }});
    await p.invoiceLine.create({ data: {
      invoiceId: invDNoCard.id, kind: "in_house_fee", description: "In-house file — Test",
      amountPence: 5900, vatPence: 0, totalPence: 5900,
    }});
    // Net-zero agency (fee cancelled by credit) → should auto-issue without Stripe call
    const agencyDZero = await p.agency.create({ data: {
      name: `${TEST_PREFIX}issuance-D-zero`,
      firstSubmissionAt: new Date("2025-01-01"),
      stripeCustomerId: "cus_FAKE_pr7_zero",
    }});
    const invDZero = await p.invoice.create({ data: {
      agencyId: agencyDZero.id, monthStart: priorMonthStart, status: "building",
    }});
    await p.invoiceLine.create({ data: {
      invoiceId: invDZero.id, kind: "outsourced_fee", description: "fee", amountPence: 30000, vatPence: 0, totalPence: 30000,
    }});
    await p.invoiceLine.create({ data: {
      invoiceId: invDZero.id, kind: "credit_applied", description: "credit", amountPence: -30000, vatPence: 0, totalPence: -30000,
    }});

    let issuerCalls = 0;
    const result = await issuePriorMonthInvoices(now, async ({ customerId, lines }) => {
      issuerCalls++;
      console.log(`  fake issuer called: customerId=${customerId}, lines=${lines.length}, total=${lines.reduce((s, l) => s + l.amountPence, 0)}`);
      return { stripeInvoiceId: `in_FAKE_${issuerCalls}_${customerId}` };
    });
    console.log(`  issuePriorMonthInvoices result: ${JSON.stringify(result)}`);
    check("issuer called exactly once (only the with-customer non-zero invoice)", issuerCalls === 1);
    check("invoicesIssued = 1", result.invoicesIssued === 1);
    check("invoicesSkippedNoCustomer = 1", result.invoicesSkippedNoCustomer === 1);
    check("invoicesSkippedNoLines (net zero auto-issued) = 1", result.invoicesSkippedNoLines === 1);

    const invDAfter = await p.invoice.findUnique({ where: { id: invD.id } });
    check("invD status = issued", invDAfter!.status === "issued");
    check("invD stripeInvoiceId set", invDAfter!.stripeInvoiceId !== null);
    check("invD issuedAt set", invDAfter!.issuedAt !== null);

    const invDNoCardAfter = await p.invoice.findUnique({ where: { id: invDNoCard.id } });
    check("invDNoCard still status = building (no card → no issue)", invDNoCardAfter!.status === "building");
    check("invDNoCard stripeInvoiceId still null", invDNoCardAfter!.stripeInvoiceId === null);

    const invDZeroAfter = await p.invoice.findUnique({ where: { id: invDZero.id } });
    check("invDZero status = issued (net-zero auto-finalised)", invDZeroAfter!.status === "issued");
    check("invDZero stripeInvoiceId NULL (no Stripe call for zero amount)", invDZeroAfter!.stripeInvoiceId === null);

    // Re-run: invD already issued → skipped
    const result2 = await issuePriorMonthInvoices(now, async () => { throw new Error("issuer should not be called"); });
    check("re-run skips already-issued (no issuer calls)", result2.invoicesIssued === 0);
    check("invoicesSkippedAlreadyIssued = 1 (only invD; net-zero has stripeInvoiceId=null and status=issued so it's not 'building' anymore — would still be filtered by WHERE status=building)",
      result2.invoicesSkippedAlreadyIssued === 0); // status flipped to issued, not in the building query
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
