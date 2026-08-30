// app/provider-terms/page.tsx
//
// Provider Request Service — Terms & Conditions. Consumer-facing (buyers/sellers)
// terms for the provider request / introduction flow (app/quote/[token]).
// Right-most tab in the policy nav; linked from the quote request page.
//
// Placeholders remaining (tracked for Ellis, rendered with .pending), matching
// the pattern on the other policy pages:
//   §1 [Company number] + [Registered office address]; §13 [Postal address].
// Everything else (date, emails, links, windows) is filled.

import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Provider Request Service Terms — The Sales Progressor",
  description: "The terms that apply when you ask to be put in touch with a third-party provider through The Sales Progressor.",
};

const Pending = ({ children }: { children: ReactNode }) => <em className="pending">{children}</em>;

type Raw = { id: string; title: string; paras: ReactNode[] };

const RAW: Raw[] = [
  {
    id: "about",
    title: "1. About these terms",
    paras: [
      "These terms apply when you use the Provider Request Service on The Sales Progressor platform to find or ask to be put in touch with a third-party service provider.",
      <p><>The service is operated by <strong>The Sales Progressor Ltd</strong>, a company registered in England and Wales, company number <Pending>[Company number]</Pending>, registered office <Pending>[Registered office address]</Pending> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;, &ldquo;TSP&rdquo;).</></p>,
      "In these terms:",
      <ul>
        <li>&ldquo;you&rdquo; means the buyer or seller using the service in connection with a residential property transaction;</li>
        <li>&ldquo;Provider&rdquo; means an independent third-party business or professional made available through the service; and</li>
        <li>&ldquo;Request&rdquo; means a request you submit to one or more Providers.</li>
      </ul>,
      "By submitting a Request, you agree to these terms. Using the Provider Request Service is optional and does not affect your ability to use the rest of The Sales Progressor platform.",
      <p>These terms sit alongside our <Link href="/terms">general platform terms</Link> and <Link href="/privacy">Privacy Policy</Link>. If there is any conflict relating specifically to the Provider Request Service, these terms will apply.</p>,
    ],
  },
  {
    id: "how-it-works",
    title: "2. How the Provider Request Service works",
    paras: [
      "The Provider Request Service gives you a simple way to find and contact independent businesses and professionals whose services may be useful in connection with your property transaction.",
      "The types of Providers available may change over time as we add or remove services from the platform.",
      "When making a Request, you may be able to select the type of service you are looking for, choose one or more Providers, provide information about what you need and tell us how you would prefer to be contacted.",
      "When you submit your Request, we pass the relevant details to the Provider or Providers you have selected. They can then contact you directly to discuss your requirements, provide a quote or explain their services.",
      "You are not committed to using a Provider simply because you make a Request.",
      "If you decide to proceed, you will instruct the Provider directly.",
    ],
  },
  {
    id: "our-role",
    title: "3. Our role and the Providers",
    paras: [
      "Providers available through the service are independent third parties. They do not work for TSP and are not acting on our behalf.",
      "We make the introduction, but the service you ultimately receive is provided by the Provider.",
      "If you instruct a Provider, any agreement for their work is between you and the Provider and will be subject to the Provider’s own terms.",
      "This means the Provider is responsible for matters relating to its service, including:",
      <ul>
        <li>its quote and charges;</li>
        <li>the scope of the work;</li>
        <li>appointments and timescales;</li>
        <li>advice it provides;</li>
        <li>carrying out the work;</li>
        <li>cancellation of its service; and</li>
        <li>dealing with any complaint about its work.</li>
      </ul>,
      "Nothing in these terms creates a partnership, joint venture or agency relationship between TSP and a Provider.",
    ],
  },
  {
    id: "choosing-a-provider",
    title: "4. Choosing a Provider",
    paras: [
      "We want the service to make it easier to find businesses and professionals who may be able to help during your property transaction.",
      "Providers may be included because they operate in the relevant area, provide the relevant type of service or have agreed to accept Requests through TSP.",
      "Where appropriate, we may also carry out checks before making a Provider available through the service. The checks we carry out can vary depending on the profession, service and information reasonably available to us.",
      "For example, where a profession is subject to a recognised regulatory or professional register, we may check information available through that register.",
      "These checks are intended to help us decide which Providers we make available through the platform. They are not a guarantee of a Provider’s work, availability, pricing or suitability for every customer.",
      "Information about a Provider and its services may also be supplied by the Provider itself. While we expect Providers to keep this information accurate and up to date, we cannot guarantee that every piece of information will always be complete or current.",
      "You are free to:",
      <ul>
        <li>contact one or several Providers;</li>
        <li>ask for more than one quote;</li>
        <li>use a Provider you already know;</li>
        <li>find a Provider elsewhere; or</li>
        <li>decide not to use a Provider at all.</li>
      </ul>,
      "If you choose to instruct a Provider, you should make sure you are comfortable with its quote, terms and the service being offered before proceeding.",
    ],
  },
  {
    id: "charges",
    title: "5. Charges and referral arrangements",
    paras: [
      "There is no separate charge from TSP to you for using the Provider Request Service.",
      "We may have a commercial arrangement with a Provider and may receive a referral fee, commission or other payment if you choose to use its services.",
      "The arrangements we have with Providers can vary, so the amount or basis of any payment we receive will not necessarily be the same for every Provider or every type of service.",
      "Any payment to TSP is made by the Provider under its arrangement with us. The Provider remains responsible for setting its own prices and explaining any charges that apply to the service you receive.",
      "Where additional information about a referral arrangement or payment is required for a particular type of service, this will be provided as appropriate.",
      "Receiving a referral payment does not affect your freedom to choose whether to use the Provider or to obtain services elsewhere.",
    ],
  },
  {
    id: "mortgage-broker",
    title: "6. Mortgage broker introductions",
    paras: [
      "Additional considerations apply where the Provider you choose is a mortgage broker or other regulated financial-services firm.",
      <p><strong>The Sales Progressor Ltd is not authorised or regulated by the Financial Conduct Authority to provide mortgage advice.</strong></p>,
      "Where we introduce you to a mortgage broker, our role is limited to facilitating the introduction and passing the relevant information to the broker you have chosen.",
      "We do not:",
      <ul>
        <li>provide mortgage advice;</li>
        <li>recommend a particular mortgage product or lender;</li>
        <li>assess whether a mortgage is suitable for you; or</li>
        <li>arrange a mortgage on your behalf.</li>
      </ul>,
      "Any mortgage advice is provided by the mortgage broker, which is responsible for the advice it gives and for complying with its own regulatory obligations.",
      "Where applicable, the broker will provide you with its own regulatory disclosures, terms and information about its charges.",
      "We may receive a referral fee or other payment from a mortgage broker following an introduction. Any disclosure required in connection with that arrangement will be made as appropriate.",
      "You can check whether a mortgage broker is authorised through the Financial Conduct Authority’s public register.",
    ],
  },
  {
    id: "your-information",
    title: "7. Your information and privacy",
    paras: [
      "To make an introduction, we need to share information with the Provider you have selected.",
      "This will include your contact details and may include relevant information about the property or service you are enquiring about.",
      "We only share information reasonably required for the Provider to respond to your Request.",
      "Once your information has been passed to a Provider, that Provider is responsible for how it handles the information it receives in accordance with applicable data-protection law and its own privacy notice.",
      <p>Our <Link href="/privacy">Privacy Policy</Link> explains in more detail:</p>,
      <ul>
        <li>what information TSP collects;</li>
        <li>how and why we use it;</li>
        <li>who we share it with;</li>
        <li>how long we keep it; and</li>
        <li>your rights in relation to your personal information.</li>
      </ul>,
      "By submitting a Request, you are asking us to share the relevant information with the Provider or Providers you have selected so that they can contact you.",
    ],
  },
  {
    id: "availability",
    title: "8. Requests, contact and availability",
    paras: [
      "We will take reasonable steps to pass your Request to the Provider or Providers you select.",
      "However, submitting a Request does not guarantee that a Provider will:",
      <ul>
        <li>contact you within a particular period;</li>
        <li>be available;</li>
        <li>provide a quote;</li>
        <li>accept the work; or</li>
        <li>be able to meet a particular deadline.</li>
      </ul>,
      "Any prices, turnaround times, appointments or availability provided by a Provider are matters for that Provider.",
      "If you decide to instruct a Provider, you should confirm the scope, price and timing of the work directly with them.",
      "We may add or remove Providers or types of service from the platform from time to time.",
    ],
  },
  {
    id: "cancelling",
    title: "9. Changing or cancelling a Request",
    paras: [
      <p>You can withdraw a Request through the platform where that option is available, or contact us at <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a> if you need help.</p>,
      "If your details have already been passed to a Provider, withdrawing the Request from TSP cannot recall information the Provider has already received. You may therefore also need to tell the Provider that you no longer wish to be contacted.",
      "Once you have instructed a Provider, any cancellation of its services is dealt with under your agreement with that Provider and any cancellation rights that apply by law.",
      "Depending on how and where you enter into the agreement, consumer cancellation rights may apply. The Provider is responsible for giving you the information about those rights that it is legally required to provide.",
    ],
  },
  {
    id: "complaints",
    title: "10. If something goes wrong",
    paras: [
      <p>We want the Provider Request Service itself to work properly. If you have a problem with how a Request was handled through TSP, or with information displayed through the service, please contact us at <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>.</p>,
      "If your concern relates to the service or work provided by a Provider, you should raise it with the Provider directly in the first instance.",
      "Providers may have their own complaints procedures and, depending on the type of Provider, you may also have access to a professional body, regulator, redress scheme or ombudsman.",
      "Where appropriate, the Provider should be able to explain which complaints or redress arrangements apply to its service.",
      "Although we may help you identify who to contact, TSP is not a party to the agreement between you and the Provider and cannot determine the outcome of a dispute about the Provider’s work or advice.",
    ],
  },
  {
    id: "responsibility",
    title: "11. Our responsibility",
    paras: [
      "We are responsible for providing the Provider Request Service with reasonable care and skill.",
      "Providers are responsible for the services they provide to you.",
      "Subject to your rights under applicable law, TSP is therefore not responsible for the acts or omissions of an independent Provider, including:",
      <ul>
        <li>advice provided by the Provider;</li>
        <li>the quality or standard of its work;</li>
        <li>its prices or quotations;</li>
        <li>delays or availability;</li>
        <li>its failure to contact you; or</li>
        <li>its failure to perform an agreement you have entered into with it.</li>
      </ul>,
      "We are not responsible for losses caused by circumstances outside our reasonable control or for losses that were not reasonably foreseeable when you used the Provider Request Service.",
      "We are also not responsible for indirect or consequential business losses, including loss of profit or opportunity.",
      "Nothing in these terms excludes or limits liability where it would be unlawful to do so. This includes liability for death or personal injury caused by our negligence, fraud or fraudulent misrepresentation, or any consumer rights that cannot legally be excluded or limited.",
    ],
  },
  {
    id: "changes",
    title: "12. Changes to the service or these terms",
    paras: [
      "We may update the Provider Request Service as it develops, including by adding or removing Provider categories, changing how Requests work or changing which Providers are available.",
      "We may also update these terms from time to time.",
      "The version that applies to a Request will normally be the version in force when that Request was submitted.",
      "Where a change materially affects your rights in relation to an existing Request, we will provide any notice required by law.",
    ],
  },
  {
    id: "general",
    title: "13. General",
    paras: [
      "If any part of these terms is found to be unenforceable, the remaining terms will continue to apply.",
      "If we do not enforce a right immediately, that does not mean we have given up that right.",
      "No person other than you and TSP has a right to enforce these terms.",
      "These terms are governed by the laws of England and Wales.",
      "If you live in England or Wales, disputes may be brought in the courts of England and Wales. If you live in Scotland or Northern Ireland, you may also be entitled to bring proceedings in your local courts.",
      "These Provider Request Service Terms, together with the relevant provisions of our general platform terms and Privacy Policy, form the agreement between you and us relating to your use of this service.",
      <p>Questions about the Provider Request Service or these terms can be sent to <a href="mailto:support@thesalesprogressor.co.uk">support@thesalesprogressor.co.uk</a>.</p>,
      <p>Our postal address is: <Pending>[Postal address]</Pending></p>,
    ],
  },
];

const SECTIONS: PolicySection[] = RAW.map((s) => ({
  id: s.id,
  title: s.title,
  body: <>{s.paras.map((p, i) => (typeof p === "string" ? <p key={i}>{p}</p> : <Fragment key={i}>{p}</Fragment>))}</>,
}));

export default function ProviderTermsPage() {
  return (
    <PolicyShell
      title="Provider Request Service Terms"
      description="The terms that apply when you ask to be put in touch with a third-party provider through The Sales Progressor."
      lastUpdated="30 August 2026"
      version="1.0"
      sections={SECTIONS}
    />
  );
}
