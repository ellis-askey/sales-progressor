// One-shot: insert the 2026-06-payments-v4 TermsVersion row on PRODUCTION.
//
// Mirror of insert-prod-terms-v3.ts but for v4. Same canonical content as the
// migration SQL — single source of truth for v4 across environments.
//
// v1, v2, v3 stay in the table for audit. v4 becomes the active version on
// insertion because getActiveTermsVersion() picks the latest effectiveFrom.
//
// What changed vs v3 (presentation only — body text identical):
//   - First section heading split: "Sales Progressor — pricing" became two
//     sections: "About these terms" + "Pricing" (was "What you pay").
//
// Run ONLY after:
//   1. The migration 20260526100000_terms_version_v4 has been applied to prod
//      via npm run db:migrate:prod (which itself does the insert via raw SQL).
//      This script is the backup / re-runnable seed mechanism for cases where
//      the migration didn't run or the row was removed.
//   2. master has the corresponding v4-aware code shipped (the v4 preview
//      page).
//
// Idempotent: no-op if a row with versionTag '2026-06-payments-v4' already
// exists. Exits 0.
//
// Three sources to keep in sync for v4:
//   1. prisma/migrations/20260526100000_terms_version_v4/migration.sql
//   2. This script
//   3. app/billing-terms/page.tsx (public preview)
// If any one changes materially, ship v5 — don't edit v4 in place.

import { PrismaClient } from "@prisma/client";

const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";
const VERSION_TAG = "2026-06-payments-v4";

// Same canonical content as the v4 migration SQL.
const TERMS_SECTIONS = [
  {
    heading: "About these terms",
    body: "By saving a payment card, you agree to the pricing terms set out below. Billing is operated by The Sales Progressor.",
  },
  {
    heading: "Charges",
    body: "Fees are charged per sale and only on exchange of that sale. For a sale you progress in-house, the fee is £59. For a sale you pass to our team to progress, the fee is determined by the agreed sale price at exchange, as follows: £250 for a sale price up to £349,999; £300 for a sale price from £350,000 to £499,999; and £350 for a sale price of £500,000 or above.",
  },
  {
    heading: "Payment and collection",
    body: "No fee is charged until a sale exchanges. Fees for all sales that exchange within a calendar month are collected as a single payment at the end of that month. The running total of fees accrued in the current month is shown on your billing page, subject to availability of the service.",
  },
  {
    heading: "Free trial period",
    body: "Any sale added within the first 14 days is not chargeable at any stage, including on its eventual exchange, regardless of how long after the trial period that exchange occurs. The 14-day period begins on the date you add your first sale.",
  },
  {
    heading: "Reversed sales and credits",
    body: "Where a sale that has exchanged is subsequently reversed (for example, where the exchange is undone), the corresponding fee is reversed and applied as a credit against your next invoice. This is processed automatically and requires no action on your part.",
  },
  {
    heading: "Failed payments",
    body: "If a payment is unsuccessful, we will notify you and re-attempt collection over a period of 14 days, followed by a 7-day grace period in which to resolve the matter. If the payment remains outstanding after that period, you will be unable to add new sales until it is resolved. Sales already in progress are unaffected throughout.",
  },
  {
    heading: "Card storage",
    body: "Your card details are stored securely by our payment processor, Stripe, and are not held by us. We have access only to the last four digits and the card brand, and never to the full card number.",
  },
  {
    heading: "Billing party",
    body: "The agency's director is the contracting party for billing purposes. Only a director may view or manage payment details and invoices; negotiators may not.",
  },
  {
    heading: "Changes to pricing",
    body: "We may change our pricing in future. Where we do, we will give you at least 30 days' notice, and the revised pricing will apply only to sales added after it takes effect. Any sale already in progress will be charged at the price that applied when it was added.",
  },
  {
    heading: "VAT",
    body: "We are not currently registered for VAT, and no VAT is therefore added to these fees. Should this change, we will notify you before it affects the amount you pay. As this is a material change, we will issue updated billing terms for your acknowledgement before your next billing cycle.",
  },
  {
    heading: "Disputes",
    body: "If you believe a charge is incorrect, please contact us at support@thesalesprogressor.co.uk before raising a dispute with your card provider, and we will work to resolve it promptly.",
  },
];

function projectIdOf(url: string | undefined): string {
  const m = url?.match(/(?:postgres\.|db\.)([a-z0-9]{20})/);
  return m ? m[1] : "UNKNOWN";
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const dbProj = projectIdOf(dbUrl);

  if (dbProj === STAGING_PROJECT_ID) {
    console.error("");
    console.error("================================================================");
    console.error("  ABORT — DATABASE_URL points at STAGING.");
    console.error("================================================================");
    console.error("  This script is PRODUCTION-only. For staging, run the migration");
    console.error("  (npm run db:migrate:staging) which itself inserts the row.");
    console.error("================================================================");
    process.exit(1);
  }
  if (dbProj !== PROD_PROJECT_ID) {
    console.error(`ABORT — DATABASE_URL project id (${dbProj}) isn't prod (${PROD_PROJECT_ID}).`);
    process.exit(1);
  }

  console.log("");
  console.log("================================================================");
  console.log("  Inserting TermsVersion v4 on PRODUCTION");
  console.log("================================================================");
  console.log(`  Project ID:  ${dbProj}`);
  console.log(`  Version tag: ${VERSION_TAG}`);
  console.log(`  Sections:    ${TERMS_SECTIONS.length}`);
  console.log("================================================================");
  console.log("");

  const p = new PrismaClient();
  try {
    const existing = await p.termsVersion.findUnique({ where: { versionTag: VERSION_TAG } });
    if (existing) {
      console.log(`No-op: row with versionTag '${VERSION_TAG}' already exists on prod (id=${existing.id}).`);
      console.log(`  effectiveFrom: ${existing.effectiveFrom.toISOString()}`);
      process.exit(0);
    }

    const row = await p.termsVersion.create({
      data: {
        versionTag: VERSION_TAG,
        bodySections: TERMS_SECTIONS,
        effectiveFrom: new Date(),
      },
    });
    console.log(`✓ Inserted PROD TermsVersion v4 row id=${row.id}`);
    console.log(`  versionTag:    ${row.versionTag}`);
    console.log(`  effectiveFrom: ${row.effectiveFrom.toISOString()}`);
    console.log("");
    console.log("Production /agent/account/billing now serves v4 disclosure.");
    console.log("Directors who acknowledged v1, v2 or v3 will re-acknowledge v4 on next card action.");
  } finally {
    await p.$disconnect();
  }
}

void main();
