// app/progression-business-terms/page.tsx
//
// Sales Progression Business Terms of Service. B2B terms for an independent
// sales progression business that uses the TSP platform to provide its OWN
// progression service to its own client agencies (distinct from the Outsourced
// Terms, where an agency instructs TSP to do the progressing).
//
// Same structure as the sibling policy pages: a RAW section list mapped into
// PolicyShell. Entity identification matches the other legal pages
// (The Sales Progressor Ltd, company number 17455131, registered office
// 5 Hercules Way, Leavesden Park, Watford WD25 7GS, United Kingdom).

import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Sales Progression Business Terms — The Sales Progressor",
  description:
    "These Terms and Conditions govern the use of The Sales Progressor platform by independent sales progression businesses providing services to their own client agencies.",
};

type Raw = { id: string; title: string; paras: ReactNode[] };

const RAW: Raw[] = [
  {
    id: "introduction",
    title: "Introduction",
    paras: [
      <p>These Sales Progression Business Terms of Service (&ldquo;Terms&rdquo;) govern the use of The Sales Progressor platform by independent sales progression businesses providing services to their own client agencies.</p>,
      <p>The Sales Progressor is operated by <strong>The Sales Progressor Ltd</strong>, a company registered in England and Wales under company number 17455131, whose registered office is at 5 Hercules Way, Leavesden Park, Watford WD25 7GS, United Kingdom (&ldquo;TSP&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;).</p>,
      "By registering for a sales progression business account, providing payment details or using the Platform to manage transactions on behalf of a client agency, you acknowledge and agree to be bound by these Terms.",
      <p>These Terms should be read in conjunction with our <Link href="/terms">General Terms of Service</Link>, <Link href="/billing-terms">Billing Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/legal/dpa">Data Processing Agreement</Link>. In the event of any inconsistency concerning the use of the Platform by a sales progression business, these Terms shall take precedence.</p>,
      <p>These Terms are separate from our <Link href="/outsourced-terms">Outsourced Sales Progression Terms</Link>, which apply where an estate agency instructs TSP to provide managed sales progression services. These Terms apply exclusively where an independent business uses our software to provide sales progression services to its own clients.</p>,
    ],
  },
  {
    id: "definitions",
    title: "1. Definitions and Application",
    paras: [
      "For the purposes of these Terms:",
      <ul>
        <li><strong>Business</strong> means the independent sales progression business, whether operating as a sole trader, partnership or company, registered to use the Platform to provide sales progression services to its clients.</li>
        <li><strong>Client Agency</strong> means an estate agency for which the Business provides sales progression services and which has been added to the Business&rsquo;s account.</li>
        <li><strong>End Client</strong> means a buyer, seller or other individual involved in a property transaction managed by the Business.</li>
        <li><strong>Platform</strong> means the software, applications, client portals, communication tools and associated services provided by TSP.</li>
        <li><strong>Team Member</strong> means any individual authorised by the Business to access the Platform under its account.</li>
      </ul>,
      "These Terms establish a contractual relationship solely between TSP and the Business. They do not establish a separate contractual relationship between TSP and any Client Agency or End Client.",
    ],
  },
  {
    id: "provision",
    title: "2. Provision of the Platform",
    paras: [
      "TSP provides a software platform designed to support the management and administration of residential property sales progression.",
      "The Platform enables the Business to manage transactions, monitor milestones, communicate with relevant parties, automate certain administrative activities and provide Client Agencies and End Clients with access to transaction information.",
      "The Platform is provided as a software service. TSP does not undertake the sales progression activities managed by the Business, nor does the Business's use of the Platform constitute the appointment of TSP as a sales progressor.",
      "Subject to compliance with these Terms and payment of all applicable fees, TSP grants the Business a limited, non-exclusive, non-transferable licence to access and use the Platform for the provision of sales progression services to its Client Agencies.",
      "TSP reserves the right to develop, modify, enhance or discontinue features of the Platform. Where any material change substantially affects a core service, we will take reasonable steps to provide advance notice.",
    ],
  },
  {
    id: "role",
    title: "3. Role and Limitations of TSP",
    paras: [
      "TSP's responsibility is limited to the provision, operation and maintenance of the Platform in accordance with these Terms.",
      "TSP does not act as the appointed sales progressor in respect of transactions managed independently by the Business.",
      "Furthermore, TSP does not act as a solicitor, licensed conveyancer, mortgage adviser, surveyor, valuer, tax adviser or other regulated professional adviser.",
      "Accordingly, TSP does not:",
      <ul>
        <li>Undertake sales progression activities on behalf of the Business.</li>
        <li>Direct, supervise or assume responsibility for the services provided by the Business.</li>
        <li>Independently verify information supplied by the Business, its Client Agencies, End Clients or other transaction participants.</li>
        <li>Provide legal, financial, mortgage, taxation, surveying or other regulated professional advice.</li>
        <li>Guarantee that any property transaction will proceed to exchange or completion.</li>
      </ul>,
      "The Business retains full responsibility for the services it provides and for the management of its own client relationships.",
    ],
  },
  {
    id: "account",
    title: "4. Account Management and Authorised Users",
    paras: [
      "The Business is responsible for maintaining the security and appropriate use of its account.",
      "The account holder may authorise additional Team Members to access the Platform, subject to the applicable subscription charges.",
      "The Business shall be responsible for:",
      <ul>
        <li>All activities undertaken through its account, including those carried out by authorised Team Members.</li>
        <li>Ensuring that Team Members have appropriate authority to access and manage the information available to them.</li>
        <li>Assigning suitable access permissions and maintaining appropriate restrictions on file visibility.</li>
        <li>Promptly removing or restricting access when a Team Member ceases to be authorised.</li>
        <li>Maintaining the confidentiality and security of account credentials.</li>
      </ul>,
      "The Business must notify TSP without undue delay upon becoming aware of any suspected unauthorised access, account compromise or security incident affecting its use of the Platform.",
    ],
  },
  {
    id: "client-agencies",
    title: "5. Client Agencies and End Clients",
    paras: [
      "The Business may register and manage its own Client Agencies through the Platform.",
      "The Business remains solely responsible for establishing and maintaining its commercial relationships with those agencies, including agreeing the scope, standard and pricing of its sales progression services.",
      "By adding a Client Agency or managing transactions on its behalf, the Business confirms that it:",
      <ul>
        <li>Has obtained the necessary authority to act on behalf of that Client Agency.</li>
        <li>Is authorised to register the Client Agency, its representatives and relevant transactions on the Platform.</li>
        <li>Has the necessary authority and lawful basis to provide and process personal information relating to Client Agencies and End Clients.</li>
        <li>Will provide appropriate information to relevant individuals concerning the processing of their personal data, as required by applicable data protection legislation.</li>
      </ul>,
      "TSP is not a party to any agreement between the Business and its Client Agencies and accepts no responsibility for the commercial terms, fees or contractual obligations arising from those relationships.",
    ],
  },
  {
    id: "responsibilities",
    title: "6. Responsibilities of the Business",
    paras: [
      "The Business is responsible for the professional delivery and management of its sales progression services.",
      "This includes responsibility for:",
      <ul>
        <li>Conducting sales progression activities with reasonable care, skill and professional judgement.</li>
        <li>Ensuring that information entered into the Platform is accurate, appropriate and kept reasonably up to date.</li>
        <li>Managing communications with Client Agencies, End Clients, solicitors, conveyancers and other transaction participants.</li>
        <li>Complying with all applicable legal, regulatory and professional obligations.</li>
        <li>Addressing complaints, disputes or concerns arising from the services provided to its clients.</li>
        <li>Ensuring that its use of the Platform and the services it provides comply with applicable law.</li>
      </ul>,
      "Use of the Platform does not transfer any professional, contractual or statutory obligations of the Business to TSP.",
      "TSP does not supervise or assume responsibility for the progression activities undertaken by the Business.",
    ],
  },
  {
    id: "acceptable-use",
    title: "7. Acceptable Use",
    paras: [
      "The Platform must be used solely for lawful and legitimate purposes connected with the provision of sales progression services.",
      "The Business must not:",
      <ul>
        <li>Use the Platform for any unlawful, fraudulent, deceptive or misleading activity.</li>
        <li>Upload, disclose or process information without the necessary rights, permissions or lawful basis.</li>
        <li>Attempt to access information belonging to another business, agency or individual without authorisation.</li>
        <li>Interfere with, circumvent, test or compromise the security or integrity of the Platform.</li>
        <li>Reproduce, distribute, resell, sublicense or commercially exploit the Platform except as expressly permitted under these Terms.</li>
        <li>Use the Platform to distribute unlawful, abusive, unsolicited or otherwise prohibited communications.</li>
        <li>Use unauthorised automated processes to extract, collect or reproduce information from the Platform.</li>
      </ul>,
      "TSP reserves the right to take proportionate action where it reasonably believes that these requirements have been breached or that continued use may compromise the security, integrity or lawful operation of the Platform.",
    ],
  },
  {
    id: "automated-features",
    title: "8. Automated Features and Artificial Intelligence",
    paras: [
      "The Platform incorporates automated functionality, including transaction reminders, scheduled follow-ups, communication tools, drafted correspondence and features supported by artificial intelligence.",
      "These functions are intended to assist the Business in carrying out its administrative and sales progression activities.",
      "Automated functionality does not replace the professional judgement, oversight or responsibilities of the Business.",
      "TSP will use reasonable efforts to operate automated communications and notifications reliably. However, we cannot guarantee the successful transmission, receipt or delivery of any particular communication.",
      "Delivery may be affected by circumstances including technical faults, third-party service interruptions, inaccurate contact information, spam filtering or other factors beyond our reasonable control.",
      "The Business remains responsible for reviewing the suitability and accuracy of communications issued on its behalf, including any content generated or assisted by artificial intelligence.",
      "Automated or AI-generated information must not be relied upon as legal, financial or other regulated professional advice.",
    ],
  },
  {
    id: "availability",
    title: "9. Platform Availability",
    paras: [
      "TSP will use reasonable efforts to maintain the availability, functionality and security of the Platform.",
      "However, continuous, uninterrupted or error-free access cannot be guaranteed.",
      "We may undertake scheduled or unscheduled maintenance, updates or technical improvements where reasonably necessary. We will seek to minimise disruption wherever practicable.",
      "TSP shall not be responsible for delays or failures arising from circumstances beyond its reasonable control, including telecommunications failures, third-party service outages, cyber incidents, severe weather, industrial action, public emergencies or other events materially affecting the provision of the Platform.",
      "Where such circumstances arise, we will take reasonable steps to restore normal service as soon as reasonably practicable.",
    ],
  },
  {
    id: "fees",
    title: "10. Fees and Charges",
    paras: [
      "Unless alternative pricing has been expressly agreed in writing, the following charges apply to the Business's use of the Platform:",
      <ul>
        <li><strong>£59 per month</strong> for the Business&rsquo;s primary account holder.</li>
        <li><strong>£39 per month</strong> for each additional active Team Member.</li>
        <li><strong>£5 per sale</strong> added to the Platform for progression.</li>
      </ul>,
      "Where an existing transaction is imported or added after progression has already commenced, the £5 transaction charge shall become payable only upon exchange of contracts, rather than at the time the transaction is added.",
      "TSP is not currently registered for VAT. Accordingly, the charges stated above represent the total amounts payable.",
      "Should TSP become VAT-registered, VAT will be applied where required by law and in accordance with our Billing Terms. The Business will be notified of any applicable changes.",
      "Any bespoke, promotional, legacy or individually negotiated pricing arrangements confirmed in writing by TSP shall take precedence over the standard charges stated in this section.",
    ],
  },
  {
    id: "payment",
    title: "11. Payment and Billing",
    paras: [
      "The Business must maintain a valid payment card on file in order to add and manage sales through the Platform.",
      "Payments are collected automatically in accordance with the following billing arrangements.",
      <h3>Initial payment</h3>,
      "Upon registering a payment card, the Business will be charged a proportionate amount covering the remaining period of the current calendar month.",
      "The applicable amount will be displayed before payment is confirmed.",
      <h3>Recurring payments</h3>,
      "On the first day of each subsequent calendar month, TSP will collect:",
      <ul>
        <li>The £59 monthly account subscription.</li>
        <li>The applicable £39 monthly charge for each additional Team Member.</li>
        <li>Any £5 transaction charges accrued during the preceding month.</li>
      </ul>,
      "Charges arising from the addition of Team Members or transactions during a billing period will be included in the next applicable monthly collection.",
      "Payments are processed securely through our appointed payment provider.",
      <p>Further provisions concerning payment processing and billing are set out in our <Link href="/billing-terms">Billing Terms</Link>. Where those provisions conflict with the specific pricing or billing arrangements described in these Terms, the provisions of these Terms shall prevail.</p>,
    ],
  },
  {
    id: "failed-payments",
    title: "12. Failed Payments",
    paras: [
      "Where a payment cannot be collected successfully, TSP will notify the Business and may make further attempts to collect the outstanding amount.",
      <p>A grace period of <strong>seven days</strong> will apply from the date of the initial failed payment.</p>,
      "During this period, the Business will retain normal access to the Platform while payment is retried.",
      "If the outstanding amount remains unpaid following the expiry of the grace period, TSP may temporarily restrict the Business's ability to register additional sales.",
      "Existing transactions will remain accessible and operational during the resolution of the payment issue, allowing the Business to continue managing sales already in progress.",
      "The restriction on adding new transactions will be removed once the outstanding balance has been settled and valid payment details are available.",
    ],
  },
  {
    id: "cancellation",
    title: "13. Cancellation",
    paras: [
      "The Business may cancel its subscription at any time through the billing settings within its account.",
      "Upon cancellation:",
      <ul>
        <li>Any accrued but unbilled transaction charges will become immediately payable and will be collected using the payment card held on file.</li>
        <li>Recurring account and Team Member subscription charges will cease at the end of the current paid billing period.</li>
        <li>The Business will retain access to the Platform until the expiry of that paid period.</li>
        <li>No further recurring subscription charges will be collected following the effective cancellation date.</li>
      </ul>,
      "Cancellation does not release the Business from any payment obligations accrued before cancellation.",
      "The Business remains responsible for its Client Agencies and any transactions that remain active, including making suitable arrangements for the continuation of progression services following the termination of access.",
    ],
  },
  {
    id: "data-protection",
    title: "14. Data Protection",
    paras: [
      "Both TSP and the Business shall comply with applicable UK data protection legislation, including the UK General Data Protection Regulation and the Data Protection Act 2018.",
      "In a typical sales progression arrangement, the parties' respective roles are:",
      <ul>
        <li><strong>Client Agency:</strong> Data Controller, determining the purposes and means of processing personal information relating to its clients.</li>
        <li><strong>Business:</strong> Data Processor, processing personal information on behalf of the Client Agency in connection with the provision of sales progression services.</li>
        <li><strong>TSP:</strong> Sub-processor, providing the software infrastructure and associated services used by the Business to process that information.</li>
      </ul>,
      <p>TSP will process personal information in accordance with documented instructions, these Terms, our <Link href="/legal/dpa">Data Processing Agreement</Link> and applicable data protection legislation.</p>,
      "The Business is responsible for ensuring that it has obtained all necessary permissions, authority and lawful grounds to process personal information through the Platform and to appoint TSP as a sub-processor.",
      "The Business shall remain responsible for managing data subject requests, complaints and related obligations arising from its client relationships.",
      "TSP will provide reasonable assistance where such requests concern personal information processed or stored within the Platform, in accordance with our Data Processing Agreement.",
    ],
  },
  {
    id: "confidentiality",
    title: "15. Confidentiality",
    paras: [
      "Each party acknowledges that it may receive or have access to confidential information belonging to the other party.",
      "TSP will use confidential information and data processed through the Platform only to the extent reasonably necessary to provide, maintain and support its services, comply with legal obligations or otherwise act in accordance with these Terms and our Data Processing Agreement.",
      "The Business shall maintain the confidentiality of its account credentials and any non-public technical, commercial or operational information relating to the Platform.",
      "Both parties shall take reasonable steps to prevent unauthorised disclosure of confidential information.",
    ],
  },
  {
    id: "intellectual-property",
    title: "16. Intellectual Property Rights",
    paras: [
      "All intellectual property rights in the Platform, including its software, functionality, design, content, trademarks and branding, remain the property of TSP or its respective licensors.",
      "Nothing in these Terms transfers ownership of any intellectual property rights to the Business.",
      "The Business is granted only the limited right to access and use the Platform in accordance with these Terms.",
      "Information and data uploaded or provided by the Business and its clients remain the property of their respective owners.",
      "The Business grants TSP the permissions reasonably necessary to host, store, process and otherwise handle such information for the purpose of providing the Platform and its associated services.",
      "Where the Business uploads or applies branding belonging to a Client Agency, it confirms that it has the necessary authority to use that branding for the relevant purpose.",
    ],
  },
  {
    id: "liability",
    title: "17. Liability and Limitations",
    paras: [
      "TSP will provide the Platform with reasonable care and skill.",
      "However, TSP shall not be responsible for losses arising from circumstances outside its reasonable control or from activities for which the Business or other transaction participants are responsible.",
      "Such circumstances include, without limitation:",
      <ul>
        <li>The performance, conduct or omission of the Business in delivering its sales progression services.</li>
        <li>Acts or omissions of solicitors, conveyancers, lenders, surveyors or other third parties.</li>
        <li>The withdrawal, collapse or failure of a property transaction to reach exchange or completion.</li>
        <li>Delays to anticipated exchange or completion dates.</li>
        <li>Inaccurate, incomplete or misleading information supplied by the Business, Client Agencies, End Clients or other parties.</li>
        <li>Decisions made by Client Agencies, End Clients or other transaction participants.</li>
        <li>Interruptions or failures arising from circumstances described in Section 9.</li>
      </ul>,
      "To the fullest extent permitted by applicable law, TSP shall not be liable for indirect or consequential losses, loss of profit, loss of business, loss of commercial opportunity or losses that were not reasonably foreseeable.",
      "Subject to any liability that cannot lawfully be excluded or restricted, TSP's total aggregate liability arising under or in connection with these Terms shall not exceed the total fees paid or payable by the Business to TSP during the 12 months immediately preceding the event giving rise to the relevant claim.",
      "Nothing in these Terms shall exclude or limit liability where such exclusion or limitation is prohibited by law.",
    ],
  },
  {
    id: "suspension",
    title: "18. Suspension or Restriction of Access",
    paras: [
      "TSP reserves the right to suspend, restrict or otherwise limit access to the Platform where:",
      <ul>
        <li>Fees properly due remain unpaid following the applicable grace period.</li>
        <li>The Business has breached, or is reasonably suspected of breaching, the acceptable use requirements.</li>
        <li>Continued access presents a material legal, regulatory, security or reputational risk.</li>
        <li>Suspension or restriction is required by applicable law or a competent authority.</li>
      </ul>,
      "Where reasonably practicable, TSP will provide notice before implementing a suspension or restriction.",
      "Any action taken will be proportionate to the circumstances and limited to what TSP reasonably considers necessary.",
      "Where appropriate, access will be restored once the underlying issue has been satisfactorily resolved.",
    ],
  },
  {
    id: "termination",
    title: "19. Termination",
    paras: [
      "The Business may terminate its use of the Platform by cancelling its subscription in accordance with Section 13.",
      "Either party may terminate these Terms where the other party commits a material breach and fails to remedy that breach within a reasonable period following written notice.",
      "Termination may also occur where required by applicable law.",
      "Upon termination:",
      <ul>
        <li>The Business shall remain responsible for its Client Agencies and any ongoing transactions.</li>
        <li>The Business shall make appropriate arrangements for the continued management of active sales following the termination of access.</li>
        <li>Any outstanding fees or charges accrued before termination shall remain payable.</li>
        <li>Obligations relating to confidentiality, data protection and any other provisions intended to survive termination shall continue to apply.</li>
      </ul>,
      "Following termination, personal information held within the Platform will be handled in accordance with our Data Processing Agreement and applicable data protection legislation.",
    ],
  },
  {
    id: "amendments",
    title: "20. Amendments to These Terms",
    paras: [
      "TSP may amend these Terms from time to time to reflect changes in legislation, regulatory requirements, business operations or the functionality and provision of the Platform.",
      "The current version of these Terms will be identified by its effective date and version number.",
      "Where an amendment materially affects the Business's existing contractual relationship with TSP, we will take reasonable steps to provide appropriate notice.",
    ],
  },
  {
    id: "relationship-other-terms",
    title: "21. Relationship with Other Terms",
    paras: [
      "These Terms govern the Business's use of the Platform for the purpose of providing independent sales progression services to its Client Agencies.",
      "They should be read alongside our:",
      <ul>
        <li><Link href="/terms">General Terms of Service</Link></li>
        <li><Link href="/billing-terms">Billing Terms</Link></li>
        <li><Link href="/privacy">Privacy Policy</Link></li>
        <li><Link href="/legal/dpa">Data Processing Agreement</Link></li>
      </ul>,
      <p>Our <Link href="/outsourced-terms">Outsourced Sales Progression Terms</Link> govern a separate contractual arrangement under which TSP provides managed sales progression services directly.</p>,
      "Where individually agreed written commercial terms conflict with the provisions of these Terms, those individually agreed terms shall take precedence to the extent of the relevant inconsistency.",
    ],
  },
  {
    id: "third-party-rights",
    title: "22. Third-Party Rights",
    paras: [
      "These Terms establish a contractual relationship exclusively between TSP and the Business.",
      "The provision of access to the Platform, transaction information or communications to Client Agencies, End Clients or other parties does not make those parties a party to these Terms.",
      "Unless expressly provided otherwise, no person other than TSP and the Business shall have any right to enforce any provision of these Terms.",
    ],
  },
  {
    id: "governing-law",
    title: "23. Governing Law and Jurisdiction",
    paras: [
      "These Terms, including any dispute or claim arising from or in connection with them, shall be governed by and construed in accordance with the laws of England and Wales.",
      "The courts of England and Wales shall have jurisdiction in respect of any dispute arising under or in connection with these Terms.",
    ],
  },
  {
    id: "summary",
    title: "Summary of Key Terms",
    paras: [
      "The following summary is provided for convenience. It does not replace or override the contractual provisions set out above.",
      <h3>Independent sales progression</h3>,
      "The Business provides and remains responsible for its own sales progression services. TSP supplies the software and associated functionality used to support those services.",
      <h3>Responsibility for clients</h3>,
      "The Business retains responsibility for its Client Agencies, End Clients, professional obligations and the management of its transactions.",
      <h3>Subscription and transaction charges</h3>,
      "Standard pricing is £59 per month for the primary account, £39 per month for each additional active Team Member and £5 per sale added, subject to the applicable provisions for existing transactions and any individually agreed pricing.",
      <h3>Payment arrangements</h3>,
      "Subscription charges are collected monthly, with applicable transaction charges billed in arrears. An initial proportionate subscription charge applies when payment details are first registered.",
      <h3>Failed payments</h3>,
      "A seven-day grace period applies to failed payments. If payment remains outstanding, the ability to add new sales may be restricted. Existing transactions remain accessible and operational while the payment issue is resolved.",
      <h3>Cancellation</h3>,
      "The Business may cancel at any time. Access continues until the end of the current paid billing period, and any outstanding charges remain payable.",
      <h3>Data protection</h3>,
      "The Business is responsible for ensuring that personal information is processed lawfully. TSP processes information in accordance with its Data Processing Agreement and applicable legislation.",
    ],
  },
];

const SECTIONS: PolicySection[] = RAW.map((s) => ({
  id: s.id,
  title: s.title,
  body: <>{s.paras.map((p, i) => (typeof p === "string" ? <p key={i}>{p}</p> : <Fragment key={i}>{p}</Fragment>))}</>,
}));

export default function ProgressionBusinessTermsPage() {
  return (
    <PolicyShell
      title="Sales Progression Business Terms of Service"
      description="These Terms and Conditions govern the use of The Sales Progressor platform by independent sales progression businesses providing services to their own client agencies."
      lastUpdated="October 2026"
      version="1.0"
      sections={SECTIONS}
    />
  );
}
