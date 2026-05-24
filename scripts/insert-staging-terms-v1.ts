// One-shot: insert the 2026-05-payments-v1 TermsVersion row on STAGING ONLY.
//
// HARD GUARD: refuses to run if DATABASE_URL doesn't point at the staging
// Supabase project ID. PROD's TermsVersion stays empty until Ellis explicitly
// signals "PR 6 closes" after the consolidated browser walk.
//
// Idempotent: if a row with the same versionTag already exists, no-op.
//
// Run: npx ts-node --transpile-only --compiler-options
//        '{"module":"CommonJS","moduleResolution":"node","baseUrl":".",
//          "paths":{"@/*":["./*"]}}'
//        --require tsconfig-paths/register
//        scripts/insert-staging-terms-v1.ts

import { PrismaClient } from "@prisma/client";

const STAGING_PROJECT_ID = "etidawkbqctarmsdjoxp";
const PROD_PROJECT_ID = "gmkfustgwipgihpmpjpr";
const VERSION_TAG = "2026-05-payments-v1";

// Exact text supplied by Ellis. Preserved verbatim — whitespace and
// paragraph breaks survive because PricingDisclosure renders with
// whiteSpace: "pre-wrap".
const TERMS_BODY = `Sales Progressor — pricing
You're adding a payment card so we can bill you for completed sales. Here's exactly how that works.
What you pay. We charge per sale, and only once it exchanges — never before. For a sale you progress in-house, the fee is £59. For a sale you pass to our team to progress, the fee depends on the agreed sale price at exchange: £250 for sales up to £349,999, £300 for £350,000 to £499,999, and £350 for £500,000 and above.
When you pay. Nothing is charged until a sale exchanges. Fees for sales that exchange in a given month are collected together as a single payment at the end of that month. You'll see the running total building on your billing page throughout the month, so there are no surprises.
Your free trial. Any sale you add in your first 7 days is free for its whole life — even when it exchanges months later, you won't be charged for it. The 7 days run from the first sale you add.
If a payment fails. Sales already underway carry on as normal. But until the payment is sorted, you won't be able to add new sales. We'll show you clearly that a payment needs attention and how to fix it.
Who's billed. Billing is handled by the agency's director. Only a director can see or manage payment details and invoices.
VAT. We're not currently VAT-registered, so no VAT is added to these fees. If that changes, we'll let you know before it affects what you pay.`;

function projectIdOf(url: string | undefined): string {
  const m = url?.match(/(?:postgres\.|db\.)([a-z0-9]{20})/);
  return m ? m[1] : "UNKNOWN";
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  const dbProj = projectIdOf(dbUrl);

  if (dbProj === PROD_PROJECT_ID) {
    console.error("");
    console.error("================================================================");
    console.error("  ABORT — DATABASE_URL points at PRODUCTION.");
    console.error("================================================================");
    console.error("  This script is staging-only. Prod's TermsVersion stays empty");
    console.error("  until Ellis explicitly signals 'PR 6 closes' after the");
    console.error("  consolidated browser walk on staging.");
    console.error("================================================================");
    process.exit(1);
  }
  if (dbProj !== STAGING_PROJECT_ID) {
    console.error(`ABORT — DATABASE_URL project id (${dbProj}) doesn't match expected staging (${STAGING_PROJECT_ID}).`);
    process.exit(1);
  }

  console.log("");
  console.log("================================================================");
  console.log("  Inserting TermsVersion row on STAGING");
  console.log("================================================================");
  console.log(`  Project ID:  ${dbProj}`);
  console.log(`  Version tag: ${VERSION_TAG}`);
  console.log(`  Body length: ${TERMS_BODY.length} chars, ${TERMS_BODY.split("\n").length} lines`);
  console.log("================================================================");
  console.log("");

  const p = new PrismaClient();
  try {
    const existing = await p.termsVersion.findUnique({ where: { versionTag: VERSION_TAG } });
    if (existing) {
      console.log(`No-op: row with versionTag '${VERSION_TAG}' already exists (id=${existing.id}).`);
      console.log(`  effectiveFrom: ${existing.effectiveFrom.toISOString()}`);
      console.log(`  body length:   ${existing.body.length} chars`);
      console.log("");
      console.log("If you need to UPDATE the body of an existing row, do it manually");
      console.log("via psql or Supabase studio — this script only INSERTS.");
      process.exit(0);
    }

    const row = await p.termsVersion.create({
      data: {
        versionTag: VERSION_TAG,
        body: TERMS_BODY,
        effectiveFrom: new Date(),
      },
    });
    console.log(`✓ Inserted row id=${row.id}`);
    console.log(`  versionTag:    ${row.versionTag}`);
    console.log(`  effectiveFrom: ${row.effectiveFrom.toISOString()}`);
    console.log(`  createdAt:     ${row.createdAt.toISOString()}`);
    console.log("");
    console.log("Staging /agent/billing/payment-method should now render the");
    console.log("disclosure (state = 'disclosure') for any director who visits.");
  } finally {
    await p.$disconnect();
  }
}

void main();
