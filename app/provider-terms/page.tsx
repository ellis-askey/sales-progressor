// app/provider-terms/page.tsx
//
// Provider Request Service — Terms & Conditions. Consumer-facing (buyers/sellers)
// terms for the surveyor / mortgage-broker / structural-engineer introduction
// flow (app/quote/[token]). Reachable as the right-most tab in the policy nav,
// and linked from the quote request page.
//
// Placeholders remaining (tracked for Ellis, rendered with .pending), matching
// the pattern on the other policy pages:
//   §1 [Company number] + [Registered office address]; §16 [Postal address].
// Everything else (dates, emails, links, windows) is filled.

import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Provider Request Service Terms — The Sales Progressor",
  description: "The terms that apply when you ask to be put in touch with a third-party provider through The Sales Progressor.",
};

const Pending = ({ children }: { children: React.ReactNode }) => <em className="pending">{children}</em>;

type Raw = { id: string; title: string; paras: React.ReactNode[] };

const RAW: Raw[] = [
  {
    id: "who-we-are",
    title: "1. Who we are and what these terms cover",
    paras: [
      "These terms apply when you use the Provider Request Service on The Sales Progressor platform to ask to be put in touch with a third-party service provider.",
      <>The service is operated by <strong>The Sales Progressor Ltd</strong>, a company registered in England and Wales, company number <Pending>[Company number]</Pending>, registered office <Pending>[Registered office address]</Pending> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;, &ldquo;TSP&rdquo;).</>,
      "In these terms, “you” means the buyer or seller using the service in connection with a residential property transaction. “Provider” means an independent third-party firm listed on the service. “Request” means a quote or introduction request you submit.",
      "By submitting a request you accept these terms. If you do not accept them, do not submit a request. Nothing else about your use of the platform depends on it.",
      <>These terms sit alongside our <Link href="/terms">general platform terms</Link> and our <Link href="/privacy">Privacy Policy</Link>. Where they conflict on the subject of provider requests, these terms take priority.</>,
    ],
  },
  {
    id: "what-the-service-does",
    title: "2. What the service does",
    paras: [
      "The service lets you ask to be put in touch with one or more providers in three categories: surveyors, mortgage brokers, and structural engineers.",
      "In outline: you open a secure link for your property; you choose a service type, one or more firms, how and when you would like to be contacted, and how urgent it is; you can add notes. When you submit, we pass your request and details to each firm you selected. That firm then contacts you directly to quote and, if you both agree, to carry out the work.",
      "We keep a record of the status of your request (for example: awaiting contact, booked, completed, not taken forward, expired) so that we can show it to you in your transaction and so that we know when a referral fee is due to us.",
    ],
  },
  {
    id: "our-role",
    title: "3. Our role: introductions only",
    paras: [
      <><strong>We are an introducer only.</strong> We do not carry out surveys, we do not give mortgage advice or arrange mortgages, and we do not provide structural engineering services.</>,
      <><strong>We are not a party to your contract with a provider.</strong> Any service you receive is supplied by that provider under its own terms, and any contract for it is between you and that provider alone. Price, scope, timing, cancellation, complaints and liability for the work are all matters between you and them.</>,
      "Nothing in the service creates any agency, partnership or joint venture between us and any provider, and no provider has authority to make commitments on our behalf.",
      "These terms cover the Provider Request Service only. Any other referral or introduction offered elsewhere on the platform is governed separately.",
    ],
  },
  {
    id: "no-advice",
    title: "4. We do not advise, recommend or endorse",
    paras: [
      "The list of firms shown to you is a list of firms available through the service. It is not a recommendation, endorsement, or statement that any firm is suitable for you.",
      "We do not advise you on which provider to choose, on whether a particular service is one you need, or on the merits of any quote you receive. We do not compare providers for you or rank them by suitability.",
      "The choice of whether to use the service at all, which firms to contact, and whether to engage any of them, is entirely yours.",
    ],
  },
  {
    id: "firm-checks",
    title: "5. Information about firms, and the checks we make",
    paras: [
      <><strong>What we check.</strong> Before we list a firm, we check that it appears on the relevant public register for its profession: RICS for surveyors, the Financial Conduct Authority register for mortgage brokers, and the Institution of Structural Engineers or equivalent for structural engineers.</>,
      <><strong>What that check does not mean.</strong> It is a one-off confirmation that the firm was registered when we listed it. It is not an ongoing check, and it is not an assessment of the firm&rsquo;s competence, its insurance, or the quality of its work. A firm&rsquo;s registration could lapse or be withdrawn after we list it.</>,
      <><strong>What we do not check.</strong> Other details shown in a listing, such as the year a firm was established, its typical turnaround times, or any description of its services, are supplied by the firm itself. We do not verify them and we do not warrant that they are accurate or current. We do not check a firm&rsquo;s professional indemnity insurance.</>,
      <><strong>No endorsement.</strong> Listing a firm, and the check described above, are not a recommendation of that firm or a statement that it is suitable for you.</>,
      "You should satisfy yourself about a provider’s current registration, insurance and terms before engaging it. The registers are public and free to search, including rics.org.uk and register.fca.org.uk.",
    ],
  },
  {
    id: "your-responsibilities",
    title: "6. Your responsibilities",
    paras: [
      "You must give accurate and complete information in your request, including your contact details and the property details. Providers rely on this to quote.",
      "You must only submit requests for a property transaction you are genuinely a party to, and only for your own use.",
      "Once we have made the introduction, you deal with the provider directly. We are not able to negotiate, chase, escalate, or intervene in your dealings with them.",
    ],
  },
  {
    id: "no-obligation",
    title: "7. No obligation, and you are free to shop around",
    paras: [
      "Using the service is entirely optional. You do not have to use it to use the rest of the platform, and nothing in your transaction depends on it.",
      "You are free to obtain quotes from, and engage, any provider you like, whether or not they are listed with us. Given the referral fee described in section 9, we would encourage you to compare quotes from firms outside the service as well.",
      "We do not guarantee that the firms listed offer the best price or the best service available to you.",
    ],
  },
  {
    id: "no-promises",
    title: "8. What we do not promise",
    paras: [
      "We do not guarantee that a provider will contact you, will quote, will be available, or will be willing to take on your work.",
      "We do not guarantee any price, turnaround time, appointment date, or standard of service. Those come from the provider.",
      "We do not guarantee that the service will be available uninterrupted or error-free, and we may change, suspend or withdraw it, or change which firms are listed, at any time.",
    ],
  },
  {
    id: "referral-fees",
    title: "9. Referral fees: how we are paid, and what that means for you",
    paras: [
      <><strong>We are paid by providers.</strong> Where you go on to instruct a provider we introduced you to, that provider pays us a referral fee. The standard fee is 10% of the fee the provider charges you, though it may be agreed differently with individual firms.</>,
      "You pay us nothing directly for the introduction.",
      <><strong>The fee may be reflected in what you are quoted.</strong> Some providers may take the referral fee into account when setting their price, so a quote you receive through this service may not be the same as the quote the same firm would give you if you approached it directly. We do not control what providers charge.</>,
      "We tell you this because we have a financial interest in you instructing a listed firm, and because you should be able to judge a quote knowing that. You are under no obligation to instruct anyone, and you can ask any provider directly what fee it is paying us and whether it has reflected that in your quote.",
      "Nothing in this section affects your freedom to obtain quotes elsewhere (section 7).",
    ],
  },
  {
    id: "mortgage-broker",
    title: "10. Mortgage broker introductions",
    paras: [
      <><strong>We are not authorised or regulated by the Financial Conduct Authority.</strong></>,
      "In relation to mortgage brokers, our role is limited to passing your contact details and the details of your request to the firm or firms you select. We do not give mortgage advice, do not recommend any broker, lender or mortgage product, do not assess what is suitable for you, and do not arrange any mortgage.",
      "We receive a referral fee from the broker if you instruct them, as set out in section 9. We disclose this both to you and to the broker.",
      "All mortgage advice is given by the broker, which is authorised and regulated by the FCA in its own right and is responsible for the advice it gives you. The broker will provide its own disclosure documents, including details of its charges. You can check any firm’s authorisation at register.fca.org.uk.",
    ],
  },
  {
    id: "your-personal-data",
    title: "11. Your personal data",
    paras: [
      "When you submit a request, we share the following with each provider you selected: your name, email address and telephone number, and the property address, postcode, price and tenure where we hold them.",
      "We share this so that the provider can contact you and quote. That is the whole purpose of the request, and we cannot make the introduction without it.",
      <><strong>Each provider is an independent data controller</strong> for the information it receives. Once we have passed your details on, that provider decides how it uses them and is responsible for doing so lawfully. Its own privacy notice applies, and any question about its use of your data (including any request to delete it) should go to that provider.</>,
      <><strong>Retention.</strong> Twelve months after your request reaches a final status (completed, not taken forward, or expired), we anonymise the personal data attached to it. We keep non-personal information, such as postcode area, service type and fee data, for reporting and analytics.</>,
      <>Our full privacy notice, including your rights under UK GDPR and how to exercise them, is at our <Link href="/privacy">Privacy Policy</Link>. If you are not satisfied with how we handle your data you can complain to the Information Commissioner&rsquo;s Office at ico.org.uk.</>,
    ],
  },
  {
    id: "cancelling",
    title: "12. Cancelling or changing a request",
    paras: [
      <>You can cancel or withdraw a request through the platform at any time before you engage a provider. Contact us at <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a> if you cannot do so yourself.</>,
      "Cancelling with us does not undo an introduction that has already been made. A provider that already has your details may still contact you, and you may need to tell it directly to stop.",
      "Once you engage a provider, cancellation is governed by that provider’s terms. Where you contract with a provider away from its premises or entirely online or by phone, you may have a statutory right to cancel within 14 days under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013. The provider must tell you about this, and it can be lost if you ask for work to begin during that period.",
    ],
  },
  {
    id: "complaints",
    title: "13. Complaints",
    paras: [
      <><strong>About a provider&rsquo;s service, quote or conduct:</strong> complain to that provider first, under its own complaints procedure. If you are not satisfied, you may be able to escalate to its regulator or an ombudsman, for example RICS for a regulated surveyor, or the Financial Ombudsman Service for an FCA-regulated mortgage broker. The provider must tell you which applies to it.</>,
      <><strong>About the introduction service itself</strong> (for example how your request was handled, what we listed, or how your data was shared): contact us at <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>. We will acknowledge within 5 working days and respond substantively within 8 weeks.</>,
      "We cannot investigate, arbitrate or resolve a dispute about work carried out by a provider, because we are not a party to it.",
    ],
  },
  {
    id: "liability",
    title: "14. Our liability to you",
    paras: [
      "Nothing in these terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud or fraudulent misrepresentation, or for anything else that cannot lawfully be limited or excluded, including your rights under the Consumer Rights Act 2015.",
      <><strong>We are not liable for providers.</strong> Subject to the paragraph above, we are not responsible for any act or omission of a provider, including any advice or service it gives, any quote, any delay or failure to contact you, any defective or negligent work, or any loss you suffer as a result.</>,
      "Subject to the non-excludable matters above, we are not liable for indirect or consequential loss, loss of profit, loss of opportunity, or losses arising from a property transaction being delayed or falling through.",
      "We are only liable for loss that is a foreseeable result of our breaking these terms or failing to use reasonable care and skill.",
    ],
  },
  {
    id: "changes",
    title: "15. Changes to these terms",
    paras: [
      "We may update these terms. The version that applies to a request is the version in force when you submitted it.",
      "Where a change is material we will tell you before it takes effect.",
    ],
  },
  {
    id: "general",
    title: "16. General",
    paras: [
      <><strong>Entire agreement.</strong> These terms, together with our platform terms and Privacy Policy, are the whole agreement between us about the introduction service.</>,
      <><strong>Severability.</strong> If any provision is held unenforceable, the rest continues in force.</>,
      <><strong>No waiver.</strong> If we do not insist on a right immediately, that does not prevent us from doing so later.</>,
      <><strong>Third parties.</strong> No one other than you and us has any right to enforce these terms.</>,
      <><strong>Governing law and jurisdiction.</strong> These terms are governed by the laws of England and Wales. Disputes may be brought in the courts of England and Wales. If you live in Scotland or Northern Ireland you may also bring proceedings in your local courts.</>,
      <><strong>Contact.</strong> Questions about these terms: <a href="mailto:security@thesalesprogressor.co.uk">security@thesalesprogressor.co.uk</a>. Our postal address is <Pending>[Postal address]</Pending>.</>,
    ],
  },
];

const SECTIONS: PolicySection[] = RAW.map((s) => ({
  id: s.id,
  title: s.title,
  body: <>{s.paras.map((p, i) => <p key={i}>{p}</p>)}</>,
}));

export default function ProviderTermsPage() {
  return (
    <PolicyShell
      title="Provider Request Service Terms"
      description="The terms that apply when you ask to be put in touch with a third-party provider through us."
      lastUpdated="30 August 2026"
      version="1.0"
      sections={SECTIONS}
    />
  );
}
