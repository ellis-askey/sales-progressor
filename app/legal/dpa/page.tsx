// app/legal/dpa/page.tsx
//
// Data Processing Agreement — Version 1.0, published 25 May 2026.
//
// This is a CONTRACT not a policy — it governs the UK GDPR Article 28
// relationship between an estate agency (the Controller) and us
// (the Processor) for the personal data of the agency's clients.
//
// All [COUNSEL TO CONFIRM] flags resolved by Ellis on 2026-05-25 to settled
// positions and stripped from the public render. The drafted clauses
// (Art. 28(3) obligations, general sub-processor authorisation, audit
// balancing for multi-tenant SaaS, Schedule C measures, liability tie-back
// to ToS, no-special-category-data position) are now the operative copy.
// Solicitor will still review the finished contract in full.
//
// Only remaining placeholders on this page (tracked in
// docs/policies/PLACEHOLDERS.md):
//   - [Company number]            — Parties
//   - [Registered office address] — Parties

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Data Processing Agreement — The Sales Progressor",
  description:
    "UK GDPR Article 28 agreement between an estate agency (data controller) and us (data processor).",
};

const SECTIONS: PolicySection[] = [
  {
    id: "parties",
    title: "Parties",
    body: (
      <>
        <p>
          This Data Processing Agreement (&ldquo;DPA&rdquo;) forms part of, and is incorporated
          into, the <Link href="/terms">Terms of Service</Link> between:
        </p>
        <ul>
          <li>
            <strong>The Controller</strong> — the estate agency that uses the Sales Progressor
            platform and enters its clients&rsquo; personal data (&ldquo;you&rdquo;, &ldquo;the
            Agency&rdquo;); and
          </li>
          <li>
            <strong>The Processor</strong> — <strong>The Sales Progressor Ltd</strong>, company
            number [Company number], registered office [Registered office address]
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;).
          </li>
        </ul>
        <p>
          It applies where we process personal data on the Agency&rsquo;s behalf in providing the
          platform. It takes effect when the Agency accepts our Terms of Service.
        </p>
      </>
    ),
  },
  {
    id: "definitions",
    title: "1. Definitions",
    body: (
      <p>
        Terms such as &ldquo;personal data&rdquo;, &ldquo;processing&rdquo;, &ldquo;controller&rdquo;,
        &ldquo;processor&rdquo;, &ldquo;data subject&rdquo;, and &ldquo;personal data breach&rdquo;
        have the meanings given in <strong>UK GDPR</strong> and the{" "}
        <strong>Data Protection Act 2018</strong> (&ldquo;Data Protection Law&rdquo;).
        &ldquo;Sub-processor&rdquo; means any third party we engage to process personal data on the
        Agency&rsquo;s behalf.
      </p>
    ),
  },
  {
    id: "roles",
    title: "2. Roles",
    body: (
      <>
        <p>
          The Agency is the <strong>Controller</strong> of the personal data of its clients (buyers,
          sellers, solicitors, and other transaction parties) that it enters into the platform. We
          are the <strong>Processor</strong> of that data. We process it only to provide the
          platform, and only on the Agency&rsquo;s documented instructions — which include these
          terms, the Terms of Service, and the Agency&rsquo;s use of the platform&rsquo;s features.
        </p>
        <p>
          For our own platform-account and billing data, we are a separate controller — that
          processing is governed by our <Link href="/privacy">Privacy Policy</Link>, not this DPA.
        </p>
      </>
    ),
  },
  {
    id: "our-obligations",
    title: "3. Our obligations as processor",
    body: (
      <>
        <p>We will:</p>
        <ul>
          <li>
            <strong>Process only on your instructions</strong> — and tell you if we believe an
            instruction breaches Data Protection Law, or if we are legally required to process
            beyond your instructions.
          </li>
          <li>
            <strong>Keep data confidential</strong> — ensuring anyone we authorise to process it is
            bound by confidentiality.
          </li>
          <li>
            <strong>Secure the data</strong> — maintaining appropriate technical and organisational
            measures (set out in Schedule C).
          </li>
          <li>
            <strong>Use sub-processors responsibly</strong> — only as permitted in section 5.
          </li>
          <li>
            <strong>Assist you</strong> — with responding to data-subject requests, with security
            and breach obligations, and with any data protection impact assessments, taking into
            account the nature of the processing and the information available to us.
          </li>
          <li>
            <strong>Notify you of breaches</strong> — without undue delay after becoming aware of a
            personal data breach affecting your data, with the information you need to meet your
            own obligations.
          </li>
          <li>
            <strong>Delete or return data</strong> — at the end of our services, delete or return
            the personal data as you choose, except where law requires us to retain it (see Schedule
            A retention).
          </li>
          <li>
            <strong>Demonstrate compliance</strong> — make available the information reasonably
            needed to show we meet these obligations, and allow for audits as set out in section 6.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "your-obligations",
    title: "4. Your obligations as controller",
    body: (
      <>
        <p>You warrant that:</p>
        <ul>
          <li>
            You have a lawful basis and any necessary consents to enter your clients&rsquo; personal
            data into the platform.
          </li>
          <li>
            You have provided your clients with the privacy information Data Protection Law requires
            (including that a processor — us — handles their data on your behalf).
          </li>
          <li>Your instructions to us comply with Data Protection Law.</li>
          <li>
            You will not enter special category personal data (such as data revealing racial or
            ethnic origin, political opinions, religious beliefs, trade-union membership, genetic
            or biometric data, health information, or data concerning sex life or sexual
            orientation) into the platform&rsquo;s free-text or other fields. The platform is not
            designed to process special category data.
          </li>
        </ul>
        <p>
          You are responsible for responding to your clients&rsquo; data-subject requests. Where a
          buyer or seller contacts us directly, we will direct them to you and assist you in
          responding.
        </p>
      </>
    ),
  },
  {
    id: "sub-processors",
    title: "5. Sub-processors",
    body: (
      <>
        <p>
          You give us <strong>general authorisation</strong> to engage sub-processors to help
          provide the platform. Our current sub-processors are listed in Schedule B. We impose data
          protection obligations on each sub-processor substantially equivalent to those in this
          DPA, and we remain responsible for their performance.
        </p>
        <p>
          We will give you reasonable notice of any intended addition or replacement of a
          sub-processor, giving you the opportunity to object on reasonable data protection grounds.
        </p>
      </>
    ),
  },
  {
    id: "audit",
    title: "6. Audit",
    body: (
      <p>
        We will make available to you the information reasonably necessary to demonstrate compliance
        with this DPA, including relevant third-party audit reports or security documentation where
        available. Where you reasonably require further information, we will discuss in good faith
        how to provide appropriate assurance, balancing your audit rights against the security and
        confidentiality of our systems and other customers&rsquo; data.
      </p>
    ),
  },
  {
    id: "international-transfers",
    title: "7. International transfers",
    body: (
      <p>
        Where providing the platform involves transferring personal data outside the UK, we ensure
        an appropriate safeguard is in place — the International Data Transfer Agreement (IDTA) or
        the UK Addendum to the EU Standard Contractual Clauses (SCCs) — as reflected in our
        sub-processor arrangements (Schedule B).
      </p>
    ),
  },
  {
    id: "liability-term",
    title: "8. Liability and term",
    body: (
      <p>
        Our liability under or in connection with this DPA is subject to the same limitations and
        exclusions (including the liability cap and the non-excludable carve-out) as set out in our{" "}
        <Link href="/terms#limitation-of-liability">Terms of Service</Link>. This DPA remains in
        force for as long as we process personal data on your behalf, and the obligations that by
        their nature should survive termination (confidentiality, deletion or return of data, and
        breach cooperation) continue to apply after it ends.
      </p>
    ),
  },
  {
    id: "schedule-a",
    title: "Schedule A — Details of processing",
    body: (
      <table>
        <tbody>
          <tr>
            <th>Subject matter</th>
            <td>Provision of the Sales Progressor property transaction management platform</td>
          </tr>
          <tr>
            <th>Duration</th>
            <td>
              For the term of the Agency&rsquo;s use of the platform, plus retention as set out
              below
            </td>
          </tr>
          <tr>
            <th>Nature and purpose</th>
            <td>
              Tracking residential property transactions; sending progress updates and chase
              communications; providing buyers and sellers with a transaction portal; generating
              AI-assisted message drafts for the Agency&rsquo;s review
            </td>
          </tr>
          <tr>
            <th>Types of personal data</th>
            <td>
              Names, email addresses, phone numbers, and transaction roles of buyers, sellers,
              solicitors, and other transaction parties; property addresses; transaction milestone
              data; communication logs
            </td>
          </tr>
          <tr>
            <th>Categories of data subject</th>
            <td>
              The Agency&rsquo;s clients and their representatives — buyers, sellers, solicitors,
              brokers, and other parties to a transaction
            </td>
          </tr>
          <tr>
            <th>Special category data</th>
            <td>
              None. The platform is not designed to process special category data, and Agencies
              warrant under section 4 that they will not enter it.
            </td>
          </tr>
          <tr>
            <th>Retention</th>
            <td>
              Transaction data retained for 7 years after completion or cancellation (to meet
              estate-agency record-keeping obligations under anti-money-laundering regulations and
              HMRC tax-record requirements); otherwise deleted or returned at the end of services.
              See <Link href="/privacy">Privacy Policy</Link>.
            </td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "schedule-b",
    title: "Schedule B — Sub-processors",
    body: (
      <>
        <p>Current as of 25 May 2026:</p>
        <table>
          <thead>
            <tr>
              <th>Sub-processor</th>
              <th>Purpose</th>
              <th>Location / transfer safeguard</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>Database and file storage</td>
              <td>EU</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>Application hosting</td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>SendGrid (Twilio)</td>
              <td>Transactional email</td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>Anthropic</td>
              <td>
                AI-assisted message drafting (limited data — see Terms{" "}
                <Link href="/terms#ai-features">§5</Link>)
              </td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>Stripe</td>
              <td>Payment processing (Agency billing only)</td>
              <td>US (SCCs + UK IDTA)</td>
            </tr>
            <tr>
              <td>Upstash</td>
              <td>Rate limiting / infrastructure</td>
              <td>EU</td>
            </tr>
            <tr>
              <td>PostHog</td>
              <td>Analytics (consent-gated)</td>
              <td>EU</td>
            </tr>
            <tr>
              <td>Sentry</td>
              <td>Error monitoring</td>
              <td>EU</td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "schedule-c",
    title: "Schedule C — Technical and organisational measures",
    body: (
      <>
        <p>We maintain measures appropriate to the risk, including:</p>
        <ul>
          <li><strong>Encryption</strong> of personal data in transit and at rest</li>
          <li>
            <strong>Access control</strong> — role-based access, least-privilege, authentication
            including two-factor step-up for administrative access
          </li>
          <li><strong>Audit logging</strong> of administrative actions</li>
          <li>
            <strong>Network protection</strong> — rate limiting and abuse protection on
            authentication and public endpoints
          </li>
          <li><strong>Error monitoring</strong> to detect and respond to faults</li>
          <li>
            <strong>Sub-processor diligence</strong> — data protection terms imposed on each
            sub-processor
          </li>
          <li>
            <strong>Breach response</strong> — procedures to detect, investigate, and notify
            personal data breaches
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about this DPA or data processing:{" "}
        <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>
      </p>
    ),
  },
];

export default function DPAPage() {
  return (
    <PolicyShell
      title="Data Processing Agreement"
      description="UK GDPR Article 28 agreement between an estate agency (data controller) and us (data processor)."
      lastUpdated="25 May 2026"
      version="1.0"
      sections={SECTIONS}
      showPdfDownload
    />
  );
}
