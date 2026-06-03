// app/billing-terms/page.tsx
//
// Public preview of the Billing Terms — Version 2026-06-payments-v4.
//
// CRITICAL: the AUTHORITATIVE source of the live billing terms is the
// TermsVersion DB row (rendered to directors via RedesignedDisclosure when
// they save a card). This /billing-terms page is a READ-ONLY PREVIEW.
//
// The text below MUST stay in sync with the v4 TermsVersion DB row + the
// v4 migration SQL + the v4 insertion script. Changing the wording here
// without shipping a new TermsVersion creates drift between what users see
// in the public preview and what they actually acknowledge when saving a card.
//
// v4 shipped 2026-05-26 and has since had two in-place copy refinements
// while still pre-acknowledgement on staging: placeholder line removed
// (2026-05-29) and full re-phrasing into formal noun-phrase headings
// (Charges / Payment and collection / Free trial period / etc.) on
// 2026-06-01. Once a director has acknowledged v4 in production, any
// further material change ships as v5; small placeholder tidies do not.
//
// Four sources of v4 truth (keep in sync):
//   1. This page (public preview)
//   2. prisma/migrations/20260526100000_terms_version_v4/migration.sql
//   3. scripts/insert-prod-terms-v4.ts
//   4. TermsVersion DB row, versionTag = '2026-06-payments-v4'
//
// No remaining placeholders on this page.

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Billing Terms — The Sales Progressor",
  description:
    "Pricing, billing cadence, your free trial, payment failures, and how we handle credit notes.",
  robots: { index: true, follow: true },
};

const SECTIONS: PolicySection[] = [
  {
    id: "about-these-terms",
    title: "About these terms",
    body: (
      <p>
        By saving a payment card, you agree to the pricing terms set out below. Billing is operated
        by The Sales Progressor.
      </p>
    ),
  },
  {
    id: "charges",
    title: "Charges",
    body: (
      <>
        <p>Fees are charged per sale and only on exchange of that sale.</p>
        <ul>
          <li>For a sale you progress in-house, the fee is <strong>£59</strong>.</li>
          <li>
            For a sale you pass to our team to progress, the fee is determined by the agreed sale
            price at exchange, as follows: <strong>£250</strong> for a sale price up to £349,999;{" "}
            <strong>£300</strong> for a sale price from £350,000 to £499,999; and{" "}
            <strong>£350</strong> for a sale price of £500,000 or above.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "payment-and-collection",
    title: "Payment and collection",
    body: (
      <p>
        No fee is charged until a sale exchanges. Fees for all sales that exchange within a calendar
        month are collected as a single payment at the end of that month. The running total of fees
        accrued in the current month is shown on your billing page, subject to availability of the
        service.
      </p>
    ),
  },
  {
    id: "free-trial-period",
    title: "Free trial period",
    body: (
      <p>
        Any sale added within the first <strong>14 days</strong> is not chargeable at any stage,
        including on its eventual exchange, regardless of how long after the trial period that
        exchange occurs. The 14-day period begins on the date you add your first sale.
      </p>
    ),
  },
  {
    id: "reversed-sales-and-credits",
    title: "Reversed sales and credits",
    body: (
      <p>
        Where a sale that has exchanged is subsequently reversed (for example, where the exchange is
        undone), the corresponding fee is reversed and applied as a credit against your next
        invoice. This is processed automatically and requires no action on your part.
      </p>
    ),
  },
  {
    id: "failed-payments",
    title: "Failed payments",
    body: (
      <p>
        If a payment is unsuccessful, we will notify you and re-attempt collection over a period of{" "}
        <strong>14 days</strong>, followed by a <strong>7-day grace period</strong> in which to
        resolve the matter. If the payment remains outstanding after that period, you will be unable
        to add new sales until it is resolved. Sales already in progress are unaffected throughout.
      </p>
    ),
  },
  {
    id: "card-storage",
    title: "Card storage",
    body: (
      <p>
        Your card details are stored securely by our payment processor, <strong>Stripe</strong>, and
        are not held by us. We have access only to the last four digits and the card brand, and
        never to the full card number.
      </p>
    ),
  },
  {
    id: "billing-party",
    title: "Billing party",
    body: (
      <p>
        The agency&rsquo;s director is the contracting party for billing purposes. Only a director
        may view or manage payment details and invoices; negotiators may not.
      </p>
    ),
  },
  {
    id: "changes-to-pricing",
    title: "Changes to pricing",
    body: (
      <p>
        We may change our pricing in future. Where we do, we will give you at least{" "}
        <strong>30 days&rsquo; notice</strong>, and the revised pricing will apply only to sales
        added after it takes effect. Any sale already in progress will be charged at the price that
        applied when it was added.
      </p>
    ),
  },
  {
    id: "vat",
    title: "VAT",
    body: (
      <p>
        We are not currently registered for VAT, and no VAT is therefore added to these fees. Should
        this change, we will notify you before it affects the amount you pay. As this is a material
        change, we will issue updated billing terms for your acknowledgement before your next
        billing cycle.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "Disputes",
    body: (
      <p>
        If you believe a charge is incorrect, please contact us at{" "}
        <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>{" "}
        before raising a dispute with your card provider, and we will work to resolve it promptly.
      </p>
    ),
  },
  {
    id: "questions",
    title: "Questions",
    body: (
      <>
        <p>
          Anything about billing:{" "}
          <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>
        </p>
        <p>
          For the contract that governs your overall use of the platform, see our{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </>
    ),
  },
];

export default function BillingTermsPage() {
  return (
    <PolicyShell
      title="Billing Terms"
      description="Pricing, billing cadence, your free trial, payment failures, and credit notes."
      lastUpdated="26 May 2026"
      version="4"
      sections={SECTIONS}
    />
  );
}
