# Agency readiness — Phase 3: inbound email ingestion (scope)

Status: scoping (2026-08-31). Decisions pending founder sign-off (see end).
Builds on Phase 1 (CC readiness) + Phase 2 (agent nudge), which cover OUTBOUND
(sending as the agency). Phase 3 covers INBOUND: getting replies to land on the
right property file, per agency, self-served.

## What exists today (grounded in a code deep-dive)

Three inbound paths exist; only one writes email onto property files:

- **Outlook Graph sync — the real one.** `OutlookConnection` (keyed by `userId`,
  `prisma/schema.prisma:2231`) stores encrypted tokens for a connected mailbox.
  `lib/integrations/outlook/sync.ts` reads recent Inbox mail and matches each
  message to a file by participant email (then folder name, then postcode in
  subject), writing an inbound `OutboundMessage` row stamped with the matched
  transaction's `agencyId`. An hourly weekday cron (`app/api/cron/outlook-sync`)
  runs it for every connection. Tenant safety is already correct: matching runs
  through `getAccessScope(session)`, so a director's sync only ever touches their
  own agency's files (`{ kind: "agency", agencyIds: [agencyId] }`).
- **WhatsApp bridge** — a single global internal device (Ellis's number),
  operated from the Command Centre. `WhatsAppConnection` exists but is an unused
  stub; there is no per-user or per-agency pairing. Out of scope (per-agency
  WhatsApp = per-agency numbers/bridges, a much larger build).
- **SendGrid Inbound Parse** — `app/api/webhooks/sendgrid-inbound` is wired only
  to the acquisition-CRM Prospects feature on one global host. It never touches
  property files. Reusable *pattern*, but net-new routing for files.

No per-file or per-agency inbound email address exists for property files today.

### Why a director can't self-serve Outlook today (only two blockers)

1. The connect + callback routes hardcode a redirect to
   `/command/settings/connections` — a superadmin page. A director completes the
   OAuth handshake (the routes admit non-viewers) but dead-ends on a page they
   can't see.
2. There is no agent-app surface to start or manage the connection. The only UI
   is the Command-Centre `OutlookConnectionCard` (dark tokens, Law 9 forbids
   reuse on the cream agent app).

Everything else (per-user connection model, per-agency match scoping, file
writing, dedup, the cron) already works.

## Two architectures for per-agency self-serve email ingestion

**A. Outlook whole-inbox connect (reuses ~everything).**
A director/negotiator connects their Microsoft mailbox once; matching emails are
auto-captured onto files. Least build: reuse the existing sync, matcher, file
writer, cron, and APIs; add an agent settings surface + fix the redirect.
Trade-offs: whole-inbox read access (heavier DPA), Microsoft-only, pull/cron not
real-time.

**B. Per-file forwarding address (net-new, lighter privacy).**
Each file (or side) gets an address like `file+<token>@in.thesalesprogressor.co.uk`;
the agency forwards/BCCs solicitor emails to it and they land on the file. No
inbox access (lighter DPA), provider-agnostic. Trade-offs: net-new inbound
routing + per-file token addressing + a second Inbound Parse host; relies on the
agency actively forwarding (more friction, less "magic").

**Recommendation: A (Outlook), because the matcher, file-writing and cron already
exist** and tenant-scoping is already correct — Phase 3 becomes "surface it to
agents + make it visible," not "build ingestion." B is a cleaner privacy story
but is a from-scratch pipeline.

## Proposed plan (assuming path A)

1. **Make connect agent-usable.**
   - Redirect: replace the hardcoded `/command/settings/connections` with a
     surface-aware return path (carry a signed `returnTo` in the already
     user-bound OAuth state), so a director lands back in the agent app.
   - New agent surface: a **"Connections" tab in the Account area**
     (`app/(account)/agent/account/connections/`), beside Profile / Team /
     Notifications / Billing. A cream/glass connection card (new, not the CC dark
     one) over the existing `status` / `connect` / `sync` / `disconnect` APIs
     (all already per-user + agency-scoped). Gate to the chosen audience.
2. **Add sync-state to `OutlookConnection`** (small migration, staging first):
   `lastSyncedAt`, `lastSyncStatus`, `lastError`, `lastMatchedCount`. The cron
   already computes these and discards them; persisting them turns "is inbound
   working" into a direct read and enables a real health badge.
3. **Extend Phase 1 (CC readiness)** with a third per-agency item, "Inbound
   email connected": green = a user in the agency has a healthy connection with
   mail landing; amber = connected but token/sync failing; grey = none. Derived
   by rolling `OutlookConnection` up via `User.agencyId` + recent inbound
   `OutboundMessage` counts.
4. **Extend Phase 2 (agent nudge)** with a matching step/prompt for the chosen
   audience: "Connect your email inbox so replies land on your files."

## Hard prerequisites (gate the BUILD, not the scope)

These are founder/infra tasks without which path A cannot go live, already in
`docs/active/ELLIS_MANUAL_TODO.md` and currently PENDING:

- Microsoft OAuth env vars (`MICROSOFT_CLIENT_ID/SECRET/TENANT_ID/REDIRECT_URI`)
  set in Vercel + local, and the redirect-URI domain mismatch (apex vs
  `portal.`) reconciled or OAuth fails.
- **DPA / privacy review for mailbox content at rest** — a genuine go-live
  blocker for whole-inbox access. This is the single biggest reason to weigh
  path B.

We can build the seam so it works the instant these are cleared (mock-first,
Law 13), or hold until DPA is resolved.

## Decisions pending

1. Architecture: A (Outlook connect) vs B (forwarding address) vs both.
2. Audience: directors only vs all agency users (directors + negotiators).
3. Health: add the `OutlookConnection` sync-state migration (recommended) vs
   derive from message counts only (no migration).
4. Sequencing: build the seam now (works once env + DPA cleared) vs scope-only
   until DPA is resolved.
