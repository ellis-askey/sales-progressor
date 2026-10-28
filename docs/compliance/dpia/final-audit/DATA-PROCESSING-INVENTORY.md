# Personal Data Processing Inventory

**Date:** 28 October 2026. Evidence classes in brackets. "Stored" = persisted by TSP (not merely transmitted).

## Categories of individuals
- Estate-agency staff (director, negotiator) — account holders.
- Independent progression-business owners/members.
- TSP internal staff (sales_progressor, admin, superadmin).
- Buyers and sellers (portal contacts).
- Solicitors / conveyancers and mortgage brokers (directory + portal contacts).
- Prospective agencies (outreach targets).

## Personal data categories

| Category | Examples | Source | Purpose | Stored where | Who can access | Retention | Special-category risk |
|---|---|---|---|---|---|---|---|
| Identity & contact | Names, emails, phones | Staff entry, portal, mailbox, migration | Progress a sale, communicate | Postgres (Supabase, EU) | Scoped by role/agency; the client sees only their own | Manual (policy 7y post-completion) | Low, but free-text could include more |
| Property & transaction | Address, price, tenure, method, milestone dates, chain | Staff/portal | Core service | Postgres | Agency scope / assigned staff / client's own | Manual | Low |
| Financial / mortgage | Price, deposit, mortgage status, fees | Staff/portal | Progression | Postgres | Agency scope | Manual | Sensitive-adjacent |
| Correspondence | Emails (connected mailbox), WhatsApp, portal messages, internal notes, enquiries | Mailbox sync, WhatsApp, portal | Coordination | Postgres; media in `whatsapp-media` (private) | Agency scope; client sees own-side only | Manual | Possible in free text |
| Documents | Contracts, memos, searches, surveys, management packs, possibly ID | Staff/portal upload | Conveyancing | Supabase Storage `transaction-documents` (private, signed URLs) [OWNER-CONFIRMED private] | Ownership-scoped + signed URL | Manual | Yes (ID, financial) |
| Account & security | Hashed passwords (bcrypt-12), 2FA secrets (encrypted/at-rest), sessions, OAuth login ids | Sign-up / sign-in | Auth | Postgres | The user; superadmin tooling | On anonymisation / deletion | N/A |
| Analytics | Masked, consent-gated product events | App usage | Product analytics | PostHog (EU) [VERIFIED-CODE] | Internal | PostHog policy | Masked |
| Consent records | analytics choice + IP + user-agent (+ userId if logged in) | Cookie banner | Audit of consent | Postgres `ConsentRecord` | Internal | **No purge (NOT-IMPLEMENTED)** | IP/UA are personal data |
| Payment / billing | Billing contact, Stripe customer id (no card numbers held by TSP) | Billing | Charge agencies | Postgres + Stripe (US) | Internal | Retained (financial records) | N/A |
| AI inputs/outputs | Pasted emails, uploaded docs, drafts, transcripts, client names (per feature) | Staff/portal | AI assistance | **Mostly not stored by TSP** (see AI-PRIVACY-VERIFICATION); inbound-AI-read summary IS stored | Transiently at provider (US); output to requester | Provider retention NOT-VERIFIED | Yes (unminimised in several features) |
| Prospect data | Estate-agency contact/research data | Outreach engine | Marketing | Postgres | Superadmin | Research retention | Third-party PII to US (OpenAI) |
| Technical identifiers | IP, user-agent, error diagnostics | Requests, Sentry | Security, debugging | Sentry (region NOT-VERIFIED); logs | Internal | Provider policy | IP is personal data |

## Controller / processor split
- **Processor** (TSP) for agency client data; the agency / progression business is the **controller**. DPA at `/legal/dpa`.
- **Controller** (TSP) for its own account-holder, staff, prospect, analytics and consent data.

## Storage locations (summary)
- Primary database + file storage: **Supabase, EU region** [OWNER-CONFIRMED].
- Compute/hosting: **Vercel, Dublin (EEA)** [VERIFIED-CONFIG `vercel.json`]; US company.
- Transient AI processing: **Anthropic & OpenAI, US** [VERIFIED-CODE endpoints].
- Email: SendGrid (US). Analytics: PostHog (EU). Errors: Sentry (region NOT-VERIFIED).

## Retention & deletion (reality)
- **Automated:** staff `User` accounts anonymised after 3 years inactivity (`app/api/cron/data-retention`) [VERIFIED-CODE].
- **Manual (owner-confirmed):** 7-year transaction/contact/document purge; erasure of a specific client contact (`/api/gdpr/contact`); agency offboarding (`/api/command/agencies/[id]/offboard`); user export/delete (`/api/gdpr/export`, `/api/gdpr/delete`); self-serve staff account delete.
- **Not implemented:** automated transaction/contact/document purge; purge of `ConsentRecord`; self-service erasure/export for portal contacts.
