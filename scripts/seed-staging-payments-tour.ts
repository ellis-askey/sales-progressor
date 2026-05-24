// scripts/seed-staging-payments-tour.ts
//
// Seeds three demo agencies on STAGING for the consolidated payments tour.
// Idempotent — re-runs delete the tour data by prefix and re-create. Hard-
// aborts if DATABASE_URL points at prod.
//
// Agencies after seed:
//
//   1. "Hartwell & Partners" — main tour, VAT-registered, rich billing data
//        Director:   emily@hartwellpartners.co.uk     (promoted to director)
//        Negotiator: sam@hartwellpartners.co.uk       (for the 404 check)
//        Files this month (all PAYMENTS-TOUR addresses):
//          - In-house £400k       → £59 billed
//          - In-house £350k       → £59 billed
//          - Outsourced £200k     → £250 billed (low band)
//          - Outsourced £400k     → £300 billed (mid band)
//          - Outsourced £600k     → £350 billed (high band)
//          - Trial £450k          → exchanged free, £300 retail value given away
//        Plus a prior-month reversed exchange producing an unapplied
//        CreditNote that surfaces as "pending credit" on the billing page.
//        firstSubmissionAt backdated 90d so trial window is closed.
//        PricingAcknowledgement deleted so /agent/billing/payment-method
//        lands on the DISCLOSURE state (Emily clicks acknowledge → card form).
//
//   2. "Beacon Estates" — permanent BLOCKED-payment state
//        Director: tom@beaconestates.co.uk
//        paymentFailedAt 9d ago + newFileCreationBlockedAt set
//        1 prior-month failed Invoice (stripeInvoiceId set so it looks real)
//        Hub shows red banner. New file creation refused with 402.
//
//   3. "Marlow & Co" — permanent WARNING-payment state (grace window open)
//        Director: james@marlowandco.co.uk
//        paymentFailedAt 3d ago, no block yet
//        Hub shows amber banner. Director can still create files.
//
// All three demo directors use the same staging password: TourDemo2026!
// (Emily keeps her existing password — we don't reset it.)

import { PrismaClient, type ServiceType } from "@prisma/client";
import { hash } from "bcryptjs";

const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";
const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";

const TOUR_PREFIX = "PAYMENTS-TOUR — ";
const DEMO_PASSWORD = "TourDemo2026!";

function projectIdOf(url: string | undefined): string {
  const m = url?.match(/(?:postgres\.|db\.)([a-z0-9]{20})/);
  return m ? m[1] : "UNKNOWN";
}

function divider(label: string): void {
  console.log("");
  console.log(`── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`);
}

const p = new PrismaClient();

async function findOrCreateAgency(name: string): Promise<{ id: string; created: boolean }> {
  const existing = await p.agency.findFirst({ where: { name } });
  if (existing) return { id: existing.id, created: false };
  const created = await p.agency.create({ data: { name } });
  return { id: created.id, created: true };
}

async function findOrCreateDirector(input: {
  agencyId: string;
  email: string;
  name: string;
  firmName: string;
  role: "director" | "negotiator";
}): Promise<{ id: string; created: boolean }> {
  const existing = await p.user.findUnique({ where: { email: input.email } });
  if (existing) {
    // Make sure role + agency are what we expect (promote if needed).
    if (existing.role !== input.role || existing.agencyId !== input.agencyId) {
      await p.user.update({
        where: { id: existing.id },
        data: { role: input.role, agencyId: input.agencyId },
      });
    }
    return { id: existing.id, created: false };
  }
  const passwordHash = await hash(DEMO_PASSWORD, 10);
  const created = await p.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: passwordHash,
      role: input.role,
      agencyId: input.agencyId,
      firmName: input.firmName,
    },
  });
  return { id: created.id, created: true };
}

async function wipeTourDataForAgency(agencyId: string) {
  // Delete in FK order. Anything with PAYMENTS-TOUR address prefix, plus any
  // Invoice/CreditNote rows for this agency (since they're cheap to rebuild
  // and the verifier scripts also clean them).
  await p.creditNote.deleteMany({ where: { agencyId } });
  await p.invoiceLine.deleteMany({ where: { invoice: { agencyId } } });
  await p.invoice.deleteMany({ where: { agencyId } });
  await p.milestoneCompletion.deleteMany({
    where: { transaction: { propertyAddress: { startsWith: TOUR_PREFIX }, agencyId } },
  });
  await p.propertyTransaction.deleteMany({
    where: { propertyAddress: { startsWith: TOUR_PREFIX }, agencyId },
  });
}

type SeedExchange = {
  address: string;
  serviceType: ServiceType;
  purchasePrice: number; // pence
  freeOnExchange: boolean;
  /** If true, billing fields set (billedAtExchange + priceAtExchange) for
      paying files. Trial files set exchangedAt only. */
};

async function seedExchanges(agencyId: string, agentUserId: string, billingMonthStart: Date, files: SeedExchange[]) {
  const now = new Date();
  const inBillingMonth = new Date(billingMonthStart.getTime() + 5 * 24 * 3_600_000); // 5 days into the month
  for (const f of files) {
    const exchangedAt = inBillingMonth;
    const isBilling = !f.freeOnExchange;
    await p.propertyTransaction.create({
      data: {
        agencyId,
        propertyAddress: f.address,
        agentUserId,
        progressedBy: "agent",
        serviceType: f.serviceType,
        purchasePrice: f.purchasePrice,
        tenure: "freehold",
        purchaseType: "mortgage",
        // The exchange has already happened in our seed worldview.
        exchangedAt,
        billedAtExchange: isBilling ? exchangedAt : null,
        priceAtExchange: isBilling ? f.purchasePrice : null,
        freeOnExchange: f.freeOnExchange,
        // Honest: in real flow status remains 'active' through completion (PR scope).
      },
    });
  }
}

async function seedHartwell(): Promise<{ emily: string; sam: string }> {
  divider("Seeding Hartwell & Partners — main tour");
  const { id: agencyId } = await findOrCreateAgency("Hartwell & Partners");
  // Backdate first-submission far enough that the trial window is closed.
  await p.agency.update({
    where: { id: agencyId },
    data: {
      firstSubmissionAt: new Date(Date.now() - 90 * 24 * 3_600_000),
      vatRegisteredAt: new Date("2026-04-01"),
      vatRateBps: 2000,
      paymentFailedAt: null,
      newFileCreationBlockedAt: null,
      stripeCustomerId: null,
    },
  });

  // Promote Emily to director; ensure Sam exists as a negotiator.
  const emily = await findOrCreateDirector({
    agencyId, email: "emily@hartwellpartners.co.uk",
    name: "Emily Chen", firmName: "Hartwell & Partners", role: "director",
  });
  const sam = await findOrCreateDirector({
    agencyId, email: "sam@hartwellpartners.co.uk",
    name: "Sam Patel", firmName: "Hartwell & Partners", role: "negotiator",
  });
  console.log(`  emily director: ${emily.created ? "created" : "ensured"} (${emily.id})`);
  console.log(`  sam negotiator: ${sam.created ? "created" : "ensured"} (${sam.id})`);

  // Wipe + reseed tour data.
  await wipeTourDataForAgency(agencyId);

  // Current billing month boundary (UTC for seed purposes; PR 5's London
  // boundary helper drives the actual page query — we just need our seeded
  // exchanges to fall inside this window).
  const now = new Date();
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const lastMonthInside = new Date(thisMonthStart.getTime() - 15 * 24 * 3_600_000); // ~mid prior month
  const lastMonthStart = new Date(Date.UTC(lastMonthInside.getUTCFullYear(), lastMonthInside.getUTCMonth(), 1));

  await seedExchanges(agencyId, emily.id, thisMonthStart, [
    { address: `${TOUR_PREFIX}12 Oak Lane, London`,         serviceType: "self_managed", purchasePrice: 40_000_000, freeOnExchange: false },
    { address: `${TOUR_PREFIX}48 Elm Avenue, London`,       serviceType: "self_managed", purchasePrice: 35_000_000, freeOnExchange: false },
    { address: `${TOUR_PREFIX}7 Maple Court, Manchester`,   serviceType: "outsourced",   purchasePrice: 20_000_000, freeOnExchange: false },
    { address: `${TOUR_PREFIX}102 Beech Road, Bristol`,     serviceType: "outsourced",   purchasePrice: 40_000_000, freeOnExchange: false },
    { address: `${TOUR_PREFIX}231 Cedar Hill, Cambridge`,   serviceType: "outsourced",   purchasePrice: 60_000_000, freeOnExchange: false },
    { address: `${TOUR_PREFIX}5 Birch Mews, Hartwell (trial)`, serviceType: "outsourced", purchasePrice: 45_000_000, freeOnExchange: true },
  ]);

  // The reversal-with-credit case. We create a prior-month exchange that
  // was billed, "issue" the invoice for that month, then write a CreditNote
  // directly (simulating the reversal that would call handleExchangeReversal
  // branch (b) — we don't reverse the tx itself here, just produce the
  // CreditNote artefact so the "pending credit" indicator shows on Emily's
  // current-month billing page).
  const reversedTx = await p.propertyTransaction.create({
    data: {
      agencyId, agentUserId: emily.id, progressedBy: "agent",
      propertyAddress: `${TOUR_PREFIX}88 Spruce Drive, Reading (reversed)`,
      serviceType: "outsourced", purchasePrice: 55_000_000,
      tenure: "freehold", purchaseType: "mortgage",
      // We preserve the original billing stamp — branch (b) of reversal
      // keeps billedAtExchange intact and writes a CreditNote on top.
      exchangedAt: new Date(lastMonthStart.getTime() + 8 * 24 * 3_600_000),
      billedAtExchange: new Date(lastMonthStart.getTime() + 8 * 24 * 3_600_000),
      priceAtExchange: 55_000_000,
      freeOnExchange: false,
    },
  });
  const issuedInvoice = await p.invoice.create({
    data: {
      agencyId, monthStart: lastMonthStart, status: "issued",
      issuedAt: new Date(lastMonthStart.getTime() + 30 * 24 * 3_600_000),
      stripeInvoiceId: `in_TOUR_FAKE_hartwell_lastmonth`,
    },
  });
  await p.invoiceLine.create({
    data: {
      invoiceId: issuedInvoice.id, transactionId: reversedTx.id,
      kind: "outsourced_fee",
      description: `Outsourced — £500,000+ — ${reversedTx.propertyAddress}`,
      // VAT-registered split for the line: £350 → £291.67 + £58.33
      amountPence: 29167, vatPence: 5833, totalPence: 35000,
    },
  });
  await p.creditNote.create({
    data: {
      agencyId, transactionId: reversedTx.id,
      amountPence: 35000,
      reason: `Exchange reversed post-invoice — VM19 undone on ${new Date().toISOString().slice(0, 10)}`,
    },
  });
  console.log(`  reversed prior-month exchange + unapplied CreditNote £350 set up`);

  // Clear any acknowledgement so /agent/billing/payment-method lands on
  // the disclosure state for the walk.
  await p.pricingAcknowledgement.deleteMany({ where: { agencyId } });
  console.log(`  pricing acknowledgement cleared — /agent/billing/payment-method lands on disclosure`);

  return { emily: emily.id, sam: sam.id };
}

async function seedBeaconBlocked() {
  divider("Seeding Beacon Estates — BLOCKED demo");
  const { id: agencyId } = await findOrCreateAgency("Beacon Estates");
  const now = new Date();
  // 9 days since failed payment → past the 7-day grace.
  const failedAt = new Date(now.getTime() - 9 * 24 * 3_600_000);
  await p.agency.update({
    where: { id: agencyId },
    data: {
      firstSubmissionAt: new Date(Date.now() - 90 * 24 * 3_600_000),
      vatRegisteredAt: null, vatRateBps: null,
      paymentFailedAt: failedAt,
      newFileCreationBlockedAt: now,
      stripeCustomerId: `cus_TOUR_FAKE_beacon`,
    },
  });
  const tom = await findOrCreateDirector({
    agencyId, email: "tom@beaconestates.co.uk",
    name: "Tom Reeves", firmName: "Beacon Estates", role: "director",
  });
  console.log(`  tom director: ${tom.created ? "created (password: " + DEMO_PASSWORD + ")" : "ensured"} (${tom.id})`);

  await wipeTourDataForAgency(agencyId);

  // 1 prior-month exchange whose payment failed.
  const lastMonth = new Date(now.getTime() - 25 * 24 * 3_600_000);
  const lastMonthStart = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth(), 1));
  const tx = await p.propertyTransaction.create({
    data: {
      agencyId, agentUserId: tom.id, progressedBy: "agent",
      propertyAddress: `${TOUR_PREFIX}14 Quay Street, Brighton`,
      serviceType: "outsourced", purchasePrice: 38_000_000,
      tenure: "freehold", purchaseType: "mortgage",
      exchangedAt: lastMonth, billedAtExchange: lastMonth, priceAtExchange: 38_000_000,
      freeOnExchange: false,
    },
  });
  const inv = await p.invoice.create({
    data: {
      agencyId, monthStart: lastMonthStart, status: "failed",
      issuedAt: new Date(lastMonthStart.getTime() + 30 * 24 * 3_600_000),
      stripeInvoiceId: `in_TOUR_FAKE_beacon_failed`,
    },
  });
  await p.invoiceLine.create({
    data: {
      invoiceId: inv.id, transactionId: tx.id, kind: "outsourced_fee",
      description: `Outsourced — £350,000–£499,999 — ${tx.propertyAddress}`,
      amountPence: 30000, vatPence: 0, totalPence: 30000,
    },
  });
  console.log(`  blocked state set up: paymentFailedAt 9d ago, newFileCreationBlockedAt now`);
}

async function seedMarlowWarning() {
  divider("Seeding Marlow & Co — WARNING demo");
  const { id: agencyId } = await findOrCreateAgency("Marlow & Co");
  const now = new Date();
  const failedAt = new Date(now.getTime() - 3 * 24 * 3_600_000);
  await p.agency.update({
    where: { id: agencyId },
    data: {
      firstSubmissionAt: new Date(Date.now() - 90 * 24 * 3_600_000),
      vatRegisteredAt: null, vatRateBps: null,
      paymentFailedAt: failedAt,
      newFileCreationBlockedAt: null,
      stripeCustomerId: `cus_TOUR_FAKE_marlow`,
    },
  });
  const james = await findOrCreateDirector({
    agencyId, email: "james@marlowandco.co.uk",
    name: "James Marlow", firmName: "Marlow & Co", role: "director",
  });
  console.log(`  james director: ${james.created ? "created (password: " + DEMO_PASSWORD + ")" : "ensured"} (${james.id})`);

  await wipeTourDataForAgency(agencyId);

  // 1 file this month already billed (so the billing page shows something
  // alongside the warning).
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  await seedExchanges(agencyId, james.id, thisMonthStart, [
    { address: `${TOUR_PREFIX}9 Riverside Walk, Oxford`, serviceType: "self_managed", purchasePrice: 32_000_000, freeOnExchange: false },
  ]);
  console.log(`  warning state set up: paymentFailedAt 3d ago, no block yet`);
}

async function main() {
  const dbProj = projectIdOf(process.env.DATABASE_URL);
  if (dbProj === PROD_PROJECT_ID) {
    console.error("ABORT — DATABASE_URL points at PRODUCTION. Staging-only script.");
    process.exit(1);
  }
  if (dbProj !== STAGING_PROJECT_ID) {
    console.error(`ABORT — DATABASE_URL project id (${dbProj}) isn't staging.`);
    process.exit(1);
  }

  console.log("");
  console.log("================================================================");
  console.log("  Seeding payments tour on STAGING");
  console.log("================================================================");
  console.log(`  Project ID: ${dbProj}`);
  console.log("");

  try {
    await seedHartwell();
    await seedBeaconBlocked();
    await seedMarlowWarning();

    divider("Done");
    console.log("");
    console.log("Login credentials:");
    console.log(`  Hartwell director (main tour):  emily@hartwellpartners.co.uk  (existing password)`);
    console.log(`  Hartwell negotiator (404 test): sam@hartwellpartners.co.uk    (password: ${DEMO_PASSWORD})`);
    console.log(`  Beacon BLOCKED demo:            tom@beaconestates.co.uk       (password: ${DEMO_PASSWORD})`);
    console.log(`  Marlow WARNING demo:            james@marlowandco.co.uk       (password: ${DEMO_PASSWORD})`);
    console.log("");
    console.log("Run scripts/spot-check-payments-tour.ts to verify state per agency.");
  } finally {
    await p.$disconnect();
  }
}

void main();
