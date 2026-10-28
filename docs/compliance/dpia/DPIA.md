# Data Protection Impact Assessment (DPIA) — The Sales Progressor

**Controller / Processor:** The Sales Progressor Ltd (company no. 17455131)
**Platform assessed:** The Sales Progressor (TSP) — UK property sales-progression SaaS
**Assessment owner:** Ellis Askey (founder; data-protection lead and breach owner)
**Date of assessment:** 27 October 2026
**Version:** 1.0
**Next review:** 27 October 2027, or sooner on any material change (new processing, new sub-processor, new AI feature, or a personal-data breach)

> This DPIA follows the Information Commissioner's Office (ICO) DPIA methodology. It records the processing, assesses necessity and proportionality, identifies risks to individuals, and sets out the controls in place. It reflects the state of the platform as at the date above and is reviewed on the cycle set out in section 18.

---

## 1. Description of the processing and its purposes

The Sales Progressor manages residential property transactions in England and Wales from offer-accepted through to completion. It replaces manual chasing and spreadsheets with structured milestones, automated client updates, and a shared view for every party to a sale.

**Why we process personal data:** to progress property sales on behalf of estate agencies (and independent sales-progression businesses), to keep buyers, sellers, solicitors and brokers informed, to coordinate the parties, and to operate and bill for the service.

**Service tiers:**
- Self-managed: the agency uses the platform to run its own files.
- Outsourced: our internal team (or an independent progression business) runs the file on the agency's behalf.

---

## 2. Is a DPIA legally required?

Yes, a DPIA is appropriate and we have chosen to complete one. The processing involves:
- Large-scale processing of personal data about multiple categories of individuals (buyers, sellers, agency staff, solicitors, brokers).
- Financial data and detailed life-event data (a house move), which is sensitive in nature even where not "special category".
- Innovative technology (AI assistance over correspondence).
- Combining and matching data from several sources (email, WhatsApp, portal, uploaded documents).

While none of these in isolation makes a DPIA strictly mandatory under Article 35 for a business of our size, the combination makes one clearly advisable, and completing one demonstrates accountability. Where a borderline legal judgement arises (for example whether ICO prior consultation is needed), we will take qualified UK data-protection advice rather than decide it internally.

---

## 3. Nature, scope, context and purposes

**Nature:** collection, storage, structuring, transmission, AI-assisted explanation/drafting, and eventual deletion/anonymisation of transaction-related personal data.

**Scope:** every live residential sale managed on the platform and the parties attached to it; the agency and internal staff accounts that operate it.

**Context:** a UK B2B SaaS where the agency (or progression business) is the **controller** of its clients' data and The Sales Progressor Ltd is the **processor**; The Sales Progressor Ltd is the **controller** of its own account-holder and staff data. Pre-launch stage, small number of test users, onboarding first major agency client.

**Purposes:** sales progression, client communication, coordination, service operation and billing. No profiling or automated decision-making that produces legal or similarly significant effects on individuals (see §7).

---

## 4. Categories of individuals and personal data

**Individuals:** buyers, sellers, their solicitors/conveyancers, mortgage brokers, estate-agency staff (directors, negotiators), independent progressors, and our internal team.

**Personal data processed:**
- Identity and contact: names, email addresses, phone numbers.
- Property and transaction: addresses, agreed prices, tenure, purchase method, milestone dates.
- Financial/mortgage: price, deposit, mortgage status, fees (no card data held by us; card payments go directly to Stripe).
- Correspondence: emails (where a mailbox is connected), WhatsApp messages, portal messages, internal notes, enquiry text.
- Documents: contracts, memorandums of sale, searches, surveys, management packs, and potentially identity documents, uploaded by staff or by clients through the portal.
- Account/security: hashed passwords, two-factor secrets, session data, login identifiers from Google/Microsoft sign-in.
- Analytics: consent-gated, masked product analytics (EU-hosted).

**Special-category / criminal-offence data:** not intentionally processed and contractually excluded in our Data Processing Agreement. However, free-text fields, uploaded documents and the AI "explain email" tool could *inadvertently* capture such data (for example health or financial-hardship context in a solicitor's email). Such data is contractually excluded in our DPA, and this residual possibility is recorded as an accepted risk in the Risk Register (R7).

---

## 5. Data flow and recipients

A full technical data-flow map is maintained separately in `DATA-FLOW-MAP.md`. In summary:

- Data is entered by agency staff, by our internal team, or by clients through their portal, or ingested from a connected mailbox / WhatsApp.
- It is stored in our database and file storage (Supabase, **EU region** for production) and processed on our hosting (Vercel, compute pinned to Dublin, Ireland).
- Selected content is sent to third-party sub-processors to deliver features: email delivery (SendGrid), AI assistance (Anthropic; OpenAI for an internal marketing tool only), billing (Stripe), analytics (PostHog, EU), error monitoring (Sentry), and messaging (Meta WhatsApp; Microsoft/Google for mailbox and sign-in).
- Clients receive milestone emails and portal access; solicitors receive scoped confirmation links.

Recipients and the international-transfer position are set out in §6 and in the Risk Register (R8).

---

## 6. Lawful basis and controller / processor analysis

- **For agency client data**, the agency (or progression business) is the **controller** and determines the lawful basis (typically legitimate interests / contract for progressing a sale the client has instructed). The Sales Progressor Ltd acts as **processor** under a written Data Processing Agreement (Article 28), available at `portal.thesalesprogressor.co.uk/legal/dpa`.
- **For our own account-holder and staff data**, The Sales Progressor Ltd is the **controller**, relying on contract (providing the service) and legitimate interests (operating and securing it), with consent for optional analytics and for connecting a mailbox / WhatsApp.
- **International transfers:** core compute is in the EEA (Dublin) and production data is in the EU. Several sub-processors are US-based (Anthropic, OpenAI, SendGrid, Stripe, Google, Meta). Transfers to these rely on the providers' Standard Contractual Clauses and the UK International Data Transfer Addendum, incorporated through their data-processing terms. Each sub-processor is covered by such a data-processing agreement (Risk Register R8).

---

## 7. Necessity and proportionality

- **Lawfulness, fairness, transparency:** processing is explained in the website privacy policy and DPA, and the client portal links to the privacy notice. AI assistance is disclosed in the Terms.
- **Purpose limitation:** data is used to progress sales and operate the service; it is not sold or repurposed. The internal marketing tool (OpenAI) uses prospect data for outreach only and is disclosed as a sub-processor.
- **Data minimisation:** the buyer/seller portal is strictly minimised, verified in code (a buyer cannot see the seller's contact details or internal notes). AI chase-drafting strips personal data before sending. The "explain email" tool, by contrast, sends the full pasted text (see AI assessment and R6).
- **Accuracy:** staff can edit records; clients update via the agency (processor model).
- **Storage limitation:** policy states a 7-year retention after completion, then deletion/anonymisation. This is operated as a documented **manual** process (owner: Ellis), covering both the 7-year purge and erasure requests. Recorded as R1.
- **Integrity and confidentiality:** strong tenant isolation (verified), encryption in transit and at rest, private document storage with short-lived signed links, signature-verified webhooks, consent-gated masked analytics, encrypted two-factor secrets, active rate limiting, a locked-down inbound-email endpoint, and revocable portal links (R2–R5).
- **Accountability:** this DPIA, the DPA, the privacy policy, the Risk Register and the Action Plan form the accountability record. Ellis is the named data-protection lead and breach owner.

**Proportionality conclusion:** the processing is necessary and proportionate to the service. The main proportionality tension is the AI "explain email" tool sending unminimised correspondence to a US AI provider; this is mitigated by the provider not storing or training on the content, the ability to turn the feature off, and the absence of any automated decision-making.

---

## 8. Consultation

- **Internal:** assessment conducted with the founder (sole decision-maker and data-protection lead).
- **Processors/sub-processors:** covered by their published data-processing terms, confirmed per provider.
- **Data subjects:** not individually consulted (standard for B2B processor processing); transparency delivered via the privacy notice and the client portal.
- **ICO:** not required at this stage. Residual risks after mitigation are assessed as Low to Medium, below the "high risk that cannot be mitigated" threshold that triggers prior consultation. To be revisited if any residual risk remains High after mitigation.

---

## 9–15. Risks, safeguards, likelihood/severity, ratings and mitigation

The full risk assessment, including methodology, inherent rating, mitigation, owner, target date and residual rating, is maintained in `RISK-REGISTER.md`. The headline risks are:

| Ref | Risk to individuals | Inherent | Residual (with mitigation in place) |
|---|---|---|---|
| R1 | Client data kept indefinitely; no automated erasure of a client contact/documents | High | Medium |
| R2 | Staff two-factor secrets stored unencrypted | High | Low |
| R3 | No brute-force protection (rate limiting off) | High | Low |
| R4 | Portal links never expire / forwardable | Medium | Low–Medium |
| R5 | Inbound-email endpoint unauthenticated | Medium | Low |
| R6 | AI "explain email" sends unminimised data to US provider; no off-switch | Medium–High | Medium |
| R7 | Inadvertent special-category data, no technical guard | Medium | Medium |
| R8 | US transfers / undisclosed sub-processors | Medium–High | Low–Medium |
| R9 | Isolation is app-layer only; RLS/backups unconfirmed | Medium | Low–Medium |
| R10 | Founder account bypasses two-factor (owner-accepted) | Medium | Medium |

The risk methodology, every risk, and the remaining lower risks (R11–R13) are in the Risk Register.

---

## 16. Ongoing assurance

The controls described in this DPIA are in place. Ongoing assurance consists of periodic test-restores of database backups, annual re-confirmation of sub-processor terms, confirmation of monitoring and masking settings at each review, and reassessment on any new AI feature or sub-processor. No open items prevent reliance on this DPIA.

---

## 17. Is ICO consultation necessary?

Not at this time. No residual risk is assessed as High-and-unmitigable. This will be reconsidered if a residual risk is re-rated High at any future review.

---

## 18. Approval and review

- **Prepared:** 27 October 2026.
- **Approved by:** Ellis Askey (founder, data-protection lead) — signature/date: _______________
- **Review cycle:** annually, or on any material change or breach.
- **Related documents:** `DATA-FLOW-MAP.md`, `AI-PRIVACY-ASSESSMENT.md`, `RISK-REGISTER.md`, `GDPR-ACTION-PLAN.md`, `CLIENT-GDPR-ANSWERS.md`; the DPA at `/legal/dpa`; the website privacy policy.
