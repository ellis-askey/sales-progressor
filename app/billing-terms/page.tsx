// app/billing-terms/page.tsx
//
// Public preview of the Billing Terms — Version 2026-05-payments-v2.
//
// CRITICAL: the AUTHORITATIVE source of the live billing terms is the
// TermsVersion DB row (rendered to directors via RedesignedDisclosure when
// they save a card). This /billing-terms page is a READ-ONLY PREVIEW for:
//   - the /legal hub to link to
//   - anyone (or counsel) wanting to read the terms outside the card-save flow
//   - search engines / customers comparing terms before signing up
//
// The text below MUST stay in sync with the v2 TermsVersion DB row + the
// migration SQL + the insertion script. If you change the wording here without
// shipping a new TermsVersion, users will see one set of terms in this preview
// and a DIFFERENT set when they actually save a card — bad.
//
// The four sources of v2 truth (keep in sync):
//   1. This page — public preview
//   2. prisma/migrations/<timestamp>_terms_version_v2/migration.sql — history
//   3. scripts/insert-prod-terms-v2.ts — re-runnable seed for fresh envs
//   4. TermsVersion DB row, versionTag = '2026-06-payments-v2'
//
// COUNSEL NOTES (do NOT remove — internal markers):
//
// 1. [COUNSEL TO CONFIRM] — Payment-failure section: whether to state the
//    specific grace mechanics (14-day warning → 7-day grace → block) or keep
//    the plainer wording. Plainer is more readable; specifics matter more if
//    a charge is ever disputed.
//
// 2. [COUNSEL TO CONFIRM] — Pricing-change clause and notice period. A
//    specific notice period (e.g. 30 days) is stronger than "advance notice"
//    — please advise.
//
// 3. [COUNSEL TO CONFIRM] — Dispute/chargeback wording, and whether anything
//    further is needed on cancellation of the billing relationship (what
//    happens to completed-but-unbilled sales in the current month if a
//    director removes their card or closes the account).
//
// Source of truth for full annotated copy + observations:
// docs/policies/billing-terms.md

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Billing Terms — The Sales Progressor",
  description:
    "Pricing, billing cadence, your free trial, payment failures, and how we handle credit notes.",
};

const PENDING_ENTITY = (
  <span className="pending">The Sales Progressor Ltd — company number TBC</span>
);
const PENDING_ADDRESS = (
  <span className="pending">registered office address TBC</span>
);

const SECTIONS: PolicySection[] = [
  {
    id: "what-this-covers",
    title: "Sales Progressor — pricing",
    body: (
      <p>
        By saving a payment card, you agree to the following pricing terms. Billing is operated by{" "}
        {PENDING_ENTITY}, registered office {PENDING_ADDRESS}.
      </p>
    ),
  },
  {
    id: "what-you-pay",
    title: "What you pay",
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
        Sales already underway carry on as normal. We&rsquo;ll show you clearly that a payment
        needs attention and how to fix it. If it remains unresolved, you won&rsquo;t be able to
        add new sales until it&rsquo;s sorted — your existing sales are unaffected.
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
        We may change our pricing in future. If we do, we&rsquo;ll give you advance notice and the
        change will apply only to sales added after the new pricing takes effect — any sales
        already in progress are honoured at the price that applied when they were added.
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
      lastUpdated="25 May 2026"
      version="2026-06-payments-v2"
      sections={SECTIONS}
    />
  );
}
