// app/billing-terms/page.tsx
//
// Public preview of the Billing Terms — Version 2026-08-payments-v6
// (shown to users as "Billing Terms - August 2026").
//
// CRITICAL: the AUTHORITATIVE source of the live billing terms is the
// TermsVersion DB row (rendered to directors via RedesignedDisclosure when
// they save a card). This /billing-terms page is a READ-ONLY PREVIEW.
//
// The text below MUST stay in sync with the v5 TermsVersion DB row + the
// v5 migration SQL. Changing the wording here without shipping a new
// TermsVersion creates drift between what users see in the public preview
// and what they actually acknowledge when saving a card.
//
// v5 shipped as part of the free-pricing migration (self-progress becomes
// free; the £59 in-house fee is retired; the 14-day free trial is replaced
// by first-outsourced-file-free). It is a MATERIAL change from v4, so every
// director who acknowledged v4 re-acknowledges v5. Once a director has
// acknowledged v5 in production, any further material change ships as v6.
//
// Two sources of v5 truth (keep in sync):
//   1. This page (public preview)
//   2. prisma/migrations/20260831120000_terms_version_v5/migration.sql
//      (also the row that runs on deploy, versionTag = '2026-08-payments-v6')

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Billing Terms — The Sales Progressor",
  description:
    "Pricing, billing cadence, payment failures, and how we handle credit notes.",
  robots: { index: true, follow: true },
};

const SECTIONS: PolicySection[] = [
  {
    id: "about-these-terms",
    title: "About these terms",
    body: (
      <p>
        By saving a payment card, you agree to the pricing and billing terms set out below. Billing
        is operated by The Sales Progressor.
      </p>
    ),
  },
  {
    id: "charges",
    title: "Charges",
    body: (
      <>
        <p>
          Fees apply only to sales you pass to our team to progress, and only if that sale
          exchanges.
        </p>
        <ul>
          <li>Sales you progress yourself are <strong>free</strong>, at every stage, with no charge on exchange.</li>
          <li>
            Your agency&rsquo;s <strong>first sale passed to our team is free</strong>. After that,
            the fee is determined by the agreed sale price at exchange, as follows:{" "}
            <strong>£250</strong> for a sale price up to £349,999; <strong>£300</strong> for a sale
            price from £350,000 to £499,999; and <strong>£350</strong> for a sale price of £500,000
            or above.
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
        No fee is charged until an outsourced sale exchanges. Fees for all outsourced sales that
        exchange within a calendar month are collected as a single payment at the end of that month.
        The running total of fees due for sales exchanged during the current month is shown on your
        billing page, subject to availability of the service.
      </p>
    ),
  },
  {
    id: "free-sales",
    title: "Free sales",
    body: (
      <p>
        Sales you progress yourself are <strong>always free</strong>, at every stage, including on
        exchange. Each agency&rsquo;s <strong>first sale passed to our team is also free</strong> and
        will not incur a fee when it exchanges.
      </p>
    ),
  },
  {
    id: "reversed-sales-and-credits",
    title: "Reversed sales and credits",
    body: (
      <p>
        Where a sale that has exchanged is subsequently reversed or the exchange is formally
        rescinded, the corresponding fee will be credited to your account and applied against your
        next payment. This is processed automatically and requires no action on your part.
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
        resolve the outstanding balance. If the payment remains outstanding after that period, you
        will be unable to send new sales to our team until it is resolved. Sales you progress
        yourself are unaffected and remain free, and any outsourced sales already being progressed by
        our team will continue as normal.
      </p>
    ),
  },
  {
    id: "card-storage",
    title: "Card storage",
    body: (
      <p>
        Your card details are stored securely by our payment processor, <strong>Stripe</strong>, and
        are not held by us. We have access only to the last four digits and brand of your card, and
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
        passed to our team after the new pricing takes effect. Any outsourced sale already in
        progress will be charged at the price that applied when it was passed to our team.
      </p>
    ),
  },
  {
    id: "vat",
    title: "VAT",
    body: (
      <p>
        We are not currently registered for VAT, so VAT is not added to these fees. Should this
        change, we will notify you before it affects the amount you pay. As this is a material
        change, we will issue updated billing terms for your acknowledgement before the new charges
        apply.
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
      description="Pricing, billing cadence, payment failures, and credit notes."
      lastUpdated="31 August 2026"
      version="6"
      sections={SECTIONS}
    />
  );
}
