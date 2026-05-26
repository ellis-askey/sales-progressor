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
// v4 was shipped 2026-05-26 — pure presentation update from v3:
//   - First section heading split: "Sales Progressor — pricing" became
//     two sections: "About these terms" (preamble) + "Pricing" (was
//     "What you pay"). Body text unchanged. Customers see noun-phrase
//     section titles throughout.
// Body text identical to v3 — headings only. v3 is preserved in the
// TermsVersion table for audit; existing acknowledgements stay valid
// against v3 only.
//
// Four sources of v4 truth (keep in sync):
//   1. This page — public preview
//   2. prisma/migrations/20260526100000_terms_version_v4/migration.sql
//   3. scripts/insert-prod-terms-v4.ts
//   4. TermsVersion DB row, versionTag = '2026-06-payments-v4'
//
// Only remaining placeholders on this page (tracked in
// docs/policies/PLACEHOLDERS.md):
//   - [Company number]            — "About these terms"
//   - [Registered office address] — "About these terms"

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Billing Terms — The Sales Progressor",
  description:
    "Pricing, billing cadence, your free trial, payment failures, and how we handle credit notes.",
};

const SECTIONS: PolicySection[] = [
  {
    id: "about-these-terms",
    title: "About these terms",
    body: (
      <p>
        By saving a payment card, you agree to the following pricing terms. Billing is operated by{" "}
        <strong>The Sales Progressor Ltd</strong>, company number{" "}
        <em className="pending">[Company number]</em>, registered office{" "}
        <em className="pending">[Registered office address]</em>.
      </p>
    ),
  },
  {
    id: "pricing",
    title: "Pricing",
    body: (
      <>
        <p>We charge per sale, and only once it exchanges — never before.</p>
        <ul>
          <li>For a sale you progress in-house: <strong>£59</strong>.</li>
          <li>
            For a sale you pass to our team to progress, the fee depends on the agreed sale price
            at exchange: <strong>£250</strong> for sales up to £349,999, <strong>£300</strong> for
            £350,000 to £499,999, and <strong>£350</strong> for £500,000 and above.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "when-you-pay",
    title: "When you pay",
    body: (
      <p>
        Nothing is charged until a sale exchanges. Fees for sales that exchange in a given month
        are collected together as a single payment at the end of that month. You&rsquo;ll see the
        running total building on your billing page throughout the month (subject to the platform
        being available), so there are no surprises.
      </p>
    ),
  },
  {
    id: "free-trial",
    title: "Your free trial",
    body: (
      <p>
        Any sale you add in your first 14 days is free for its whole life — even when it exchanges
        months later, you won&rsquo;t be charged for it. The 14 days run from the first sale you
        add.
      </p>
    ),
  },
  {
    id: "credit-notes",
    title: "If a sale is later un-done (credit notes)",
    body: (
      <p>
        If a sale that had exchanged is later reversed (for example, an exchange milestone is
        undone), the fee for that sale is reversed as a credit applied against your next bill. You
        don&rsquo;t need to do anything — it&rsquo;s handled automatically.
      </p>
    ),
  },
  {
    id: "payment-failure",
    title: "If a payment fails",
    body: (
      <p>
        Sales already underway carry on as normal. If a payment doesn&rsquo;t go through, we&rsquo;ll
        warn you for <strong>14 days</strong> and try the payment again, then allow a{" "}
        <strong>7-day grace period</strong> for you to resolve it. If it&rsquo;s still unresolved
        after that, you won&rsquo;t be able to add new sales until the payment is sorted — your
        existing sales are unaffected throughout.
      </p>
    ),
  },
  {
    id: "card-storage",
    title: "How your card is stored",
    body: (
      <p>
        Your card details are stored securely by <strong>Stripe</strong>, our payment processor —
        not by us. We can see only the last four digits and the card brand, never the full card
        number.
      </p>
    ),
  },
  {
    id: "whos-billed",
    title: "Who's billed",
    body: (
      <p>
        The agency&rsquo;s director is the contracting party for billing. Only a director can see
        or manage payment details and invoices. Negotiators cannot.
      </p>
    ),
  },
  {
    id: "pricing-changes",
    title: "If pricing changes",
    body: (
      <p>
        We may change our pricing in future. If we do, we&rsquo;ll give you at least{" "}
        <strong>30 days&rsquo; notice</strong> and the change will apply only to sales added after
        the new pricing takes effect — any sales already in progress are honoured at the price that
        applied when they were added.
      </p>
    ),
  },
  {
    id: "vat",
    title: "VAT",
    body: (
      <p>
        We are not currently VAT-registered, so no VAT is added to these fees. If that changes,
        we&rsquo;ll tell you before it affects what you pay — and, because it&rsquo;s a material
        change, we&rsquo;ll issue updated billing terms for you to acknowledge before your next
        billing cycle.
      </p>
    ),
  },
  {
    id: "disputes",
    title: "Disputes",
    body: (
      <p>
        If you think a charge is wrong, contact us at{" "}
        <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>{" "}
        before raising a dispute with your card provider, and we&rsquo;ll work to resolve it
        quickly.
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
