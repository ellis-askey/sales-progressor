// One-off: replace the v4 TermsVersion row's bodySections with the
// 2026-06-01 re-phrased corpus (formal noun-phrase headings throughout:
// Charges / Payment and collection / Free trial period / Reversed sales
// and credits / Failed payments / Card storage / Billing party / Changes
// to pricing / VAT / Disputes, with a lead-in "About these terms" that
// re-introduces "Billing is operated by The Sales Progressor.").
//
// Context: v4 has not yet been acknowledged in production, so we
// continue editing in place rather than shipping v5. Once any director
// acknowledges v4 in prod, the next material change must ship v5.
//
// Idempotent: compares the existing bodySections to the new corpus and
// no-ops if they already match. Safe to re-run.
//
// Run on staging:
//   DATABASE_URL=<staging-direct-url> npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/update-v4-terms-rephrase-2026-06-01.ts
//
// Run on prod: same command with the prod DATABASE_URL.

import { PrismaClient } from "@prisma/client";

const VERSION_TAG = "2026-06-payments-v4";

type Section = { heading: string; body: string };

const NEW_SECTIONS: Section[] = [
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

function sectionsEqual(a: Section[], b: Section[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].heading !== b[i].heading) return false;
    if (a[i].body !== b[i].body) return false;
  }
  return true;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const row = await prisma.termsVersion.findUnique({
      where: { versionTag: VERSION_TAG },
      select: { id: true, bodySections: true },
    });

    if (!row) {
      console.log(`No-op: no row with versionTag '${VERSION_TAG}' on this DB.`);
      return;
    }

    if (!Array.isArray(row.bodySections)) {
      console.error("Aborting: bodySections is not an array on this row.");
      process.exit(1);
    }

    const current = row.bodySections as unknown as Section[];
    if (sectionsEqual(current, NEW_SECTIONS)) {
      console.log("No-op: bodySections already match the 2026-06-01 corpus.");
      return;
    }

    await prisma.termsVersion.update({
      where: { id: row.id },
      data: { bodySections: NEW_SECTIONS as unknown as object },
    });

    console.log(`Updated TermsVersion ${VERSION_TAG} (id=${row.id}).`);
    console.log(`Replaced bodySections with ${NEW_SECTIONS.length} re-phrased sections.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
