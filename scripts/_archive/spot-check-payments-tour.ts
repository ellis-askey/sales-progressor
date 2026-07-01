// scripts/spot-check-payments-tour.ts
//
// Read-only spot check that the payments tour seed produced the expected
// state per agency. Run after seed-staging-payments-tour.ts.

import { PrismaClient } from "@prisma/client";
import { getCurrentMonthRunningTotal } from "../lib/billing/running-total";
import { getPaymentBlockState } from "../lib/billing/payment-block";
import { getPaymentMethodState } from "../lib/billing/payment-method-state";

// Set placeholder Stripe vars so getPaymentMethodState passes the
// stripe_not_configured check during spot-check (verifier-style).
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "sk_test_VERIFY_FAKE_pr6";
process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY ?? "pk_test_VERIFY_FAKE_pr6";

const p = new PrismaClient();

async function dump(name: string, agencyName: string) {
  console.log("");
  console.log(`── ${name} (${agencyName}) ${"─".repeat(Math.max(0, 60 - name.length - agencyName.length))}`);
  const a = await p.agency.findFirst({ where: { name: agencyName }, select: {
    id: true, name: true, firstSubmissionAt: true, vatRegisteredAt: true, vatRateBps: true,
    paymentFailedAt: true, newFileCreationBlockedAt: true, stripeCustomerId: true,
  }});
  if (!a) { console.log("  ✗ agency not found"); return; }
  console.log(`  agency: vat=${a.vatRegisteredAt !== null} block=${a.newFileCreationBlockedAt !== null} warning=${a.paymentFailedAt !== null && a.newFileCreationBlockedAt === null}`);

  const directors = await p.user.findMany({ where: { agencyId: a.id, role: "director" }, select: { email: true } });
  const negos = await p.user.findMany({ where: { agencyId: a.id, role: "negotiator" }, select: { email: true } });
  console.log(`  directors:   ${directors.map((d) => d.email).join(", ") || "(none)"}`);
  console.log(`  negotiators: ${negos.map((n) => n.email).join(", ") || "(none)"}`);

  const rt = await getCurrentMonthRunningTotal(a.id);
  console.log(`  billing page total this month: £${rt.totalPence / 100}` +
    (rt.vatActive ? ` (ex-VAT £${rt.subtotalPence / 100} + VAT £${rt.vatPence / 100})` : ""));
  console.log(`  lines: ${rt.lines.length} (${rt.inHouseCount} in-house, ${rt.outsourcedCount} outsourced)`);
  if (rt.trialExchangeCount > 0) {
    console.log(`  trial exchanges: ${rt.trialExchangeCount} (£${rt.trialValuePence / 100} given away)`);
  }
  if (rt.pendingCreditPence > 0) {
    console.log(`  pending credit: £${rt.pendingCreditPence / 100}`);
  }

  const block = await getPaymentBlockState(a.id);
  console.log(`  block state: ${block.kind}`);

  if (directors[0]) {
    const pm = await getPaymentMethodState(a.id);
    console.log(`  /agent/billing/payment-method state for first director: ${pm.kind}` +
      (pm.kind === "disclosure" || pm.kind === "card_form" ? ` (terms=${pm.terms.versionTag})` : ""));
  }
}

async function main() {
  try {
    await dump("Hartwell — main tour", "Hartwell & Partners");
    await dump("Beacon — BLOCKED demo", "Beacon Estates");
    await dump("Marlow — WARNING demo", "Marlow & Co");
  } finally {
    await p.$disconnect();
  }
}

void main();
