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
    body: "By saving a payment card, you agree to the following pricing terms.",
  },
  {
    heading: "Pricing",
    body: "We charge per sale, and only once it exchanges — never before. For a sale you progress in-house, the fee is £59. For a sale you pass to our team to progress, the fee depends on the agreed sale price at exchange: £250 for sales up to £349,999, £300 for £350,000 to £499,999, and £350 for £500,000 and above.",
  },
  {
    heading: "When you pay",
    body: "Nothing is charged until a sale exchanges. Fees for sales that exchange in a given month are collected together as a single payment at the end of that month. You'll see the running total building on your billing page throughout the month (subject to the platform being available), so there are no surprises.",
  },
  {
    heading: "Your free trial",
    body: "Any sale you add in your first 14 days is free for its whole life — even when it exchanges months later, you won't be charged for it. The 14 days run from the first sale you add.",
  },
  {
    heading: "If a sale is later un-done (credit notes)",
    body: "If a sale that had exchanged is later reversed (for example, an exchange milestone is undone), the fee for that sale is reversed as a credit applied against your next bill. You don't need to do anything — it's handled automatically.",
  },
  {
    heading: "If a payment fails",
    body: "Sales already underway carry on as normal. If a payment doesn't go through, we'll warn you for 14 days and try the payment again, then allow a 7-day grace period for you to resolve it. If it's still unresolved after that, you won't be able to add new sales until the payment is sorted — your existing sales are unaffected throughout.",
  },
  {
    heading: "How your card is stored",
    body: "Your card details are stored securely by Stripe, our payment processor — not by us. We can see only the last four digits and the card brand, never the full card number.",
  },
  {
    heading: "Who's billed",
    body: "The agency's director is the contracting party for billing. Only a director can see or manage payment details and invoices. Negotiators cannot.",
  },
  {
    heading: "If pricing changes",
    body: "We may change our pricing in future. If we do, we'll give you at least 30 days' notice and the change will apply only to sales added after the new pricing takes effect — any sales already in progress are honoured at the price that applied when they were added.",
  },
  {
    heading: "VAT",
    body: "We are not currently VAT-registered, so no VAT is added to these fees. If that changes, we'll tell you before it affects what you pay — and, because it's a material change, we'll issue updated billing terms for you to acknowledge before your next billing cycle.",
  },
  {
    heading: "Disputes",
    body: "If you think a charge is wrong, contact us at support@thesalesprogressor.co.uk before raising a dispute with your card provider, and we'll work to resolve it quickly.",
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
