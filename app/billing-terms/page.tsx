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
        By saving a payment card, you agree to the pricing and billing terms set out below. All
        billing for sales managed by our own progression team is administered by The Sales
        Progressor Ltd, a company registered in England and Wales, company number 17455131,
        registered office 5 Hercules Way, Leavesden Park, Watford WD25 7GS, United Kingdom.
      </p>
    ),
  },
  {
    id: "charges",
    title: "Charges",
    body: (
      <>
        <p>
          Fees are payable only on sales you instruct our team to progress, and only when those
          sales exchange contracts.
        </p>
        <ul>
          <li>Sales you progress yourself are <strong>free</strong>, at every stage, with no charge on exchange.</li>
          <li>
            Your agency&rsquo;s <strong>first sale managed by our team is free</strong>. For
            subsequent sales, the fee is calculated using the agreed sale price at the point of
            exchange: <strong>£250</strong> for sales up to £349,999; <strong>£300</strong> for
            sales between £350,000 and £499,999; and <strong>£350</strong> for sales of £500,000 or
            above.
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
        No fee becomes payable until a sale managed by our team exchanges contracts. Fees for all
        qualifying sales exchanged within the same calendar month are collected as a single payment
        at the end of that month. Where available, your billing page will display a running total of
        fees accrued during the current month.
      </p>
    ),
  },
  {
    id: "free-sales",
    title: "Free sales",
    body: (
      <p>
        Sales you progress yourself remain completely <strong>free</strong> throughout the
        transaction, including upon exchange of contracts. Your agency&rsquo;s{" "}
        <strong>first sale managed by our team is also free</strong> and will not attract a fee upon
        exchange.
      </p>
    ),
  },
  {
    id: "reversed-sales-and-credits",
    title: "Reversed sales and credits",
    body: (
      <p>
        If contracts are exchanged but the exchange is subsequently formally rescinded or reversed,
        any fee charged in respect of that sale will be credited to your account and deducted from
        your next payment. Credits are applied automatically, with no action required from you.
      </p>
    ),
  },
  {
    id: "failed-payments",
    title: "Failed payments",
    body: (
      <p>
        If a payment is unsuccessful, we will notify you and make further attempts to collect the
        outstanding amount over the following <strong>14 days</strong>. A further{" "}
        <strong>seven-day grace period</strong> will then apply. If payment remains outstanding at
        the end of this period, your agency&rsquo;s ability to instruct our team on new sales will be
        temporarily suspended until the balance is settled. This will not affect your access to free
        self-progression or interrupt any sales already being managed by our team.
      </p>
    ),
  },
  {
    id: "card-storage",
    title: "Card storage",
    body: (
      <p>
        Your payment card details are securely processed and stored by <strong>Stripe</strong>, our
        payment provider. The Sales Progressor does not store or have access to your full card
        number. We can view only limited card information, including the card brand and last four
        digits, for billing and identification purposes.
      </p>
    ),
  },
  {
    id: "billing-party",
    title: "Billing party",
    body: (
      <p>
        The agency director is responsible for the agency&rsquo;s billing arrangements and is the
        contracting party for these terms. Access to payment details, billing management and
        invoices is restricted to directors. Negotiators do not have access to these functions.
      </p>
    ),
  },
  {
    id: "changes-to-pricing",
    title: "Changes to pricing",
    body: (
      <p>
        We reserve the right to amend our pricing, subject to providing at least{" "}
        <strong>30 days&rsquo; advance notice</strong>. Any revised pricing will apply only to sales
        instructed with our team on or after the date the new pricing takes effect. Sales already
        under our management will remain subject to the pricing in effect when they were originally
        instructed.
      </p>
    ),
  },
  {
    id: "vat",
    title: "VAT",
    body: (
      <p>
        The Sales Progressor is not currently registered for VAT, and no VAT is therefore added to
        the fees stated above. Should our VAT registration status change, we will notify you in
        advance of any resulting change to your charges. Updated billing terms will be provided for
        your acknowledgement before those changes take effect.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "Disputes",
    body: (
      <p>
        If you believe a charge has been made incorrectly, please contact us at{" "}
        <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>{" "}
        in the first instance, before initiating a dispute with your card provider. We will review
        your query and work with you to resolve it as promptly as possible.
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
