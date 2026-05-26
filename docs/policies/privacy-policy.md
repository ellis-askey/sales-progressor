# Privacy Policy

**Source (live):** [`app/privacy/page.tsx`](../../app/privacy/page.tsx) — served at `/privacy`
**Linked from:** Register page (consent checkbox), Terms of Service (cross-reference), Cookie Policy (cross-reference), footers
**Last shown date in copy:** "Last updated: May 2026" (placeholder)

---

## Current text (verbatim from source)

### 1. Who we are

The Sales Progressor Ltd operates this platform ("The Sales Progressor"). This policy explains how we collect, use, and protect personal data in connection with the platform. We are the data controller for data held in the platform itself. Estate agencies using the platform are data controllers for their clients' data that they enter.

### 2. Data we collect

- **Account holders** (agency staff): name, email address, hashed password, role.
- **Transaction contacts** (buyers, sellers, solicitors): name, email address, phone number, role in the transaction. This data is entered by the agency, not collected directly from the individuals.
- **Transaction data**: property addresses, milestone progress, communication logs, notes.
- **Portal usage**: access timestamps, milestone confirmations, pages viewed.
- **Communications**: copies of emails and messages sent through the platform are logged.

### 3. How we use it

Data is used to provide the platform's core functions: tracking property transactions, sending progress updates, generating chase communications, and providing buyers and sellers with portal access to their transaction. We do not use personal data for marketing, profiling, or selling to third parties.

### 4. Third-party services we use

We use a small number of trusted service providers (sub-processors) to run the platform. Each processes personal data only on our instructions and under a data processing agreement. They are:

| Provider | What it does | Data location |
|---|---|---|
| Supabase | Database hosting and file storage | EU |
| Vercel | Application hosting and delivery | EU / global edge |
| SendGrid (Twilio) | Sending transactional and notification email | EU / US under standard safeguards |
| Anthropic | Powers AI-assisted features, such as drafting chase messages | US under standard safeguards |
| Upstash | Rate limiting and background-task infrastructure | EU |
| PostHog | Product analytics — only when you have consented to analytics cookies. Text is masked and session recording is disabled. | EU |

We review this list as our providers change and keep our cookie policy and this page in step with it.

### 5. Data retention

Transaction data is retained for 7 years after completion or cancellation to support compliance with estate agency record-keeping requirements. Account data for agency staff is retained while the account is active. Accounts that have been inactive for 3 or more years with no open transactions are automatically anonymised — all personal identifiers (name, email, phone number) are replaced with placeholder values. Portal access links expire after the transaction is marked complete.

To request early deletion of your data, email support@thesalesprogressor.co.uk.

### 6. Your rights

Under UK GDPR you have the right to access, correct, or request deletion of your personal data. Buyers and sellers whose data has been entered by an agency should contact their estate agent in the first instance. Direct requests can be sent to: support@thesalesprogressor.co.uk

### 7. Cookies

We use strictly necessary cookies to keep you signed in and to keep the platform secure — your session token, a security (CSRF) token, and a cookie that remembers your cookie choice. These are required for the platform to work and do not need your consent.

With your consent, we also use analytics cookies from PostHog to understand how the platform is used so we can improve it. We ask for this when you first visit, and you can accept or decline. You can change your choice at any time using the "Reset preferences" option on our cookie policy page. If you decline, no analytics cookies are set.

We do not use advertising cookies, and we do not sell your data.

A full list of the individual cookies we use is in our [Cookie Policy](./cookie-policy.md).

### 8. Contact and complaints

Privacy questions: support@thesalesprogressor.co.uk

You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk.

---

## Pre-existing review flags (8 sections, verbatim from source comments)

These are already marked in the source code as needing legal review before launch — each immediately precedes the section it applies to.

1. **Section 1 — Who we are**: *"LEGAL REVIEW REQUIRED — confirm data controller vs data processor distinction; verify company name and registered details"*
2. **Section 2 — Data we collect**: *"LEGAL REVIEW REQUIRED — confirm data inventory is complete; verify no additional categories are collected (e.g. IP addresses, device data)"*
3. **Section 3 — How we use it**: *"LEGAL REVIEW REQUIRED — lawful basis for processing not stated; UK GDPR requires identifying the legal basis (contract, legitimate interest, consent, etc.) for each processing activity"*
4. **Section 4 — Third-party services**: *"LEGAL REVIEW REQUIRED — confirm data processing agreements (DPAs) exist with each listed sub-processor; verify region accuracy for each service"*
5. **Section 5 — Data retention**: *"LEGAL REVIEW REQUIRED — confirm 7-year transaction retention period is correct for estate agency compliance; confirm 3-year inactivity threshold is defensible; check whether anonymisation constitutes erasure under UK GDPR"*
6. **Section 6 — Your rights**: *"LEGAL REVIEW REQUIRED — confirm all UK GDPR data subject rights are listed (access, rectification, erasure, restriction, portability, objection, automated decision-making); verify complaint escalation path is accurate"*
7. **Section 7 — Cookies**: *"LEGAL REVIEW REQUIRED — verify cookie disclosure matches the actual cookies set; confirm PECR compliance for any analytics cookies"*
8. **Section 8 — Contact and complaints**: *"LEGAL REVIEW REQUIRED — confirm ICO registration is in place; verify contact details are current"*

---

## Observations for the improvement pass

- **Section 3 lawful basis is the biggest gap** — UK GDPR Art. 6 requires the controller to identify the lawful basis for each processing activity. The current copy doesn't state any. Likely candidates: contract (for account holders), legitimate interest (for transaction data shared by the agency), and the agency's own lawful basis flowing through for the buyers/sellers data. Section needs explicit Art. 6 mapping.
- **Section 2 — IP addresses + device data**: Sentry (error monitoring) was installed in commit `fe3e93b` and captures IP + user-agent on errors. PostHog also captures IP for analytics. Neither is currently disclosed in the data-inventory list. Verify Sentry is added to Section 4 (sub-processors) too — it's missing.
- **Section 4 — Stripe missing from the sub-processor list.** Stripe processes payment card data + customer billing details. This is a material omission for a platform that now takes real money. Add Stripe (US under SCCs / UK Adequacy Decision).
- **Section 4 — Sentry missing too.** Same situation — added recently, processes error data (which can include personal data fragments from request URLs, user IDs, etc.).
- **Controller / processor language in Section 1 is technically right but could be clearer for non-legal readers.** Estate agencies are data controllers for their clients' data; we're a data processor for them re: that data. We're also a data controller for our own platform data (agency accounts, billing). The current single paragraph mixes these.
- **Section 5 retention numbers (7 years, 3 years)** are stated without source. The 7-year estate agency record-keeping requirement comes from money laundering regulations and HMRC tax record requirements — worth citing or grounding rather than asserting bare.
- **Section 6 should enumerate the full set of UK GDPR rights** (access, rectification, erasure, restriction, portability, objection, automated decision-making) per the source-code review flag. Currently lists only "access, correct, or request deletion".
- **Section 7 (cookies summary) overlaps with the dedicated Cookie Policy.** Acceptable redundancy — but verify the two stay in sync. If/when one is updated, the other must be too. Worth flagging an editorial process in the GAPS doc.
- **No DPIA (Data Protection Impact Assessment) reference.** For a platform handling property-transaction PII at scale, a DPIA may be required under UK GDPR Art. 35. Even if not strictly required, mentioning that one has been conducted (or noting our risk-tier assessment) strengthens trust.
- **No international data transfer mechanism named.** SendGrid and Anthropic are in the US under "standard safeguards" — should explicitly name SCCs (Standard Contractual Clauses) and the UK IDTA addendum where applicable.
- **No reference to children.** Standard practice to state the platform is not intended for under-13s/16s. Low risk here (B2B estate agency tool) but easy to add.
- **No security commitment / breach notification process.** UK GDPR Art. 33–34 obligate controllers to notify the ICO of personal data breaches within 72 hours. Worth mentioning the commitment.
- **Voice / register**: copy is plain English and well-pitched for a non-legal audience. Don't lose that in the legal-review pass — over-legalese would be a regression.
- **"May 2026" placeholder date** needs replacing with the actual most-recent revision date once the legal review pass lands.
