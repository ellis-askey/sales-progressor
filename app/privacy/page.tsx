import Link from "next/link";

export const metadata = { title: "Privacy Policy — The Sales Progressor" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700">← Back to login</Link>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: May 2026</p>

        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Who we are</h2>
            <p className="text-slate-600 leading-relaxed">The Sales Progressor Ltd operates this platform ("The Sales Progressor"). This policy explains how we collect, use, and protect personal data in connection with the platform. We are the data controller for data held in the platform itself. Estate agencies using the platform are data controllers for their clients' data that they enter.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Data we collect</h2>
            <ul className="list-disc list-inside text-slate-600 leading-relaxed space-y-2">
              <li><strong>Account holders</strong> (agency staff): name, email address, hashed password, role.</li>
              <li><strong>Transaction contacts</strong> (buyers, sellers, solicitors): name, email address, phone number, role in the transaction. This data is entered by the agency, not collected directly from the individuals.</li>
              <li><strong>Transaction data</strong>: property addresses, milestone progress, communication logs, notes.</li>
              <li><strong>Portal usage</strong>: access timestamps, milestone confirmations, pages viewed.</li>
              <li><strong>Communications</strong>: copies of emails and messages sent through the platform are logged.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. How we use it</h2>
            <p className="text-slate-600 leading-relaxed">Data is used to provide the platform's core functions: tracking property transactions, sending progress updates, generating chase communications, and providing buyers and sellers with portal access to their transaction. We do not use personal data for marketing, profiling, or selling to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Third-party services</h2>
            <p className="text-slate-600 leading-relaxed">We use the following third-party services to operate the platform:</p>
            <ul className="list-disc list-inside text-slate-600 leading-relaxed space-y-2 mt-3">
              <li><strong>Supabase / PostgreSQL</strong> — database hosting (EU West region)</li>
              <li><strong>Vercel</strong> — application hosting</li>
              <li><strong>SendGrid (Twilio)</strong> — email delivery for progress updates and portal invites</li>
              <li><strong>Anthropic</strong> — AI message generation (chase message drafts only; no personal data is included in AI prompts beyond role descriptions and milestone names)</li>
              <li><strong>Upstash Redis</strong> — rate limiting counters only; no personal data is stored. Counters are keyed by IP address or an anonymised token identifier and expire automatically.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Data retention</h2>
            <p className="text-slate-600 leading-relaxed">Transaction data is retained for 7 years after completion or cancellation to support compliance with estate agency record-keeping requirements. Account data for agency staff is retained while the account is active. Accounts that have been inactive for 3 or more years with no open transactions are automatically anonymised — all personal identifiers (name, email, phone number) are replaced with placeholder values. Portal access links expire after the transaction is marked complete.</p>
            <p className="text-slate-600 leading-relaxed mt-3">To request early deletion of your data, email <a href="mailto:hello@thesalesprogressor.co.uk" className="text-blue-600 hover:text-blue-700">hello@thesalesprogressor.co.uk</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Your rights</h2>
            <p className="text-slate-600 leading-relaxed">Under UK GDPR you have the right to access, correct, or request deletion of your personal data. Buyers and sellers whose data has been entered by an agency should contact their estate agent in the first instance. Direct requests can be sent to: <a href="mailto:hello@thesalesprogressor.co.uk" className="text-blue-600 hover:text-blue-700">hello@thesalesprogressor.co.uk</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Cookies</h2>
            <p className="text-slate-600 leading-relaxed">The platform uses a session cookie to keep you logged in. No advertising or tracking cookies are used. Portal users may have a browser storage entry saved to remember home-screen install prompt preferences.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Contact and complaints</h2>
            <p className="text-slate-600 leading-relaxed">Privacy questions: <a href="mailto:hello@thesalesprogressor.co.uk" className="text-blue-600 hover:text-blue-700">hello@thesalesprogressor.co.uk</a></p>
            <p className="text-slate-600 leading-relaxed mt-3">You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">ico.org.uk</a>.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
