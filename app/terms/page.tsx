// app/terms/page.tsx
//
// Terms of Service — Version 1.0, published 25 May 2026.
//
// All [COUNSEL TO CONFIRM] flags resolved by Ellis on 2026-05-25 to settled
// positions and stripped from the public render. See git log for the
// original draft. Solicitor will still review the finished document.
//
// Liability cap (§10) set to market-standard: fees paid in 12 months
// preceding the claim. Non-excludable carve-out (death/personal
// injury/fraud) preserved exactly as drafted. Consumer Rights Act
// exposure for single-director agencies considered covered by the
// non-excludable carve-out — no separate clause needed on the public page.
//
// Only remaining placeholders on this page (tracked in
// docs/policies/PLACEHOLDERS.md):
//   - [Company number]            — § 1
//   - [Registered office address] — § 1

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Terms of Service — The Sales Progressor",
  description: "The contract between you (or your agency) and us.",
};

const SECTIONS: PolicySection[] = [
  {
    id: "about-this-service",
    title: "1. About this service",
    body: (
      <>
        <p>
          The Sales Progressor is a property transaction management platform operated by{" "}
          <strong>The Sales Progressor Ltd</strong>, a company registered in England and Wales,
          company number <em className="pending">[Company number]</em>, registered office{" "}
          <em className="pending">[Registered office address]</em>{" "}
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
        </p>
        <p>
          The platform helps estate agencies and property professionals track, manage, and
          communicate progress on residential property sales and purchases.{" "}
          <strong>It is not a conveyancing, legal, financial, or valuation service</strong>, and
          nothing in it constitutes professional advice.
        </p>
        <p>
          These terms form a contract between you (and, where you act for an agency, the agency) and
          us. By creating an account or using the platform, you accept them. Pricing for paid use is
          set out separately in the Billing Terms presented when a payment card is added, and is
          accepted at that point (see section 8).
        </p>
      </>
    ),
  },
  {
    id: "accounts-and-access",
    title: "2. Accounts and access",
    body: (
      <>
        <p>
          Access is granted by direct registration or by invitation from an existing agency account
          holder. You are responsible for keeping your login details secure, and must not share them
          or let others use your account.
        </p>
        <p>
          Portal access links sent to buyers and sellers are unique to each individual and tied to a
          specific transaction. Recipients should not share or forward these links, as they give
          access to personal transaction data.
        </p>
        <p>
          Agency administrators may deactivate accounts within their agency. Deactivated and
          inactive accounts are handled in line with our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable use",
    body: (
      <>
        <p>The platform may be used only for managing residential property transactions. You agree not to:</p>
        <ul>
          <li>Send unsolicited, misleading, or abusive communications through the platform</li>
          <li>Attempt to access transaction data belonging to other agencies or individuals</li>
          <li>Transmit harmful content, malware, or material that infringes others&rsquo; rights</li>
          <li>Use automated means to extract data from the platform without our authorisation</li>
          <li>Interfere with the normal operation of the platform or its infrastructure</li>
        </ul>
        <p>Breaching this section may lead to suspension or termination under section 9.</p>
      </>
    ),
  },
  {
    id: "communications-logging",
    title: "4. Communications logging",
    body: (
      <>
        <p>
          Communications sent through the platform — chase emails, progress updates, portal messages
          — are logged and retained for record-keeping and compliance, in line with the retention
          periods in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>
          Messages sent to buyers, sellers, or solicitors are the responsibility of the sending user
          and their agency. We are not responsible for the content of messages composed and sent by
          platform users.
        </p>
        <p>
          If you choose to connect an email mailbox, we may access and store emails relating to your
          sales against the relevant transaction and send emails from your address on your behalf.
          Connecting your mailbox is optional, and you can disconnect it at any time. Further
          information about how we handle this data is set out in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </>
    ),
  },
  {
    id: "ai-features",
    title: "5. AI-assisted features",
    body: (
      <>
        <p>
          The platform includes AI-assisted drafting for chase communications, performed using
          Anthropic&rsquo;s Claude API. Drafts are presented for your review before sending — they
          are never sent automatically. You are responsible for reviewing, editing, and approving
          any AI-generated content before it goes to a recipient. We accept no liability for
          AI-generated drafts that are sent without adequate review.
        </p>
        <p>
          For each draft, the information sent to Anthropic is limited to: the recipient&rsquo;s
          first name and role; the role labels (but not the names) of other parties on the
          transaction; the property&rsquo;s street line (without town or postcode); the tenure and
          purchase type; the expected exchange date (only once confirmed); the milestone being
          chased and how long it has been outstanding; and the number of days since the last
          contact with that recipient.
        </p>
        <p>
          For drafting, the information sent does <strong>not</strong> include the full names of any
          other party, postcodes, sale prices, email addresses, phone numbers, internal notes, or the
          content of any previous message. Anthropic processes this data under their commercial API terms and{" "}
          <strong>does not use it to train their models</strong>.
        </p>
        <p>
          Where you connect an email mailbox, we may use AI to interpret emails relating to a sale
          and suggest relevant updates to the transaction. These suggestions are provided for review
          and are not applied automatically.
        </p>
      </>
    ),
  },
  {
    id: "your-data-our-platform",
    title: "6. Your data and our platform",
    body: (
      <>
        <p>
          <strong>Your data is yours.</strong> As between you and us, you (or your agency, or its
          clients) own the transaction data and content you enter. We claim no ownership over it.
          You can export your data from the platform at any time using the in-app export function.
        </p>
        <p>
          <strong>Our platform is ours.</strong> We own the platform itself — the software, design,
          and underlying systems. These terms don&rsquo;t transfer any of that to you; they grant
          you a limited, non-exclusive right to use the platform while your account is active.
        </p>
        <p>
          We act as data processor for the client data your agency enters, and as data controller
          for your account and billing data, as set out in our{" "}
          <Link href="/privacy">Privacy Policy</Link>. Where we process personal data on an
          agency&rsquo;s behalf, that processing is also governed by our{" "}
          <Link href="/legal/dpa">Data Processing Agreement</Link>.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "7. Availability",
    body: (
      <p>
        We aim to keep the platform reliably available but do not guarantee uninterrupted access,
        and may carry out maintenance or updates. The platform is a communication and tracking tool
        — it does not provide legal, financial, conveyancing, or valuation advice. Decisions made
        using information in the platform remain the responsibility of users and their clients.
      </p>
    ),
  },
  {
    id: "pricing-and-payment",
    title: "8. Pricing and payment",
    body: (
      <p>
        Pricing for paid use is set out in the{" "}
        <Link href="/billing-terms">Billing Terms</Link> shown when a director adds a payment card,
        and is accepted separately at that point. Those terms cover what you pay, when, your free
        trial, and how payment failures are handled. The director of an agency is the contracting
        party for billing; negotiators cannot manage payment details or view invoices.
      </p>
    ),
  },
  {
    id: "suspension-termination",
    title: "9. Suspension and termination",
    body: (
      <>
        <p>
          You may stop using the platform and close your account at any time. On account closure,
          your data is handled per the retention periods in our{" "}
          <Link href="/privacy">Privacy Policy</Link>; any fees already due for completed sales
          remain payable.
        </p>
        <p>
          We may suspend or terminate access if you materially breach these terms (including the
          acceptable-use section), if required by law, or if continued provision is no longer
          commercially viable — giving reasonable notice where we can.
        </p>
      </>
    ),
  },
  {
    id: "limitation-of-liability",
    title: "10. Limitation of liability",
    body: (
      <>
        <p>
          Nothing in these terms limits or excludes our liability for death or personal injury
          caused by negligence, for fraud or fraudulent misrepresentation, or for anything that
          cannot lawfully be limited or excluded.
        </p>
        <p>
          Subject to that, and to the maximum extent permitted by law, our total liability arising
          out of or in connection with these terms (whether in contract, tort including negligence,
          breach of statutory duty, or otherwise) is{" "}
          <strong>
            limited to the total fees you paid to us in the 12 months preceding the event giving
            rise to the claim
          </strong>
          .
        </p>
        <p>
          Subject also to the non-excludable matters above, we are not liable for indirect,
          incidental, or consequential loss, including loss of data, lost transactions, lost
          profits, or missed deadlines arising from use of, or inability to use, the platform.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "11. Changes to these terms",
    body: (
      <p>
        We may update these terms from time to time. We will publish the updated terms on the
        platform with a new version and date, and notify account holders of material changes.
        Continued use after an update means you accept the revised terms.
      </p>
    ),
  },
  {
    id: "governing-law",
    title: "12. Governing law",
    body: (
      <p>
        These terms are governed by the laws of England and Wales. Disputes are subject to the
        exclusive jurisdiction of the courts of England and Wales.
      </p>
    ),
  },
  {
    id: "contact",
    title: "13. Contact",
    body: (
      <p>
        Questions about these terms:{" "}
        <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <PolicyShell
      title="Terms of Service"
      description="The contract between you (or your agency) and us."
      lastUpdated="31 August 2026"
      version="1.1"
      sections={SECTIONS}
    />
  );
}
