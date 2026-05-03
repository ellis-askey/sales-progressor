import Link from "next/link";

export const metadata = { title: "Terms of Service — The Sales Progressor" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-8">
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-700">← Back to login</Link>
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: May 2026</p>

        <div className="prose prose-slate max-w-none space-y-8">

          {/* LEGAL REVIEW REQUIRED — confirm company name, registered address, and legal entity description */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. About this service</h2>
            <p className="text-slate-600 leading-relaxed">The Sales Progressor is a property transaction management platform operated by The Sales Progressor Ltd. It is provided to estate agencies and property professionals to help track, manage, and communicate progress on residential property sales and purchases. The platform is not a conveyancing or legal service.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm account terms are sufficient for the credential/invite model in use */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Access and accounts</h2>
            <p className="text-slate-600 leading-relaxed">Access is granted either by direct registration or by invitation from an existing agency account holder. You are responsible for maintaining the security of your login credentials and must not share them or permit others to use your account.</p>
            <p className="text-slate-600 leading-relaxed mt-3">Portal access links sent to buyers and sellers are unique to each individual and tied to a specific transaction. Recipients should not share or forward these links, as they provide access to personal transaction data.</p>
            <p className="text-slate-600 leading-relaxed mt-3">Agency administrators may deactivate accounts. Inactive accounts are subject to the data retention policy described in our <Link href="/privacy" className="text-blue-600 hover:text-blue-700">Privacy Policy</Link>.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm acceptable use prohibitions are adequate and enforceable */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Acceptable use</h2>
            <p className="text-slate-600 leading-relaxed">The platform may only be used for its intended purpose of residential property transaction management. You agree not to:</p>
            <ul className="list-disc list-inside text-slate-600 leading-relaxed space-y-2 mt-3">
              <li>Send unsolicited, misleading, or abusive communications via the platform</li>
              <li>Attempt to access transaction data belonging to other agencies or individuals</li>
              <li>Transmit harmful content, malware, or material that infringes third-party rights</li>
              <li>Use automated means to extract data from the platform without authorisation</li>
              <li>Interfere with the platform's normal operation or its underlying infrastructure</li>
            </ul>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm the logging disclosure is sufficient as a consent mechanism under UK GDPR */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Data and communications logging</h2>
            <p className="text-slate-600 leading-relaxed">All communications sent through the platform — including chase emails, progress updates, and portal messages — are logged and retained for record-keeping and compliance purposes. Log retention follows the schedule described in our <Link href="/privacy" className="text-blue-600 hover:text-blue-700">Privacy Policy</Link>.</p>
            <p className="text-slate-600 leading-relaxed mt-3">Messages sent to buyers, sellers, or solicitors via the platform are the responsibility of the sending user and their agency. The Sales Progressor Ltd is not responsible for the content of messages composed and sent by platform users.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm AI liability disclaimer is adequate for the use case (draft review before send) */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. AI-assisted features</h2>
            <p className="text-slate-600 leading-relaxed">The platform includes AI-assisted message drafting for chase communications. AI-generated drafts are presented for review before sending — they are not transmitted automatically. You are responsible for reviewing, editing if necessary, and approving any AI-generated content before it is sent to a recipient.</p>
            <p className="text-slate-600 leading-relaxed mt-3">The Sales Progressor Ltd accepts no liability for the accuracy or appropriateness of AI-generated drafts that are sent without adequate review.</p>
            <p className="text-slate-600 leading-relaxed mt-3">AI-assisted drafting is performed using Anthropic's Claude API. No personal data about buyers, sellers, or transactions is included in prompts beyond anonymised role descriptions and milestone names.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm limitation of liability clause is appropriately drafted and enforceable under English law */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Availability and limitation of liability</h2>
            <p className="text-slate-600 leading-relaxed">We aim to maintain reliable service availability but do not guarantee uninterrupted access. The platform is a communication and tracking tool. It does not provide legal, financial, conveyancing, or valuation advice. All decisions made by users based on information in the platform remain their own responsibility and that of their clients.</p>
            <p className="text-slate-600 leading-relaxed mt-3">To the maximum extent permitted by applicable law, The Sales Progressor Ltd shall not be liable for any indirect, incidental, or consequential loss arising from use or unavailability of the platform, including loss of data, lost transactions, or missed deadlines.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm notification mechanism and acceptance clause are adequate */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Changes to these terms</h2>
            <p className="text-slate-600 leading-relaxed">We may update these terms from time to time. We will notify registered account holders of material changes by email before they take effect. Continued use of the platform after notification constitutes acceptance of the updated terms.</p>
          </section>

          {/* LEGAL REVIEW REQUIRED — confirm governing law and jurisdiction clauses are appropriate */}
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">8. Governing law</h2>
            <p className="text-slate-600 leading-relaxed">These terms are governed by the laws of England and Wales. Any disputes arising from use of the platform shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">9. Contact</h2>
            <p className="text-slate-600 leading-relaxed">Questions about these terms: <a href="mailto:hello@thesalesprogressor.co.uk" className="text-blue-600 hover:text-blue-700">hello@thesalesprogressor.co.uk</a></p>
          </section>

        </div>
      </div>
    </div>
  );
}
