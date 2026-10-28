# DPIA Source Pack — self-contained handover for drafting the final DPIA

**Purpose.** Everything needed to write The Sales Progressor's formal Data Protection Impact Assessment, without access to the codebase. Material factual claims carry an evidence class: [VERIFIED-CODE] [VERIFIED-CONFIG] [OWNER-CONFIRMED] [DOCUMENT] [PARTIALLY-VERIFIED] [NOT-VERIFIED] [NOT-IMPLEMENTED]. Do not upgrade a NOT-VERIFIED item to a fact. Do not include real client names or secrets.

**Prepared:** 28 October 2026 · **Basis:** independent read-only verification audit + owner answers.

---

## 1. Company & platform
The Sales Progressor Ltd (company no. 17455131), a UK estate-agency **sales-progression SaaS**. It manages residential property transactions in England & Wales from offer-accepted through to completion, using structured milestones, automated client updates, and a shared portal. Two tiers: self-managed (agency runs its own files) and outsourced (TSP's team or an independent progression business runs the file). Pre-launch, small number of test users.

## 2. Assessment scope & date
Whole platform, all roles, all processing, with particular focus on AI and confidential property-transaction data. Audit date 28 October 2026. This pack supports a DPIA covering TSP as both processor (agency client data) and controller (its own account/staff/prospect/analytics data).

## 3. Processing purposes
Progress property sales on behalf of agencies; keep buyers, sellers, solicitors and brokers informed; coordinate parties; operate, secure and bill for the service; AI-assisted drafting and plain-English explanation (advisory only); limited cold-outreach marketing to prospective agencies.

## 4. Categories of individuals
Agency staff (director, negotiator); progression-business owners/members; TSP internal staff (sales_progressor, admin, superadmin); buyers; sellers; solicitors/conveyancers; mortgage brokers; prospective-agency contacts.

## 5. Categories of personal data
Identity & contact; property/transaction/chain; financial/mortgage; correspondence (email, WhatsApp, portal, notes, enquiries); documents (contracts, memos, searches, surveys, management packs, possibly ID); account/security (bcrypt-12 passwords, encrypted 2FA secrets, sessions, OAuth ids); consent records (choice + IP + user-agent); payment/billing (no card numbers held — Stripe handles cards); analytics (masked, consent-gated); AI inputs/outputs; prospect data; technical identifiers (IP, user-agent). Special-category/criminal data is not intentionally processed but could appear in free text or documents (no technical guard; contractually barred).

## 6. Controller / processor responsibilities
TSP is **processor** for agency client data (the agency / progression business is **controller**); a UK GDPR Article 28 **DPA** is published at `/legal/dpa` [DOCUMENT]. TSP is **controller** for its own account-holder, staff, prospect, analytics and consent data.

## 7. Processing activities & data flows
Data enters via staff/internal entry, the token-authenticated buyer/seller portal, connected mailboxes (Outlook/IMAP), WhatsApp, and a migration spreadsheet. It is stored in Supabase (EU) and processed on Vercel (Dublin/EEA). Selected content flows to sub-processors for email, AI, billing, analytics, error monitoring and messaging. Clients receive milestone emails and portal access; solicitors receive scoped, expiring links. Full diagram and access matrix in `DATA-FLOW-MAP.md`.

## 8. Storage locations
Database + file storage: **Supabase, EU region** [OWNER-CONFIRMED]. Compute: **Vercel, Dublin/EEA** [VERIFIED-CONFIG]; US company. Document buckets private, signed URLs [VERIFIED-CODE; private OWNER-CONFIRMED]. Transient AI processing: Anthropic & OpenAI, **US** [VERIFIED-CODE].

## 9. Sub-processors & international transfers
Disclosed on the privacy and DPA pages [VERIFIED-CODE]: Supabase (EU), Vercel (US entity/EEA compute), SendGrid/Twilio (US), Microsoft (mailbox region), Anthropic (US), OpenAI (US), Stripe (US), Google (US), Meta/WhatsApp (US), Upstash (EU), PostHog (EU), Sentry (region NOT-VERIFIED), Railway (EU, NOT-VERIFIED). **Transfer safeguards (SCCs/UK IDTA) asserted but NOT-VERIFIED contractually (Q3).** US transfers are real and ongoing (notably for all AI and for OpenAI receiving prospect PII).

## 10. AI processing & safeguards
20 AI features, all to US providers (Anthropic — Haiku 4.5 mainly, Sonnet 4.6/5, Opus 4.8; OpenAI — gpt-5.5 for outreach review). Advisory only; **no automated decisions with legal effect** [VERIFIED-CODE]. The client "explain email" tool has an agency off-switch **now enforced at the API** [VERIFIED-CODE]. Explain-email content is **not stored** by TSP. Several features send **unminimised third-party personal data** (pasted emails, uploaded documents, full client names). Provider no-training/retention terms are **NOT-VERIFIED (Q1 — material).** Full detail in `AI-PRIVACY-VERIFICATION.md`.

## 11. Authentication & access controls
NextAuth JWT sessions; bcrypt-12 passwords; shared password policy (min 10 + breach check) on every path; optional staff 2FA with secrets encrypted at rest; enumeration-safe reset; session revocation. Tenant isolation enforced in application code and independently re-verified — **no cross-tenant holes**; portal strictly minimised. Rate limiting **live in production** [OWNER-CONFIRMED]. DB row-level security **NOT-VERIFIED (Q2)**. Founder Command-Centre 2FA step-up bypass retained (owner-accepted). Detail in `SECURITY-AND-ACCESS-VERIFICATION.md`.

## 12. Encryption & security measures
TLS in transit (Vercel/Supabase/providers). At rest: Supabase managed encryption; app-level AES-256-GCM for OAuth/integration tokens and new 2FA secrets; bcrypt-12 passwords. Signature-verified webhooks (Stripe, WhatsApp); shared-secret inbound email (live); all cron jobs secret-gated. Sentry `sendDefaultPii:false`; PostHog masked/consent-gated/EU.

## 13. Retention & deletion
**Automated:** staff accounts anonymised after 3 years inactivity [VERIFIED-CODE]. **Manual (owner-confirmed):** 7-year transaction retention then deletion/anonymisation; client-contact erasure (by email, per agency); agency offboarding (reversible close / permanent purge); user export/delete; self-serve staff account delete. **Not implemented:** automated transaction/contact/document purge; `ConsentRecord` purge; self-service erasure/export for portal contacts. The DPIA must state the 7-year purge and contact erasure are **manual**.

## 14. Data-subject rights
Staff `User`: export + delete (superadmin + step-up) and self-serve account delete. Portal contacts (buyers/sellers/solicitors): can edit their own details in the portal, but **no self-service export or erasure** — rights are exercised via the agency (controller) and executed by superadmin tooling (`/api/gdpr/contact`). This is the processor-model posture (confirm intended).

## 15. Necessity & proportionality
Processing is necessary to deliver sales progression. Data minimisation is strong in most paths and in the portal; the main proportionality tension is the **unminimised third-party personal data** sent to US AI providers in a handful of features. Mitigations: advisory-only AI, no storage of explain-email content, the now-enforced off-switch, commercial-API integration. Proportionality turns partly on Q1 (provider terms).

## 16. Consultation undertaken / required
Internal assessment with the founder (sole decision-maker and appointed data-protection lead [OWNER-CONFIRMED]). Processors relied on via published terms (signed DPAs NOT-VERIFIED). Data subjects not individually consulted (standard for processor processing). ICO not consulted.

## 17. DPIA screening conclusion
A DPIA is **advisable/appropriate**: large-scale processing of multiple categories of individuals, confidential financial and legal information, innovative AI processing, and combination of data from several sources. No single Article 35 trigger is clearly mandatory at current scale, but the combination warrants a DPIA and demonstrates accountability.

## 18. Risk assessment
Full register in `FINAL-RISK-REGISTER.md` (15 risks, methodology stated). Highest residual: **FR1 — AI provider terms (High, resolvable via Q1)**. Medium residuals: retention (manual), unminimised AI inputs, account compromise, founder bypass, backups (unverified), special-category in free text, international transfers. No Critical residuals.

## 19. Existing verified mitigations
Tenant isolation (app-layer, verified); enforced AI off-switch; encrypted 2FA secrets; min-10 + breach-checked passwords; rate limiting (live); private signed-URL document storage; revocable portal links; signature-verified webhooks + secret inbound email; consent record; masked/consent-gated analytics; superadmin + step-up + audit on all destructive tools; published privacy policy, DPA, cookie policy and breach runbook.

## 20. Residual risks & outstanding actions
Resolve Q1 (Anthropic/OpenAI terms) and Q2 (Supabase RLS + backups). Confirm Q3 (provider DPAs), Q4 (Sentry masking), Q5 (Upstash/Railway regions), Q6 (superadmin 2FA format), Q7 (cookie SameSite). Recommended builds: consent endpoint rate-limit + record purge; portal privacy link on the main view; consider mandatory director 2FA and automated retention purge later.

## 21. ICO consultation considerations
On current evidence, prior consultation does **not** appear required, because no residual risk is assessed as High-and-unmitigable once Q1/Q2 are resolved. This is a legal judgement to confirm with a qualified adviser; if the AI provider terms (Q1) cannot be satisfied, re-assess FR1.

## 22. Evidence gaps & uncertainties
All NOT-VERIFIED items are consolidated in `OUTSTANDING-QUESTIONS.md` and `GDPR-COMPLIANCE-GAPS.md`. The two material ones: AI provider training/retention terms (Q1); Supabase RLS + backup testing (Q2).

## 23. Approvals & review triggers
Approver: Ellis Askey (founder, data-protection lead). Review annually or on any material change: new sub-processor, new AI feature, change of data region, or a personal-data breach. This pack should be re-run after Q1–Q7 are resolved.

## 24. Evidence / source index
- `FINAL-AUDIT-SUMMARY.md` — executive summary.
- `REMEDIATION-VERIFICATION.md` — status of every prior finding (R1–R14).
- `DATA-PROCESSING-INVENTORY.md` — personal data categories, storage, retention.
- `DATA-FLOW-MAP.md` — flows + access matrix + diagram.
- `AI-PRIVACY-VERIFICATION.md` — 20-feature AI inventory + enforcement verdicts.
- `SECURITY-AND-ACCESS-VERIFICATION.md` — auth, isolation, tools, logging.
- `FINAL-RISK-REGISTER.md` — FR1–FR15 with methodology.
- `GDPR-COMPLIANCE-GAPS.md` — categorised gaps.
- `OUTSTANDING-QUESTIONS.md` — Q1–Q7 unresolved items.
- Supporting (prior arc): `../DPIA.md`, `../RISK-REGISTER.md`, `../AI-PRIVACY-ASSESSMENT.md`, `../../BREACH-RESPONSE-RUNBOOK.md`, and the live pages `/privacy`, `/legal/dpa`, `/cookie-policy`.
