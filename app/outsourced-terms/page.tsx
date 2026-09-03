// app/outsourced-terms/page.tsx
//
// Outsourced Sales Progression Terms of Service. Agency-facing (B2B) terms
// that apply when an estate agency instructs TSP to progress a sale on its
// behalf. Sits in the policy nav alongside the general Terms, Billing Terms
// and DPA, and reserves TSP's professional judgement over when/how often to
// chase (the clause the live product, intro email, weekly update and marketing
// most need backing).
//
// Same structure as the sibling policy pages: a RAW section list mapped into
// PolicyShell. No placeholders in the supplied copy. Unlike the other legal
// pages this document does not identify the TSP legal entity (company number /
// registered office); flagged for Ellis to reconcile if desired.

import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell, type PolicySection } from "@/components/policies/PolicyShell";

export const metadata: Metadata = {
  title: "Outsourced Sales Progression Terms — The Sales Progressor",
  description: "The terms that apply when an estate agency instructs The Sales Progressor to progress a sale on its behalf.",
};

type Raw = { id: string; title: string; paras: ReactNode[] };

const RAW: Raw[] = [
  {
    id: "introduction",
    title: "Introduction",
    paras: [
      <p>These Outsourced Sales Progression Terms of Service (&ldquo;Terms&rdquo;) apply whenever an estate agency (&ldquo;the Agent&rdquo;) instructs The Sales Progressor (&ldquo;TSP&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) to provide outsourced sales progression services.</p>,
      "By submitting, transferring or otherwise instructing us to progress a transaction, the Agent agrees that these Terms apply to that instruction.",
      <p>These Terms should be read alongside any other applicable terms agreed between TSP and the Agent, including our <Link href="/terms">general Terms of Service</Link>, <Link href="/billing-terms">Billing Terms</Link> and <Link href="/legal/dpa">Data Processing Agreement</Link>.</p>,
    ],
  },
  {
    id: "our-role",
    title: "1. Our Role",
    paras: [
      "TSP provides an outsourced residential sales progression service to estate agents.",
      "When instructed, we manage the day-to-day progression of the transaction on behalf of the Agent, helping to coordinate communication between the parties, establish progress, identify outstanding actions, follow up where appropriate and assist the transaction towards exchange and completion.",
      <p>Our role is one of <strong>sales progression, communication and coordination</strong>.</p>,
      "We are not a solicitor, licensed conveyancer, mortgage adviser, surveyor, valuer, tax adviser or other regulated professional adviser.",
      "We do not carry out conveyancing and nothing we communicate should be treated as legal, financial, mortgage, tax, surveying or other regulated professional advice.",
      "The Agent remains the instructed estate agent and retains responsibility for its own legal, regulatory and professional obligations.",
    ],
  },
  {
    id: "what-included",
    title: "2. What Our Service Includes",
    paras: [
      "The precise work required will vary from transaction to transaction.",
      "As part of a normal outsourced instruction, we may:",
      <ul>
        <li>introduce ourselves to the relevant buyers and sellers;</li>
        <li>establish the current position of the transaction;</li>
        <li>liaise with buyers, sellers, solicitors, conveyancers, estate agents, mortgage brokers and other relevant parties;</li>
        <li>monitor key stages and milestones;</li>
        <li>identify outstanding actions;</li>
        <li>request updates and chase outstanding matters where appropriate;</li>
        <li>communicate relevant progress to the parties;</li>
        <li>identify apparent delays or risks;</li>
        <li>establish and monitor the related property chain where reasonably possible;</li>
        <li>assist with communication concerning proposed exchange and completion dates;</li>
        <li>maintain transaction information within the TSP platform;</li>
        <li>provide buyers and sellers with access to relevant progress information;</li>
        <li>escalate matters where we consider further intervention is appropriate; and</li>
        <li>continue progression through exchange and completion.</li>
      </ul>,
      "We decide how best to carry out these activities using our experience and professional judgement.",
    ],
  },
  {
    id: "what-not-included",
    title: "3. What Our Service Does Not Include",
    paras: [
      "Our service does not include:",
      <ul>
        <li>carrying out conveyancing or legal work;</li>
        <li>providing legal advice;</li>
        <li>interpreting legal documents for a buyer or seller;</li>
        <li>advising a party whether they should exchange contracts;</li>
        <li>raising or answering formal legal enquiries on behalf of a conveyancer;</li>
        <li>providing mortgage or financial advice;</li>
        <li>providing surveying, valuation or structural advice;</li>
        <li>providing tax advice;</li>
        <li>independently verifying title, ownership or legal information;</li>
        <li>guaranteeing the accuracy of information provided by another party;</li>
        <li>guaranteeing finance or mortgage approval;</li>
        <li>guaranteeing that a transaction will proceed;</li>
        <li>guaranteeing an exchange or completion date;</li>
        <li>managing the professional work of a solicitor, conveyancer, lender, surveyor or other third party; or</li>
        <li>carrying out any activity requiring professional authorisation or regulation that TSP does not hold.</li>
      </ul>,
      "Where professional advice is required, the relevant party remains responsible for obtaining that advice from an appropriately qualified professional.",
    ],
  },
  {
    id: "how-we-progress",
    title: "4. How We Progress a Sale",
    paras: [
      "Our service is proactive, but effective sales progression does not mean repeatedly contacting every party regardless of the circumstances.",
      "The appropriate frequency of contact depends upon matters including:",
      <ul>
        <li>the stage of the transaction;</li>
        <li>what action is outstanding;</li>
        <li>who is responsible for that action;</li>
        <li>when that party was last contacted;</li>
        <li>any timeframe already provided;</li>
        <li>whether new information is reasonably expected;</li>
        <li>the urgency of the matter; and</li>
        <li>the circumstances of the transaction and wider chain.</li>
      </ul>,
      <p>We therefore use our professional judgement to determine <strong>when, how and with whom to follow up</strong>.</p>,
      "There may be periods where no further chase is reasonably required, for example where searches are being processed, mortgage work is underway, information has been ordered, a solicitor has provided a reasonable timeframe or another known process must first be completed.",
      "We do not guarantee any fixed frequency of chasing or contact.",
      "The absence of a recent chase does not necessarily mean that the transaction is not being actively monitored or progressed.",
    ],
  },
  {
    id: "communication-response",
    title: "5. Communication and Response Times",
    paras: [
      "We aim to provide a responsive and proactive service and will prioritise genuinely urgent matters where reasonably possible.",
      "However, we do not guarantee that an email, telephone call, WhatsApp message, portal message or other communication will be responded to within a particular period unless a specific service level has been separately agreed in writing.",
      "Sales progression involves managing multiple transactions and coordinating with third parties whose availability and response times are outside our control.",
      "An immediate response should therefore not be expected.",
      "Where we are waiting for meaningful information from another party, we may wait for that information rather than provide repetitive updates confirming that the position has not changed.",
    ],
  },
  {
    id: "third-parties",
    title: "6. Third Parties",
    paras: [
      "Property transactions depend heavily upon independent third parties.",
      "These may include:",
      <ul>
        <li>solicitors and conveyancers;</li>
        <li>mortgage lenders;</li>
        <li>mortgage brokers;</li>
        <li>surveyors;</li>
        <li>managing agents;</li>
        <li>freeholders;</li>
        <li>housing associations;</li>
        <li>local authorities;</li>
        <li>search providers;</li>
        <li>other estate agents; and</li>
        <li>other buyers and sellers within a chain.</li>
      </ul>,
      "We may communicate with and chase these parties, but they do not work for TSP and we cannot compel them to respond or act.",
      "We are not responsible for their workload, availability, actions, omissions, advice, systems or response times.",
      "Where a third party is not responding, we may continue to follow up, seek another appropriate contact, escalate the issue to the Agent or take another reasonable course of action.",
      "None of these actions guarantees that the third party will respond or that the underlying issue will be resolved.",
    ],
  },
  {
    id: "exchange-completion-dates",
    title: "7. Exchange and Completion Dates",
    paras: [
      <p>Before exchange of contracts, any exchange or completion date discussed or displayed should be treated as <strong>provisional only</strong>.</p>,
      "This includes dates described as:",
      <ul>
        <li>target dates;</li>
        <li>estimated dates;</li>
        <li>planned dates;</li>
        <li>preferred dates;</li>
        <li>anticipated dates; or</li>
        <li>dates the parties are &ldquo;working towards&rdquo;.</li>
      </ul>,
      "Such dates are intended to assist coordination and do not constitute a promise or guarantee from TSP that exchange or completion will take place on that date.",
      "We may communicate a proposed date supplied by a buyer, seller, estate agent, solicitor or another party without adopting that date as our own commitment.",
      "The legal position and any binding completion arrangements must be confirmed by the relevant solicitors or conveyancers.",
      "Buyers and sellers should not make financial or practical commitments in reliance upon a proposed date without taking appropriate advice from their conveyancer.",
      "TSP is not responsible for losses arising because a proposed exchange or completion date changes or is not achieved, except where liability cannot lawfully be excluded.",
    ],
  },
  {
    id: "transaction-timescales",
    title: "8. Transaction Timescales",
    paras: [
      "Any indication of how long a transaction, stage or particular piece of work may take is an estimate only.",
      "Property transactions vary considerably and their duration can be affected by matters including:",
      <ul>
        <li>the length and circumstances of the chain;</li>
        <li>mortgage requirements;</li>
        <li>searches;</li>
        <li>surveys;</li>
        <li>enquiries;</li>
        <li>leasehold or management information;</li>
        <li>title issues;</li>
        <li>probate;</li>
        <li>third-party consents;</li>
        <li>client responsiveness; and</li>
        <li>solicitor or lender workloads.</li>
      </ul>,
      "Previous experience or typical transaction times should not be interpreted as a guarantee that a particular transaction will follow the same timeframe.",
    ],
  },
  {
    id: "property-chains",
    title: "9. Property Chains",
    paras: [
      "Where a transaction forms part of a chain, progress may depend upon transactions and parties over which neither TSP nor the Agent has control.",
      "We will make reasonable efforts to establish and monitor relevant chain information where appropriate.",
      "However, we may depend upon information supplied by other estate agents, solicitors, buyers, sellers and other third parties.",
      "We cannot guarantee that:",
      <ul>
        <li>chain information supplied to us is complete or current;</li>
        <li>another agent will provide information;</li>
        <li>every transaction in the chain will progress at the same rate;</li>
        <li>a party will remain in the chain;</li>
        <li>a related transaction will proceed; or</li>
        <li>a particular exchange or completion date can be achieved across the chain.</li>
      </ul>,
      "Chain information should therefore be treated as the latest information reasonably available to us rather than a guarantee of the position.",
    ],
  },
  {
    id: "information-provided",
    title: "10. Information Provided to Us",
    paras: [
      "Our progression work depends upon information provided by the Agent, buyers, sellers, solicitors and other third parties.",
      "Unless specifically agreed otherwise, we do not independently verify that information.",
      "We may rely upon it when progressing the transaction and may communicate relevant information to other parties where reasonably necessary.",
      "We are not responsible for delay, error or loss arising from inaccurate, incomplete, misleading or outdated information supplied to us by another person, except where liability cannot lawfully be excluded.",
      "If the Agent becomes aware that information supplied to us is incorrect or has changed, it should notify us as soon as reasonably possible.",
    ],
  },
  {
    id: "platform-portal",
    title: "11. The TSP Platform and Client Portal",
    paras: [
      "The TSP platform and client portal are intended to make transaction progress easier to understand and provide greater visibility to Agents, buyers and sellers.",
      "Information displayed may include milestones, progress indicators, transaction stages, target dates, estimated dates, documents, activity and other transaction information.",
      <p>This information is provided for <strong>progression and informational purposes only</strong>.</p>,
      "It should not be treated as an authoritative legal record of the transaction.",
      "In particular:",
      <ul>
        <li>information may depend upon updates provided or entered by people involved in the transaction;</li>
        <li>information may not be independently verified by TSP;</li>
        <li>there may be a delay between something happening and TSP becoming aware of it;</li>
        <li>a milestone being shown as complete does not replace confirmation from the relevant professional;</li>
        <li>progress percentages or indicators are intended as a visual guide only;</li>
        <li>target, planned and estimated dates are not guarantees; and</li>
        <li>information displayed within the portal may not always reflect the most recent legal position.</li>
      </ul>,
      "Where there is any difference between information shown within the TSP platform and formal information provided by a solicitor or conveyancer, the legal position should be confirmed with the relevant solicitor or conveyancer.",
    ],
  },
  {
    id: "technology-automated",
    title: "12. Technology and Automated Communications",
    paras: [
      "We may use technology and automated systems to assist with reminders, communications, transaction monitoring, administration and other elements of the service.",
      "These systems support our sales progression work but do not replace the judgement of the progressor or the responsibilities of the parties involved in the transaction.",
      "Automated communications, reminders and notifications are provided on a reasonable-efforts basis.",
      "We do not guarantee that any particular automated message, reminder or notification will be sent or received.",
      "Technical issues, service interruptions, third-party provider failures, incorrect contact information, email filtering and other circumstances may delay or prevent delivery.",
      "Where we become aware of a material technical issue affecting a transaction, we will take reasonable steps to address it.",
    ],
  },
  {
    id: "communications-records",
    title: "13. Communications and Records",
    paras: [
      "Depending on the circumstances, communication relating to a transaction may take place by email, telephone, messaging services, through the TSP platform or by another appropriate method.",
      "Not every communication concerning a transaction will necessarily appear within the TSP platform.",
      "The transaction record should therefore not be assumed to represent a complete legal or professional record of every communication between every party.",
      "Where an important instruction or legal matter requires confirmation, the relevant party should confirm it directly with their solicitor, conveyancer or other appropriate professional.",
    ],
  },
  {
    id: "buyer-seller-responsibilities",
    title: "14. Buyer and Seller Responsibilities",
    paras: [
      "Sales progression depends upon buyers and sellers taking the actions required of them.",
      "They remain responsible for matters including:",
      <ul>
        <li>instructing appropriate professional advisers;</li>
        <li>responding to their solicitor or conveyancer;</li>
        <li>completing and returning required documentation;</li>
        <li>providing identification and source-of-funds information where required;</li>
        <li>arranging finance;</li>
        <li>making required payments;</li>
        <li>reviewing legal documentation;</li>
        <li>signing documents;</li>
        <li>obtaining professional advice;</li>
        <li>providing accurate information; and</li>
        <li>making their own decisions concerning the transaction.</li>
      </ul>,
      "TSP cannot complete these actions on behalf of a buyer or seller and is not responsible for delays caused by a party failing to take an action required of them.",
    ],
  },
  {
    id: "agent-responsibilities",
    title: "15. The Agent’s Responsibilities",
    paras: [
      "The Agent agrees to:",
      <ul>
        <li>provide accurate transaction and contact information when instructing us;</li>
        <li>provide sufficient information for us to begin progression;</li>
        <li>ensure we are authorised to communicate with relevant parties on its behalf;</li>
        <li>notify us of material changes affecting a transaction;</li>
        <li>provide reasonable assistance where intervention from the Agent is required;</li>
        <li>notify us where it becomes aware that information held by us is inaccurate; and</li>
        <li>remain responsible for its own duties as the instructed estate agent.</li>
      </ul>,
      "Outsourcing sales progression to TSP does not transfer the Agent’s statutory, regulatory or professional obligations to us.",
      "Where we consider direct intervention from the Agent necessary or more appropriate, we may refer the matter back to the Agent.",
    ],
  },
  {
    id: "escalation",
    title: "16. Escalation",
    paras: [
      "Where normal progression activity is not achieving a response or resolution, we may escalate the matter where we consider it appropriate.",
      "This might involve further contact, contacting another appropriate person within an organisation, raising the matter with the Agent or identifying the issue as a risk to the transaction.",
      "Some matters can only be resolved by the client, Agent, solicitor or another professional.",
      "Where this is the case, our responsibility is limited to reasonably identifying and communicating the issue. We cannot guarantee that the person responsible will take the required action.",
    ],
  },
  {
    id: "difficult-communication",
    title: "17. Difficult, Abusive or Excessive Communication",
    paras: [
      "We want buyers, sellers, Agents and professionals to be able to contact us when assistance is required.",
      "However, abusive, threatening, discriminatory or persistently unreasonable behaviour towards our team will not be accepted.",
      "We may also manage excessive or repetitive communication where its frequency or nature materially interferes with our ability to progress the transaction or provide services to other clients.",
      "Where appropriate, we may:",
      <ul>
        <li>request that future communication takes place through a particular channel;</li>
        <li>limit repetitive communication;</li>
        <li>refer communications back to the Agent;</li>
        <li>cease direct communication with an individual; or</li>
        <li>in serious circumstances, withdraw from the transaction.</li>
      </ul>,
    ],
  },
  {
    id: "fees",
    title: "18. Fees",
    paras: [
      "Unless alternative pricing has been agreed in writing, our standard outsourced sales progression fee is based upon the sale price at exchange:",
      <ul>
        <li><strong>Below £350,000: £250</strong></li>
        <li><strong>£350,000 to £499,999: £300</strong></li>
        <li><strong>£500,000 and above: £350</strong></li>
      </ul>,
      <p>The first qualifying outsourced transaction for an agency may be provided free of charge in accordance with the applicable offer and <Link href="/billing-terms">Billing Terms</Link>.</p>,
      "The applicable fee becomes due when contracts exchange.",
      <p>Fees are normally invoiced and collected in accordance with our <Link href="/billing-terms">Billing Terms</Link>.</p>,
      "Where the Agent has agreed bespoke, legacy, promotional or other pricing with TSP, those agreed commercial terms will take precedence.",
      "Any applicable VAT will be dealt with in accordance with the Billing Terms and prevailing law.",
    ],
  },
  {
    id: "fall-throughs",
    title: "19. Fall-Throughs",
    paras: [
      "Unless alternative terms have been agreed, no outsourced sales progression fee is payable where a transaction falls through before exchange of contracts.",
      "Where a property is subsequently resold, a new buyer is introduced or a previously withdrawn transaction is reinstated, we may treat the subsequent progression as a new or continued instruction as appropriate.",
      "Where a transaction has already exchanged, any fee or credit treatment will be governed by the applicable Billing Terms.",
    ],
  },
  {
    id: "out-of-scope-work",
    title: "20. Unusual or Out-of-Scope Work",
    paras: [
      "Our standard outsourced fee covers normal residential sales progression activity.",
      "Occasionally, a transaction or request may require work materially outside the normal scope of the service.",
      "Where we consider separate work or charges necessary, we will discuss this with the Agent before undertaking chargeable additional work.",
    ],
  },
  {
    id: "suspension-withdrawal",
    title: "21. Suspension or Withdrawal of Service",
    paras: [
      "We may suspend or withdraw our service from a transaction where:",
      <ul>
        <li>insufficient information is available for us to progress it;</li>
        <li>the Agent or relevant client repeatedly fails to cooperate;</li>
        <li>abusive or inappropriate behaviour occurs;</li>
        <li>we are asked to carry out work outside our role;</li>
        <li>continuing to act could create legal, regulatory, security or reputational risk;</li>
        <li>fees which are properly due remain unpaid; or</li>
        <li>another reasonable circumstance means we can no longer provide the service effectively.</li>
      </ul>,
      "Where reasonably possible, we will notify the Agent before withdrawing.",
    ],
  },
  {
    id: "ending-service",
    title: "22. Ending the Service",
    paras: [
      "Either TSP or the Agent may end the outsourced service arrangement by giving reasonable written notice.",
      "The parties may agree that existing transactions will continue to be progressed after the wider commercial relationship ends.",
      "Where our involvement with an individual transaction ends before exchange, we will take reasonable steps to make the latest progression information held by us available to the Agent.",
      "Termination does not affect fees or other obligations which have already arisen.",
    ],
  },
  {
    id: "availability-events",
    title: "23. Availability and Events Outside Our Control",
    paras: [
      "We do not guarantee uninterrupted availability of our platform, communications systems or services.",
      "We will not be responsible for failure or delay caused by circumstances reasonably outside our control, including significant technology or telecommunications failures, third-party platform outages, cyber incidents, severe weather, public emergencies, industrial action or other events which materially prevent normal operation.",
      "Where such circumstances occur, we will take reasonable steps to resume normal service.",
    ],
  },
  {
    id: "liability",
    title: "24. Liability",
    paras: [
      "We will provide our outsourced sales progression service with reasonable care and skill.",
      "We are not responsible for losses caused by matters outside our reasonable control, including:",
      <ul>
        <li>acts or omissions of solicitors, conveyancers or other professional advisers;</li>
        <li>delays by third parties;</li>
        <li>a transaction falling through;</li>
        <li>mortgage or lending decisions;</li>
        <li>survey findings or property defects;</li>
        <li>inaccurate information supplied by another party;</li>
        <li>changes within a property chain;</li>
        <li>another party failing to meet a proposed exchange or completion date;</li>
        <li>a buyer or seller changing their position; or</li>
        <li>a party failing to take an action required of them.</li>
      </ul>,
      "To the fullest extent permitted by law, we will not be liable for indirect or consequential losses, loss of profit, loss of opportunity or losses which were not reasonably foreseeable.",
      "Subject to any liability which cannot lawfully be limited or excluded, our total liability arising from or in connection with the services will not exceed the total fees paid or payable by the Agent to TSP during the 12 months immediately preceding the event giving rise to the claim.",
      "Nothing in these Terms excludes or limits liability where doing so would be unlawful.",
    ],
  },
  {
    id: "data-confidentiality",
    title: "25. Data Protection and Confidentiality",
    paras: [
      "Both parties must comply with applicable UK data protection legislation.",
      "In providing the outsourced service, TSP may process personal and transaction information on behalf of the Agent.",
      <p>The respective responsibilities of TSP and the Agent in relation to personal data are governed by our applicable <Link href="/legal/dpa">Data Processing Agreement</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>,
      "We will use confidential information received in connection with a transaction only where reasonably necessary to provide the service, operate the platform, comply with our legal obligations or otherwise as permitted by our agreement with the Agent.",
    ],
  },
  {
    id: "complaints",
    title: "26. Complaints",
    paras: [
      "If the Agent has concerns about our service, these should be raised with us as soon as reasonably possible so that we have an opportunity to investigate and address them.",
      "Where a complaint concerns legal work, professional advice or the conduct of a solicitor, conveyancer or another regulated professional, it should be directed to the relevant organisation.",
    ],
  },
  {
    id: "changes",
    title: "27. Changes to These Terms",
    paras: [
      "We may update these Terms from time to time to reflect changes to our services, business operations or applicable law.",
      "The current version will be identified by its version number and effective date.",
      "Where a change materially affects an existing Agent relationship, we will take reasonable steps to notify the Agent.",
    ],
  },
  {
    id: "relationship-other-terms",
    title: "28. Relationship With Other TSP Terms",
    paras: [
      "These Terms apply specifically to our outsourced sales progression service.",
      <p>They should be read alongside our <Link href="/terms">general Terms of Service</Link>, <Link href="/billing-terms">Billing Terms</Link>, <Link href="/privacy">Privacy Policy</Link> and <Link href="/legal/dpa">Data Processing Agreement</Link> where applicable.</p>,
      "If individually agreed written commercial terms conflict with these Terms, the individually agreed terms will take precedence in relation to that conflict.",
      "Where these Terms conflict with our general Terms of Service specifically in relation to the provision of outsourced sales progression, these Terms will apply to that service.",
    ],
  },
  {
    id: "no-third-party",
    title: "29. No Third-Party Contract",
    paras: [
      "Our contractual relationship for the outsourced service is with the Agent.",
      "Although buyers, sellers and other parties may receive communications, access the client portal or otherwise benefit from the service, this does not make them a party to the contract between TSP and the Agent.",
      "Unless expressly stated otherwise, no third party has the right to enforce these Terms.",
    ],
  },
  {
    id: "governing-law",
    title: "30. Governing Law",
    paras: [
      "These Terms and any dispute or claim arising from them are governed by the laws of England and Wales.",
      "The courts of England and Wales will have jurisdiction in relation to disputes arising from these Terms.",
    ],
  },
  {
    id: "what-to-expect",
    title: "What You Can Expect From Us",
    paras: [
      "The contractual detail above can be summarised quite simply.",
      <p><strong>We will actively progress your sales.</strong></p>,
      "We will establish what is happening, monitor progress, identify outstanding actions, communicate with the relevant parties and follow up where we believe doing so will help move the transaction forward.",
      <p><strong>We will chase with purpose.</strong></p>,
      "Good sales progression is not about contacting every solicitor every day. We will use our experience and judgement to determine when a chase is required, when another approach is more appropriate and when there is simply a known process that needs time to take place.",
      <p><strong>We will keep the transaction organised.</strong></p>,
      "We will maintain the progression information available to us, keep track of the important stages and help ensure that outstanding matters are identified.",
      <p><strong>We will communicate meaningful information.</strong></p>,
      "When there is something useful to report, we will communicate it appropriately. Where nothing has changed because we are waiting for another party or process, we will continue to monitor the position without creating unnecessary communication simply for the sake of providing an update.",
      <p><strong>We will identify and escalate problems.</strong></p>,
      "Where something appears to be holding the transaction up, we will try to establish what it is, who needs to act and what can reasonably be done next.",
      "Where intervention from the Agent is required or is likely to be more effective, we will tell you.",
      <p><strong>We will be realistic about dates.</strong></p>,
      "We can help a chain work towards a target date, but until the solicitors are ready and contracts are exchanged, proposed dates remain provisional.",
      <p><strong>We will not pretend to control things we cannot control.</strong></p>,
      "Solicitors, lenders, managing agents, surveyors, other estate agents, buyers, sellers and other parties within a chain are independent of TSP.",
      "We can coordinate, communicate, chase and escalate.",
      "We cannot compel them to act.",
      "Our commitment is to provide a proactive, organised and commercially sensible sales progression service, using our experience and professional judgement to give each transaction the best opportunity of reaching exchange and completion.",
    ],
  },
];

const SECTIONS: PolicySection[] = RAW.map((s) => ({
  id: s.id,
  title: s.title,
  body: <>{s.paras.map((p, i) => (typeof p === "string" ? <p key={i}>{p}</p> : <Fragment key={i}>{p}</Fragment>))}</>,
}));

export default function OutsourcedTermsPage() {
  return (
    <PolicyShell
      title="Outsourced Sales Progression Terms of Service"
      description="The terms that apply when an estate agency instructs us to progress a sale on its behalf."
      lastUpdated="September 2026"
      version="2.0"
      sections={SECTIONS}
    />
  );
}
