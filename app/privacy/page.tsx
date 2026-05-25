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

          {/* LEGAL REVIEW REQUIRED — confirm data controller vs data processor distinction; verify company name and registered details */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Who we are</h2>
            <p className="text-slate-600 leading-relaxed">The Sales Progressor Ltd operates this platform ("The Sales Progressor"). This policy explains how we collect, use, and protect personal data in connection with the platform. We are the data controller for data held in the platform itself. Estate agencies using the platform are data controllers for their clients' data that they enter.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm data inventory is complete; verify no additional categories are collected (e.g. IP addresses, device data) */}
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

          {/* LEGAL REVIEW REQUIRED — lawful basis for processing not stated; UK GDPR requires identifying the legal basis (contract, legitimate interest, consent, etc.) for each processing activity */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. How we use it</h2>
            <p className="text-slate-600 leading-relaxed">Data is used to provide the platform's core functions: tracking property transactions, sending progress updates, generating chase communications, and providing buyers and sellers with portal access to their transaction. We do not use personal data for marketing, profiling, or selling to third parties.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm data processing agreements (DPAs) exist with each listed sub-processor; verify region accuracy for each service */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Third-party services we use</h2>
            <p className="text-slate-600 leading-relaxed">We use a small number of trusted service providers (sub-processors) to run the platform. Each processes personal data only on our instructions and under a data processing agreement. They are:</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm border border-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left font-semibold text-slate-700 px-3 py-2 border-b border-slate-200">Provider</th>
                    <th className="text-left font-semibold text-slate-700 px-3 py-2 border-b border-slate-200">What it does</th>
                    <th className="text-left font-semibold text-slate-700 px-3 py-2 border-b border-slate-200">Data location</th>
                  </tr>
                </thead>
                <tbody className="text-slate-600">
                  <tr className="border-b border-slate-100"><td className="px-3 py-2 font-medium">Supabase</td><td className="px-3 py-2">Database hosting and file storage</td><td className="px-3 py-2">EU</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2 font-medium">Vercel</td><td className="px-3 py-2">Application hosting and delivery</td><td className="px-3 py-2">EU / global edge</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2 font-medium">SendGrid (Twilio)</td><td className="px-3 py-2">Sending transactional and notification email</td><td className="px-3 py-2">EU / US under standard safeguards</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2 font-medium">Anthropic</td><td className="px-3 py-2">Powers AI-assisted features, such as drafting chase messages</td><td className="px-3 py-2">US under standard safeguards</td></tr>
                  <tr className="border-b border-slate-100"><td className="px-3 py-2 font-medium">Upstash</td><td className="px-3 py-2">Rate limiting and background-task infrastructure</td><td className="px-3 py-2">EU</td></tr>
                  <tr><td className="px-3 py-2 font-medium">PostHog</td><td className="px-3 py-2">Product analytics — only when you have consented to analytics cookies. Text is masked and session recording is disabled.</td><td className="px-3 py-2">EU</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-slate-600 leading-relaxed mt-3">We review this list as our providers change and keep our cookie policy and this page in step with it.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm 7-year transaction retention period is correct for estate agency compliance; confirm 3-year inactivity threshold is defensible; check whether anonymisation constitutes erasure under UK GDPR */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Data retention</h2>
            <p className="text-slate-600 leading-relaxed">Transaction data is retained for 7 years after completion or cancellation to support compliance with estate agency record-keeping requirements. Account data for agency staff is retained while the account is active. Accounts that have been inactive for 3 or more years with no open transactions are automatically anonymised — all personal identifiers (name, email, phone number) are replaced with placeholder values. Portal access links expire after the transaction is marked complete.</p>
            <p className="text-slate-600 leading-relaxed mt-3">To request early deletion of your data, email <a href="mailto:support@thesalesprogressor.co.uk" className="text-blue-600 hover:text-blue-700">support@thesalesprogressor.co.uk</a>.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm all UK GDPR data subject rights are listed (access, rectification, erasure, restriction, portability, objection, automated decision-making); verify complaint escalation path is accurate */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Your rights</h2>
            <p className="text-slate-600 leading-relaxed">Under UK GDPR you have the right to access, correct, or request deletion of your personal data. Buyers and sellers whose data has been entered by an agency should contact their estate agent in the first instance. Direct requests can be sent to: <a href="mailto:support@thesalesprogressor.co.uk" className="text-blue-600 hover:text-blue-700">support@thesalesprogressor.co.uk</a></p>
          </section>

          {/* LEGAL REVIEW REQUIRED — verify cookie disclosure matches the actual cookies set; confirm PECR compliance for any analytics cookies */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Cookies</h2>
            <p className="text-slate-600 leading-relaxed">We use strictly necessary cookies to keep you signed in and to keep the platform secure — your session token, a security (CSRF) token, and a cookie that remembers your cookie choice. These are required for the platform to work and do not need your consent.</p>
            <p className="text-slate-600 leading-relaxed mt-3">With your consent, we also use analytics cookies from PostHog to understand how the platform is used so we can improve it. We ask for this when you first visit, and you can accept or decline. You can change your choice at any time using the &ldquo;Reset preferences&rdquo; option on our cookie policy page. If you decline, no analytics cookies are set.</p>
            <p className="text-slate-600 leading-relaxed mt-3">We do not use advertising cookies, and we do not sell your data.</p>
            <p className="text-slate-600 leading-relaxed mt-3">A full list of the individual cookies we use is in our <Link href="/cookie-policy" className="text-blue-600 hover:text-blue-700">Cookie Policy</Link>.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm ICO registration is in place; verify contact details are current */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Contact and complaints</h2>
            <p className="text-slate-600 leading-relaxed">Privacy questions: <a href="mailto:support@thesalesprogressor.co.uk" className="text-blue-600 hover:text-blue-700">support@thesalesprogressor.co.uk</a></p>
            <p className="text-slate-600 leading-relaxed mt-3">You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">ico.org.uk</a>.</p>
          </section>

        </div>
      </div>
    </div>
  );
}
