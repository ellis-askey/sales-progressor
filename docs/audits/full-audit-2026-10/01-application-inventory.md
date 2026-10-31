# Application Inventory — what TSP is made of

Compiled 2026-10-20 from direct inspection of the repository. Counts are from the actual route tree: **287 pages, 292 API endpoints, 46 scheduled background jobs**.

## 1. Surfaces (who uses what)

| Surface | Who | How they get in | Size |
|---|---|---|---|
| **Agent app** (`/agent/*`) | Estate agency directors and negotiators | Email + password login | 79 pages, ~58 endpoints |
| **Internal dashboard** (`/admin/*`, `/transactions/[id]`, hub) | TSP's own staff (admin, sales progressors) | Same login system, different role | shares agent hub |
| **Command Centre** (`/command/*`) | Founder only (superadmin) | Login + second security step (signed cookie, optional IP allowlist) | 64 pages, 22 endpoints |
| **Client portal** (`/portal/[token]`) | Buyers and sellers | Unguessable link emailed to them (no password) | 6 pages, 17 endpoints |
| **Solicitor portal** (`/s/[token]`) | Solicitors | Unguessable email link | 4 pages |
| **Mortgage advisor portal** (`/a/[token]`) | Mortgage brokers (buyer side only) | Unguessable email link | 1 page |
| **Boardwalk suite** (`/boardwalk/*`, `/f/*`) | Separate white-label forms/to-do product, own login system | Own session cookie system | 23 pages, 45 endpoints |
| **Public pages** | Anyone | n/a — marketing, legal, signup, claim-a-chain-link, quotes | ~35 pages |
| **Developer/test pages** (`/dev/*`, `/test/*`) | Supposed to be internal only | `/test/*` founder-gated; **`/dev/*` excluded from the login gate entirely** (see SEC-001) | 49 + 7 pages |

Note: there is **no solicitor or broker self-service account system** — both portals are email-link only. Solicitor/broker firm records in the agent app are reference data managed by agents.

## 2. Major functional systems

### Transactions and milestones
- 47 live milestone steps across seller (VM*) and buyer (PM*) sides, with a dependency graph, a derived "available/locked" state, and relist ("buyer round") scoping.
- One completion chokepoint (`completeMilestone`) that fires all side effects: unlocking dependents, cancelling chases/reminders, paired twin-step completion, exchange gate, client emails, billing stamp, chain notifications.
- Two different undo paths (full cascade undo vs simpler reverse) — **they do not behave identically** (see MILE-001).
- Exchange = VM19+PM26 (bilateral; confirming one completes both). Completion = VM20+PM27, auto-flips file status.
- Nightly reconcile job fixes locked-but-should-be-available steps (cannot complete skipped steps).

### Property chains
- Chain = spine of links plus up to 3 onward branches; links are either claimed (bound to a real TSP transaction) or stubs (placeholders with invite tokens, 60-day expiry).
- Claiming flow (`/claim`), self-linking own sale, insert/reorder (locked once others join), withdrawal cascade, remarketing, relist replay, chain split/detach.
- Cross-agency privacy: other agencies see address, agency name, claim status, progress %, aggregate chain value only — prices, contacts, notes, milestone detail stripped server-side.

### Automated communications (46 scheduled jobs)
- Central outbound email queue with atomic claim-before-send (safe against double-send), hourly drain.
- Client chase (flag-gated), solicitor chase, enquiries chases, exchange-day emails, morning digest, weekly briefs/updates, retention emails, chain invite nudges, withdrawal cascade drain, milestone confirm digests, booking reminders, prospect outreach.
- Email layer: tries the agency's own connected mailbox first, falls back to SendGrid; per-agency/file/contact/step pause switches; suppression on bounce/opt-out; sandbox mode.
- Inbound: Outlook/IMAP sync, SendGrid inbound reply capture (reply tokens), WhatsApp Cloud webhook ingest (passive; outbound WhatsApp is manual only).

### Billing (Stripe — real integration, currently switched OFF by flags)
- Agency per-sale fee stamped at exchange (self-managed now free; outsourced £250/£300/£350 by price band); first outsourced sale free offer; monthly invoice accrual + issuance; credit notes on reversal; 7-day grace then new-file block on failed payment.
- Progression business billing: £59 base + £39/seat subscription + £5/sale, plus the business's own client invoicing (off-Stripe PDF, per-client rate cards).
- Both charging crons are gated off (`BILLING_AUTO_ISSUE_ENABLED`, `PROGRESSION_BILLING_COLLECT`) — record-keeping only today.

### Multi-tenancy and access
- Agency users scoped by `agencyId`; internal staff (null agencyId) scoped via assignment or admin-wide; canonical helper `lib/security/access-scope.ts` used by ~46 endpoints/services.
- Progression businesses: separate scope branch, per-client-agency boundaries, private notes, TSP-vs-external wall.

### Other systems
- Enquiries tracker (2 milestones/side + raise/respond chases), predictions (exchange date forecast, bank-holiday-aware to end of 2028), property intel (Land Registry/EPC), prospects/outreach CRM, quotes, referrals ledger, analytics (PostHog, consent-gated), GDPR retention sweeps, file time tracking, demo files, Boardwalk Forms/To Do.

## 3. External services

| Service | Used for | Live? |
|---|---|---|
| Supabase | Database + file storage | Live (prod + staging projects) |
| SendGrid | Email send + inbound parse + bounce webhook | Live |
| Stripe | Billing (cards, invoices, subscriptions, webhook) | Integrated, charging flags OFF |
| Anthropic Claude | Chase drafting, content, insights | Live |
| Vercel | Hosting + 46 cron schedules + deploy webhook | Live |
| Land Registry / EPC | Property data | Live |
| Replicate (FLUX) | AI image generation (Command Centre) | Token pending — currently inert |
| Meta WhatsApp Cloud | WhatsApp capture | Built, dark (env not set) |
| Upstash Redis | Rate limiting | Pending, disabled |
| PostHog EU | Analytics | Pending key |
| Sentry | Error reporting | Live (write-only from app) |

## 4. Existing test coverage (summary — detail in coverage tracker)
- 68 Jest test files (strongest: tenant isolation, progression businesses, relist/chase scoping, email truthfulness, billing idempotency).
- 32 Playwright specs (login/role routing, cross-tenant isolation at HTTP level, smoke tests, gallery visual regression, screenshot capture).
- **No CI** — nothing runs any of these automatically (see PROC-001).
