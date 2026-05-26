// app/privacy/page.tsx
//
// Privacy Policy — Version 1.0, published 25 May 2026.
//
// All [COUNSEL TO CONFIRM] flags resolved by Ellis on 2026-05-25 to settled
// positions and stripped from the public render. See git log for the
// original draft + the open questions that were resolved. Solicitor will
// still review the finished document.
//
// Only remaining placeholders on this page (tracked in
// docs/policies/PLACEHOLDERS.md):
//   - [Company number]            — § 1, § 11
//   - [Registered office address] — § 1, § 11

import type { Metadata } from "next";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Privacy Policy — The Sales Progressor",
  description:
    "How we collect, use, and protect personal data, and the rights you have over your data.",
};

const SECTIONS: PolicySection[] = [
  {
    id: "who-we-are",
    title: "1. Who we are",
    body: (
      <>
        <p>
          The Sales Progressor (&ldquo;Sales Progressor&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;our&rdquo;) is a property transaction management platform operated by{" "}
          <strong>The Sales Progressor Ltd</strong>, a company registered in England and Wales,
          company number <em className="pending">[Company number]</em>, registered office{" "}
          <em className="pending">[Registered office address]</em>.
        </p>
        <p>
          This policy explains how we collect, use, and protect personal data in connection with the
          platform, and the rights you have over your data.
        </p>
        <h3>Two different relationships — please read this part</h3>
        <p>How we handle data depends on whose data it is:</p>
        <ul>
          <li>
            For our <strong>own platform data</strong> — the accounts of estate agency staff who use the
            platform, and our billing records — we are the <strong>data controller</strong>. This
            policy governs that data, and we decide how and why it is processed.
          </li>
          <li>
            For the data an agency enters about <strong>its own clients</strong> — the buyers, sellers,
            and solicitors involved in a property transaction — the{" "}
            <strong>agency is the data controller</strong> and we are the{" "}
            <strong>data processor</strong> acting on the agency&rsquo;s instructions. We process that
            data to provide the platform to the agency; we do not decide how it is used. Buyers and
            sellers with questions about their data should contact the estate agency handling their
            transaction in the first instance (see section 6).
          </li>
        </ul>
        <p>
          If you are unsure which applies to you: if you work for an estate agency and log in to the
          platform, the first relationship applies. If you are a buyer or seller who received a portal
          link from your agency, the second applies.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "2. The data we collect",
    body: (
      <>
        <h3>Agency staff (account holders)</h3>
        <p>
          Name, email address, hashed password, role within the agency, and — for the account that
          manages payment — billing contact details.
        </p>
        <h3>Transaction contacts (buyers, sellers, solicitors)</h3>
        <p>
          Name, email address, phone number, and their role in the transaction. This data is entered
          by the agency, not collected directly from the individual.
        </p>
        <h3>Transaction data</h3>
        <p>
          Property addresses, sale details, milestone progress, notes, and logs of communications
          sent through the platform.
        </p>
        <h3>Portal usage (buyers and sellers)</h3>
        <p>
          Access timestamps, milestone confirmations, and pages viewed within the transaction portal.
        </p>
        <h3>Communications</h3>
        <p>
          Copies of emails and messages sent through the platform are logged for record-keeping.
        </p>
        <h3>Technical and usage data</h3>
        <p>
          When you use the platform, our infrastructure and monitoring providers automatically
          receive limited technical data — including IP address and browser/device information — for
          security, error monitoring, and (only with your consent) analytics. See section 4 and our{" "}
          <a href="/cookie-policy">Cookie Policy</a>.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "3. How we use your data, and our lawful basis",
    body: (
      <>
        <p>
          Under UK GDPR we must have a lawful basis for each way we use personal data. Ours are:
        </p>
        <table>
          <thead>
            <tr>
              <th>What we do</th>
              <th>Whose data</th>
              <th>Lawful basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Provide platform accounts and let agency staff log in and work</td>
              <td>Agency staff</td>
              <td><strong>Contract</strong> — necessary to provide the service you signed up for</td>
            </tr>
            <tr>
              <td>Bill agencies for completed sales and keep billing records</td>
              <td>Agency staff (billing contact)</td>
              <td><strong>Contract</strong>, and <strong>legal obligation</strong> for tax/accounting records</td>
            </tr>
            <tr>
              <td>Process transaction data entered by the agency (tracking sales, sending updates, generating chase messages, providing portal access)</td>
              <td>Buyers, sellers, solicitors</td>
              <td>Processed <strong>on the agency&rsquo;s instructions as their processor</strong>; the agency&rsquo;s own lawful basis applies to this data</td>
            </tr>
            <tr>
              <td>Send essential service and security communications</td>
              <td>Agency staff</td>
              <td><strong>Legitimate interests</strong> — operating the platform securely</td>
            </tr>
            <tr>
              <td>Monitor errors and protect the platform from abuse</td>
              <td>All users</td>
              <td><strong>Legitimate interests</strong> — keeping the service secure and reliable</td>
            </tr>
            <tr>
              <td>Optional product analytics</td>
              <td>All users</td>
              <td><strong>Consent</strong> — only if you accept analytics cookies; you can decline or withdraw at any time</td>
            </tr>
          </tbody>
        </table>
        <p>
          We do <strong>not</strong> use personal data for marketing, profiling, automated
          decision-making with legal effects, or selling to third parties.
        </p>
      </>
    ),
  },
  {
    id: "sub-processors",
    title: "4. Third-party services we use (sub-processors)",
    body: (
      <>
        <p>
          We use a small number of trusted service providers to run the platform. Each processes
          personal data only on our instructions and under a data processing agreement. Where a
          provider is outside the UK, transfers are made under the appropriate safeguard — the
          International Data Transfer Agreement (IDTA) or addendum to the EU Standard Contractual
          Clauses (SCCs), as applicable.
        </p>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>What it does</th>
              <th>Data location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Database hosting and file storage</td>
              <td>EU</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Application hosting and delivery</td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>SendGrid (Twilio)</td>
              <td>Sending transactional and notification email</td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>
                AI-assisted message drafting. Receives the recipient&rsquo;s first name and role, the
                role labels (but not the names) of other transaction parties, the property&rsquo;s
                street line (without postcode), milestone status, and the timing of previous contact.
                Does <strong>not</strong> receive the full names of other parties, postcodes, sale
                prices, email addresses, phone numbers, internal notes, or previous message content.
                Inputs are not used to train Anthropic&rsquo;s models under their commercial API
                terms.
              </td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>
                Payment processing for billing. Card details are handled and stored by Stripe — we
                never see or store full card numbers.
              </td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>Upstash</td>
              <td>Rate limiting and background-task infrastructure</td>
              <td>EU</td>
            </tr>
            <tr>
              <td>PostHog</td>
              <td>
                Product analytics — only when you have consented to analytics cookies. Text is masked
                and session recording is disabled.
              </td>
              <td>EU</td>
            </tr>
            <tr>
              <td>Sentry</td>
              <td>
                Error monitoring. Receives technical error data which may include IP address, browser
                information, and the URL where an error occurred.
              </td>
              <td>EU</td>
            </tr>
          </tbody>
        </table>
        <p>
          We keep this list current as our providers change, and keep our{" "}
          <a href="/cookie-policy">Cookie Policy</a> in step with it.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "5. How long we keep data",
    body: (
      <>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Retention</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Transaction data</td>
              <td>
                Retained for 7 years after the transaction completes or is cancelled, to meet estate
                agency record-keeping obligations under anti-money-laundering regulations and HMRC
                tax-record requirements.
              </td>
            </tr>
            <tr>
              <td>Agency staff account data</td>
              <td>
                Retained while the account is active. Accounts inactive for 3 or more years with no
                open transactions are automatically anonymised — name, email, and phone number are
                replaced with placeholder values.
              </td>
            </tr>
            <tr>
              <td>Portal access</td>
              <td>Portal links expire after the transaction is marked complete.</td>
            </tr>
            <tr>
              <td>Billing records</td>
              <td>Retained as required by tax and accounting law.</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Erasure requests during the retention period.</strong> Where the law requires us to
          retain transaction records (for example, under anti-money-laundering or tax rules), we
          cannot fully delete them on request. In those cases we <strong>anonymise</strong> the
          records instead — names, email addresses, and phone numbers are replaced with placeholder
          values so that no personal identifiers remain. The underlying transaction record stays, in
          anonymised form, for the rest of the legal retention period.
        </p>
        <p>
          To request deletion or anonymisation of your data, email{" "}
          <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a> (see
          section 6).
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "6. Your rights",
    body: (
      <>
        <p>Under UK GDPR you have the right to:</p>
        <ul>
          <li><strong>Access</strong> the personal data we hold about you</li>
          <li><strong>Rectification</strong> — correct data that is inaccurate or incomplete</li>
          <li><strong>Erasure</strong> — ask us to delete your data (&ldquo;right to be forgotten&rdquo;), subject to retention obligations described in section 5</li>
          <li><strong>Restriction</strong> — ask us to limit how we use your data</li>
          <li><strong>Portability</strong> — receive your data in a portable format</li>
          <li><strong>Object</strong> — object to processing based on legitimate interests</li>
          <li>
            <strong>Rights regarding automated decision-making</strong> — we do not carry out
            automated decision-making with legal or similarly significant effects
          </li>
        </ul>
        <p>
          To exercise any of these, email{" "}
          <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>. We
          will respond within one month.
        </p>
        <p>
          <strong>If you are a buyer or seller</strong> whose data was entered by an estate agency:
          that agency is the data controller for your data, so please contact them in the first
          instance. We will support them in responding to your request.
        </p>
        <p>
          You also have the right to complain to the Information Commissioner&rsquo;s Office (ICO) at{" "}
          <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">ico.org.uk</a> —
          though we&rsquo;d appreciate the chance to resolve any concern first.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "7. Cookies",
    body: (
      <>
        <p>
          We use strictly necessary cookies to keep you signed in and the platform secure. With your
          consent, we also use analytics cookies. We ask for your choice when you first visit, you
          can accept or decline, and you can change your mind at any time. If you decline, no
          analytics cookies are set. We do not use advertising cookies and we do not sell your data.
        </p>
        <p>
          Full details are in our <a href="/cookie-policy">Cookie Policy</a>.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "8. Security and data breaches",
    body: (
      <p>
        We protect your data with encryption in transit and at rest, role-based access controls, and
        audit logging. If a personal data breach occurs that is likely to result in a risk to
        people&rsquo;s rights, we will notify the ICO within 72 hours as required by UK GDPR, and
        affected individuals where required.
      </p>
    ),
  },
  {
    id: "children",
    title: "9. Children",
    body: (
      <p>
        The platform is a professional tool for estate agencies and is not intended for use by anyone
        under 18. We do not knowingly collect data about children.
      </p>
    ),
  },
  {
    id: "changes",
    title: "10. Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. When we make material changes, we will update
        the version and date above and, where appropriate, notify account holders. Continued use of
        the platform after an update means you accept the revised policy.
      </p>
    ),
  },
  {
    id: "contact",
    title: "11. Contact",
    body: (
      <>
        <p>
          Questions about this policy or your data:{" "}
          <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>
        </p>
        <p>
          Data controller: The Sales Progressor Ltd, company number{" "}
          <em className="pending">[Company number]</em>, registered office{" "}
          <em className="pending">[Registered office address]</em>.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <PolicyShell
      title="Privacy Policy"
      description="How we collect, use, and protect personal data, and the rights you have over your data."
      lastUpdated="25 May 2026"
      version="1.0"
      sections={SECTIONS}
    />
  );
}
