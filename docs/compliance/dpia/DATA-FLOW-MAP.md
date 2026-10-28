# Data Flow Map — The Sales Progressor

**Companion to:** `DPIA.md` · **Date:** 27 October 2026 · **Owner:** Ellis Askey

This explains, in plain English, where personal information comes from, where it goes, who can see it, and which outside companies receive it. Technical evidence (file paths) is noted so the claims can be checked.

---

## 1. Where data comes in (sources)

| Source | What it brings in | Who enters it |
|---|---|---|
| Agency staff / internal team | Sale details, parties, notes, documents | Directors, negotiators, internal progressors |
| Client portal | Document uploads, milestone confirmations, the "explain email" tool | Buyers and sellers (token link, no login) |
| Connected mailbox | Inbound emails relating to a sale (Outlook or IMAP) | Automatic, once a staff member connects their inbox |
| WhatsApp | Client messages and media | Via the official WhatsApp Business API (when enabled) |
| Migration template | Existing live sales during onboarding | Processed by our team from a completed spreadsheet |
| Public data | Property price history, energy data | Automatic look-ups (no personal data) |

---

## 2. Where data is stored (at rest)

| Store | Contents | Privacy | Location |
|---|---|---|---|
| Database (Supabase Postgres) | All structured data: people, sales, messages, notes | Encrypted at rest; isolation enforced in the application | EU |
| File storage (Supabase) — `transaction-documents`, `whatsapp-media`, `form-uploads`, `feedback-screenshots` | Contracts, ID, searches, surveys, client uploads, message media | **Private** — served only via short-lived signed links after an ownership check | EU |
| File storage — `avatars`, `signatures`, `*-logos` | Profile photos, email-signature images, firm logos | **Public** (accepted decision; low-sensitivity) | EU |

Isolation note: one agency, buyer, seller or solicitor cannot reach another's data. This is enforced in the application code (access-scope helper, `lib/security/access-scope.ts`) and was verified across the transaction, contacts, documents, portal and solicitor surfaces.

---

## 3. Who can see what (internal access)

| Role | Sees |
|---|---|
| Negotiator | Their own files by default; every file if a director enables "see all" |
| Director | Every file in their agency |
| Internal progressor | Files assigned to them, plus the unassigned pool |
| Admin | All TSP-progressed files |
| Superadmin (founder) | Everything, via the Command Centre (extra protection) |
| Buyer / seller | Only their own sale, strictly minimised (cannot see the other party's contacts or internal notes) |
| Solicitor | Only their own instructed file, via a signed, expiring link |

---

## 4. Where data goes out (sub-processors and transfers)

| Company | Purpose | Personal data sent | Location | Transfer safeguard |
|---|---|---|---|---|
| Supabase | Database + file storage | All app data | EU | Within EEA |
| Vercel | Hosting / compute | All app traffic | Compute in Dublin (EEA); US company | SCCs / UK IDTA |
| Anthropic | AI: email explainer, chase drafting, inbound-email reading | Correspondence content (chase is minimised; explainer is not) | US | SCCs / IDTA; no training; content not stored by us |
| SendGrid (Twilio) | Sending and receiving email | Recipient details, email content | US | SCCs / IDTA |
| Stripe | Billing / card payments | Billing contact, card data (direct to Stripe) | US / global | SCCs / IDTA |
| PostHog | Product analytics | Masked, consent-gated events | EU | Within EEA |
| Sentry | Error monitoring | Technical errors; personal data auto-capture off | Per DSN | SCCs / IDTA if US |
| Microsoft (Graph) | Connected Outlook mailbox | Email content for matched sales | Per mailbox region | SCCs / IDTA |
| Google | Staff sign-in | Login identifiers | US | SCCs / IDTA |
| Meta (WhatsApp Cloud API) | Client messaging | Message content | US / global | SCCs / IDTA |
| OpenAI | Internal marketing tool only (not client transaction data) | Prospect/outreach context | US | SCCs / IDTA |
| Upstash | Rate limiting | IP / token fragments | Per URL | SCCs / IDTA if US |
| Railway | Hosts the older WhatsApp capture bridge | Message content (that path) | EEA | Within EEA |

OpenAI, Google and Meta WhatsApp Cloud are included in the published sub-processor list (privacy page and DPA Schedule B).

---

## 5. The AI data path (called out because the client asked)

1. A client pastes an email into the portal "explain email" tool (up to 8,000 characters).
2. The text is sent from our server to Anthropic's commercial API (US), model `claude-haiku-4-5`.
3. Anthropic returns a plain-English explanation.
4. We **do not store** the pasted text or the explanation; we record only that the feature was used.
5. Anthropic does not use business-API content to train models and processes it only transiently.

Full detail in `AI-PRIVACY-ASSESSMENT.md`.

---

## 6. Where data is deleted (end of life)

- **Staff accounts:** inactive staff logins are automatically anonymised after 3 years (verified job).
- **Client transaction data and documents:** retained 7 years after completion per policy, then deleted or anonymised through a documented manual process (owner: Ellis). Erasure requests from a client are handled through the same documented process.
