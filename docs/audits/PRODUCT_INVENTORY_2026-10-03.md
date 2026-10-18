# Sales Progressor (TSP) — Product Inventory & Capability Map

**Purpose:** A factual, codebase-substantiated inventory of everything the product currently supports, for competitive market-positioning. Written to be consumed by another AI comparing TSP against competitors. Nothing here is inferred from "it sounds logical" — every capability is backed by code, schema, or spec evidence.

**Generated:** 2026-10-03, from a full-codebase audit (branch `staging`).

---

## How to read this document

**Status legend:**

- **LIVE** — wired end-to-end to the real data layer, routes exist, used in production code paths. (Note: a few LIVE features depend on an env var/key being set in the live Vercel environment — these are called out as "needs `X`". The code is complete; only the external credential governs whether it does real work.)
- **PARTIALLY IMPLEMENTED** — built and wired, but gated by an admin switch or flag that is off by default, limited in scope, or has a known divergence from its own spec.
- **IN DEVELOPMENT** — code present but dark-launched behind a flag with no spend/effect until switched on, OR a seam/capture-only mechanism with no read surface yet.
- **PLANNED / TODO** — documented or stubbed, not functionally built.

**Two product surfaces — important context:**

1. **The customer product** — `/agent/*` (estate agency staff) and `/portal/[token]` (buyers/sellers). This is what agencies and their clients use.
2. **The Command Centre** — `/command/*`, **superadmin-only** (founder/internal). This is TSP's own internal operations + growth + acquisition console (prospect CRM, AI outreach, content studio, insights). Agencies never see it. Several of the most sophisticated AI systems live here but are *internal tooling*, not customer features.

**Pricing reality-check (correction to common assumption):** The code's single source of truth (`lib/billing/fee.ts`) shows **self-managed / self-progression is now FREE** — the £59 self-managed fee has been *retired* (historical invoices keep their frozen £59, nothing new is charged). The live paid tier is **outsourced progression**, charged on a sliding scale by sale price: **£250** (≤£349,999) / **£300** (£350k–£499,999) / **£350** (≥£500k). Do not describe self-managed as a £59 paid tier.

---

## 1. Platform architecture & surfaces

**Tech stack:** Next.js 16 (App Router), TypeScript strict, Prisma ORM over Supabase Postgres, NextAuth (JWT), SendGrid email, Anthropic Claude + OpenAI, Vercel hosting + cron, Supabase Storage, Stripe billing. ~130 Prisma models.

Logged-in users are split across distinct visual surfaces that never share layout shells:

| Surface | URL | Roles | Visual system |
|---|---|---|---|
| Marketing site | public | Public | Dark navy + coral |
| **Agent app** | `/agent/*` | director, negotiator — AND all internal staff run inside this same app | Warm cream + coral + glass; WebGL animated background ("Elevra" Iridescence/SoftAurora) |
| Internal dashboard (`AppShell`) | legacy | admin, sales_progressor, superadmin | Dark photo backdrop + glass — **now effectively legacy**; `/dashboard` and `/admin` redirect into the agent app / Command Centre |
| **Command Centre** | `/command/*` | superadmin only | Utilitarian dark, hairline borders, blue accent, no glass |
| **Client portal** | `/portal/[token]` | Token-authenticated visitors | Light, mobile-first, "Elevra" glass theme |

**Key architectural fact:** Internal staff (admin, sales_progressor, superadmin) do **not** use a separate app. They run inside the same `/agent/*` agent app, differentiated only by a *visibility mode* resolved per-session. The old standalone internal dashboard routes are now redirects. (Evidence: `lib/services/agent.ts`, `app/dashboard/page.tsx`, `app/admin/page.tsx`.)

---

## 2. User roles & permissions

Six roles defined (`prisma/schema.prisma` `UserRole` enum). Verified capabilities:

| Role | Who | agencyId | What they can do | Status |
|---|---|---|---|---|
| **director** | Agency owner | Yes | Full agency-scoped file access; invite/remove/reinstate negotiators; set per-negotiator "see all files" vs "see own"; approve/reject join requests; billing (director-only); edit agency email copy + portal display settings | LIVE |
| **negotiator** | Agency day-to-day staff | Yes | Agency-scoped, further gated by `canViewAllFiles`; can invite a director only if agency has none; can self-promote to director only if zero directors exist | LIVE |
| **sales_progressor** | TSP internal progressor OR external progression-business member | No (null) | Sees only files assigned to them (`assignedUserId`); carries no platform power by itself | LIVE |
| **admin** | Internal staff | No (null) | Sees every TSP-progressed file platform-wide; assign a progressor to an agent; set client fee tier | LIVE |
| **superadmin** | Founder | No (null) | Everything admin can do + the Command Centre (behind 2FA step-up + IP allowlist + signed cookie) | LIVE |
| **viewer** | Parked/read-only state | varies | Net-new OAuth users pre-signup, pending join-requesters, and soft-removed team members; blocked from ALL mutating API calls | LIVE |

**Multi-tenancy model (LIVE, security-critical):** A single `getAccessScope(session)` helper (`lib/security/access-scope.ts`) returns one of four scopes — `agency` (director/negotiator/viewer → their one agency), `assigned` (TSP progressor → own assigned files), `business` (external progression-business member → their business book), or `all` (admin/superadmin → no agency filter, but still restricted to TSP's own files, never an external business's). Query builders (`scopeTransactionWhere`, `scopeOwnershipWhere`, `scopeChaseTaskWhere`, `scopeReminderLogWhere`) enforce it on every multi-tenant read/write. Internal "all" scope also excludes demo files. Has a dedicated test suite.

**Hybrid-role mechanism (LIVE, sophisticated):** An edge-safe email allowlist grants the founder admin/superadmin powers *while keeping* `role = sales_progressor`, so the daily progressor UX stays intact; this hybrid identity bypasses the Command Centre 2FA step-up by product decision.

**Row-Level Security seam (PARTIALLY IMPLEMENTED):** `lib/prisma-rls.ts` (`withAgencyRls`) wraps queries to set a Postgres session agency id, but strict RLS policies are **not active** (staging bypass policy `USING (true)` is live) — so the wrapper is currently a security no-op. Call sites are pre-wired so flipping to strict enforcement needs zero code change.

---

## 3. Authentication & security

- **Auth (LIVE):** NextAuth JWT strategy. Providers: email+password (bcrypt), Google OAuth, Azure AD OAuth. OAuth uses `allowDangerousEmailAccountLinking` on both.
- **Two-factor (TOTP) (LIVE):** Enforced at login once enrolled; accepts TOTP code or a one-time backup code (consumed on use). Enroll → QR, enable → backup codes, disable → requires password. A `loginPrecheck` tells the form whether to ask for a code without signing in.
- **Session versioning / "sign out all devices" (LIVE, sophisticated):** Incrementing `User.sessionVersion` invalidates all existing JWTs; the per-request jwt callback re-reads the DB so a visibility toggle (e.g. owner grants "see all files") takes effect on the member's next page load without re-login. Fail-open on DB blip so a transient error can't lock everyone out.
- **Deactivated-user lockout (LIVE):** `deactivatedAt` refuses both credentials and OAuth login.
- **Command Centre step-up auth (LIVE, sophisticated):** Separate HMAC-SHA256-signed cookie verified in Edge middleware via Web Crypto; 30-min step-up / 8-hr idle / 24-hr hard-max windows; optional IP allowlist; encrypted TOTP secret; failure rate-limiting via audit-log counts.
- **Rate limiting (IN DEVELOPMENT / off):** Full Upstash-Redis limiter suite exists for auth/signup/AI/email/portal/invite paths, but is **feature-flagged off** — returns PASS (no-op) unless `RATE_LIMIT_ENABLED=true` + Upstash creds are set.
- **Known gap:** **Email change has no verification** — `updateProfileAction` writes a new login email directly to `User.email` with only an in-form warning; no re-verification token.
- **Error monitoring:** Sentry wired (`@sentry/nextjs`).

---

## 4. Onboarding & signup

| Flow | What it does | Status |
|---|---|---|
| New-agency signup | `POST /api/register` atomically creates Agency + director User, captures first-touch UTM attribution, fires welcome email, converts matching outreach prospect | **LIVE** |
| OAuth signup completion | Net-new OAuth users land as no-agency viewers → `/signup/complete` → create agency (or progression business) | **LIVE** |
| Director invitation | Negotiator-only, allowed only when agency has no director; 32-byte token, 7-day expiry | **LIVE** |
| Negotiator invitation | Director-only; token-based, resend/cancel; anti-enumeration on internal-staff emails | **LIVE** |
| Self-promotion to director | Negotiator-only, blocked if any director already exists (escalation safeguard) | **LIVE** |
| Team member management | Director-only: toggle see-all/see-own, edit, soft-remove (role→viewer + deactivate, row kept for history), reinstate | **LIVE** |
| **Request-to-join by verified domain** | Signup email domain matched against agency-owned verified domains → routes into a join request for director approval; nightly expiry sweep | **IN DEVELOPMENT** — code complete + tested, flag `SIGNUP_JOIN_REQUESTS_ENABLED` **off by default** |
| **Invite-to-move** | Invite an existing account to move into your agency; auto-move only if their current agency is solo with zero sales, else records a hand-migration request | **IN DEVELOPMENT** — flag `MOVE_INVITES_ENABLED` **off by default** |
| **Independent progression-business signup** | `accountType=progressor` creates a bounded ProgressionBusiness + owner; full client-agency + team management (invite/remove, see-all/see-own, rate cards) | **IN DEVELOPMENT** — flag `PROGRESSION_BUSINESSES_ENABLED` **off by default** (security boundary is NOT flag-gated — hardened before switch-on) |

---

## 5. Sales progression — the milestone engine (core product)

The heart of the product. A state machine over a static catalog of **20 vendor (VM1–VM21)** + **27 purchaser (PM1–PM27)** milestone definitions, each with side, order, weight, and `blocksExchange`.

**State machine (LIVE):** Each milestone on a file is a `MilestoneCompletion` row in one of four states — `locked`, `available`, `complete`, `not_required`. Transitions:
- `locked → available` via `unlockDirectDependents()` when all direct prerequisites are complete/not-required.
- `→ complete` via `completeMilestone()` with **first-writer-wins concurrency** (conditional `updateMany` + P2002 catch) to survive double-clicks and connection-pool races.
- `→ not_required` manually (allow-listed) or automatically by transaction type.
- Undo (`reverseMilestone`) recomputes each reversed row's state from surviving prerequisites and re-locks orphaned dependents.
- Exchange gates (VM18/PM25) are special — driven by dedicated gate-unlock/lock logic, not the prerequisite map, with a hard `EXCHANGE_GATE_LOCKED` guard at the single completion chokepoint.

**Transaction-type variants (LIVE):** `lib/milestone-auto-nr.ts` is the single source of truth for which milestones auto-mark not-required:
- Freehold → management-pack steps (VM8, VM9, PM12) not required.
- Cash buyer / cash-from-proceeds → mortgage steps (PM5, PM6, PM11) not required.
- Cash-from-proceeds → additionally deposit step (PM24) not required.
Applied at file creation, on the claim path, and on sale-detail edits (cascading).

**Weights & progress (LIVE):** Progress = sum(complete weights) / sum(applicable weights), excluding not-required. Per-round enquiry sub-steps (VM11–15, PM15–19) are retired to weight 0, hidden and never created on new files (weight concentrated on the enquiry open/satisfied milestones).

**Bidirectional VM↔PM reflection (LIVE, sophisticated):** Four milestone pairs complete together through a single chokepoint, so buyer-side and seller-side trackers can never desync across any confirm path (agent / solicitor / portal / API / chase / reconciliation): contract pack (VM7↔PM7), enquiries raised/received (PM14↔VM10), enquiries satisfied (PM20↔VM21), exchange/completion (VM19↔PM26, VM20↔PM27). A client/solicitor confirm attributes the mirrored half to the file's overseer, never to the confirming party.

**Confirmation paths (all LIVE):**
- **Agent recording** — Steps tab, bulk complete, reminders "Done", work-queue, next-action card. Captures optional event date, surveyor/valuer name, key-collection flag.
- **Client portal confirm** — records exact confirming contact ("Lucy on behalf of Mrs Ayres"); hard-blocks 8 agent-only codes (exchange/completion/enquiries-satisfied) server-side.
- **Solicitor confirm** (`/s/<token>`) — solicitor confirms or gives an expected date/note; uses solicitor-voice sentence templates; fires the same client emails as an agent confirm.
- **Provisional booking two-phase confirm (LIVE, sophisticated):** a buyer confirming valuation (PM6) or survey (PM9) shows complete to them but *holds all outbound email* until the agent confirms the real date; surfaces on the hub "surveys & valuations to confirm" pile; release records date + key-collection and sends outcome-variant emails (confirmed / desktop / silent).

**Reconciliation mechanisms (LIVE):**
- **Reconcile-at-exchange** — confirming exchange sweeps all outstanding same-side blockers to complete with per-step dates, then confirms the gate + bilateral counterpart.
- **Reconcile-on-claim** — claiming a chain link "already in progress" bulk-reconciles milestones with "recorded on claim" provenance and excludes the file from velocity metrics.
- **Nightly unlock self-heal (PARTIALLY IMPLEMENTED)** — a real production bug was found where the VM7↔PM7 reflection skipped the unlock cascade when the counterpart was already complete, stranding steps as locked forever. A pure `computeReconcileUnlocks` + nightly cron (02:00 UTC) now flips stranded locked→available. **Deferred:** the admin "recompute step states" button and live alerting — so there is up-to-24h lag and no real-time observability.

**Expected-days / duration tracking (PARTIALLY IMPLEMENTED):** A hardcoded per-milestone day-count median table drives a phase-aware exchange forecast (parallel enquiry/contract/leasehold tracks, max-of). A "X days slower than typical" slowness badge exists but is **gated off** (`MEDIANS_READY = false`) until ~50+ completed files let the medians be replaced with learned values. The grace-days-based *staleness* badge is live.

**Milestone email copy & overrides (LIVE, sophisticated):** Default copy lives in code (`lib/portal-copy.ts`) per code, per recipient (vendor / purchaser / vendorAgent / progressor), with desktop-valuation variants. A **three-tier override system** layers on top: agency override → Sales-Progressor default override → code default, with most-specific-scenario-wins scoring (tenure +2, method +1). Agencies edit their layer; the Command Centre edits SP defaults. An audit of what's sent across the whole transaction-type matrix is maintained (the `CLAUDE.md` email matrix: 46 client-facing milestones, 85 distinct variants).

**Hidden capture infrastructure:** `MilestoneAvailabilityEvent` append-only logs every availability transition with a cause enum — capture-only, no product surface reads it yet.

**Spec-vs-code divergences to be aware of** (the shipped code is the truth, the spec docs are partly stale): PM7 has no prerequisites in code (money-on-account gate moved to PM8); manual not-required allow-list is broader than spec; enquiry sub-steps are retired; VM21 exists in code but not the vendor spec list.

---

## 6. Checkpoints (the "Tasks" feature) — LIVE

A per-file list of nuanced conditions that must be confirmed before exchange — e.g. the picklist's literal first item is **"Probate granted."**

- Each checkpoint has an audience (`none` / `vendor` / `purchaser` / `both`), an optional target date, and a **"Must be done before exchange"** flag.
- **Exchange-gate integration (sophisticated):** any open `blocksExchange` checkpoint holds the exchange gate shut on **both** sides until all required parties confirm; required parties are derived from the audience.
- Agents create/confirm/nudge/remove on the file Overview ("Checkpoints" card); buyers/sellers confirm their side via the portal ("Things to confirm"); a nudge fires a web-push.
- Backed by `Checkpoint` + `CheckpointConfirmation` (one row per confirming party). Fully shipped, no flags/mocks.

(Note: there is no model literally named `Task`; "Checkpoints" is the feature. Separately, internal/agent "to-dos" exist — see the agent-app To-Do surface in §7 — covering agency tasks, progressor inbox, internal self-assigned, and reviews-due.)

---

## 7. Agent app & dashboards — LIVE

Every surface below is in `/agent/*`. Access varies by role; content reshapes per role via the visibility resolver.

**Navigation / shell:** Sidebar built by role + flag gates. PWA install (manifest + service worker), custom brand-colour theming injected as inline CSS, pre-hydration theme boot, WebGL animated background. Founder-only nav items ("Focus" cockpit, Command Centre link) gated by literal email.

**Dashboards & work surfaces:**

| Surface | What it does | Access | Status |
|---|---|---|---|
| **Hub** (`/agent/hub`) | The pipeline home: time-aware greeting, diary, an "Attention" section (unassigned files, relists to acknowledge, chain setup pending), triage cards (bookings to confirm, stalled enquiries, needs-filing, mortgage offers expiring, gone-quiet, reviews due), pipeline stages, pipeline-health heatmap, wins-this-month, exchange forecast with sparkline, service-split donut, activity ribbon | All roles | LIVE (per-section Suspense streaming architecture) |
| **Reminders** (`/agent/work-queue`) | What needs chasing, split into Needs-you / Coming-up / On-autopilot piles; autopilot split reads client-chase + solicitor-chase pipeline flags | Self-managing agencies + internal (hidden for admin) | LIVE |
| **Files list** (`/agent/transactions`) | "My Files"/"All Files"; status tabs filter client-side for instant switching; hub/month filters narrow server-side; gone-quiet + missing-solicitor overlays; **Map view** (see §11) | All roles | LIVE |
| **Focus cockpit** (`/agent/focus`) | "What to work on next," ordered by last human contact | **Founder-only** (literal email) | LIVE |
| **Enquiries triage** (`/agent/enquiries`) | Triage enquiry emails; detects whether a mailbox is connected to decide one-tap vs manual log | admin/SP/superadmin/director/negotiator | LIVE |
| **Completions** (`/agent/completions`) | Files grouped by completion urgency, momentum, timeline | All roles | LIVE (a "setup guide" sub-card is hard-disabled → IN DEVELOPMENT) |
| **To-Do** (`/agent/to-do`) | Merges agency tasks + progressor inbox + internal self-assigned + reviews-due + no-comms files | All (hidden for admin) | LIVE |
| **Updates** (`/agent/comms`) | Day-bucketed activity/notifications feed; marks the nav bell read | All roles | LIVE |
| **Automated emails** (`/agent/automated-emails`) | Pending / sent / errored / 14-day upcoming forecast of client emails; needs-attention, coverage, chase-performance, email-health panels | All (role-scoped) | LIVE |
| **Chains** (`/agent/chains`) | Chain workspace (see §10) | Internal + self-managing agencies + allowlist | LIVE |
| **Analytics** (`/agent/analytics`) | Solicitor exchange stats, monthly activity, KPI trends, files-at-risk, referral stats | All (role-scoped) | LIVE |
| **Partners** (`/agent/partners`) | Solicitor + broker directories with exchange/referral performance; recommended-solicitor + preferred-broker settings | All (role-scoped) | LIVE |

**The transaction/file page (LIVE, sophisticated perf architecture):** A 2026-09-20 overhaul split the former single page (which fired ~9 queries at once and saturated the DB pool) into a **persistent layout shell + one route segment per tab** — the shell (hero, milestone strip, sidebar, banners) mounts once and never re-fetches on tab switch; only the active tab streams. The actual tabs:

1. **Overview** — overview panel + enquiry tracker + Checkpoints card + mortgage-expiry card
2. **File setup** — setup checklist (position demotes after 14 days)
3. **Steps** — the milestone tracker with real party names
4. **Reminders** — the chase pipeline scoped to this file
5. **Chain** — inline chain view (live-polling reconciliation)
6. **Chase timeline** — gated (founder / own self-managed files / external-progressor files)
7. **To-Do**
8. **Documents**
9. **Activity** — comms timeline + compose email (resolves verified sender identity)
10. **WhatsApp** — **internal-team only, never on an external progression-business file**
11. **Client portal** — read-only preview of exactly what the client sees

**Dev/preview scaffolding (IN DEVELOPMENT):** `/agent/polish/*`, `/agent/audit/*` (internal-staff-gated design/QA previews), plus `hub-preview`, `analytics-preview`, `anim-preview`, `system-preview`.

---

## 8. Client portal (buyer/seller) — LIVE

Token-authenticated, mobile-first, no login.

**Access & security (LIVE, sophisticated):**
- Per-contact unguessable UUID token (`/portal/[token]`); middleware lets it through with no session.
- Eligibility gate (`portalEligible`) on top of the token.
- **Dead-round guard (sophisticated):** when a sale falls through and relists, the superseded buyer's token is deliberately *not* rotated — instead the round mismatch is detected and the link shows a friendly "this sale is no longer active" notice. Writes are independently re-guarded per-action (defence in depth).
- Round/side privacy scoping: a buyer sees only their buyer-round's rows; vendors see file-level + the active round.
- Property photos and documents served as 1-hour signed URLs.

**What a client sees:** a weighted progress ring + 6-stage tracker + full swipeable milestone list (other side read-only); an "Updates" timeline with "new since your last visit" markers; key dates + add-to-calendar `.ics` export; property info + photo; documents (round-scoped, including docs the other side chose to share); a "Your team" card (progressor, solicitor, broker, neighbouring chain agent) with email/vCard actions; buyer costs/stamp-duty card; survey + broker quote cards.

**Client actions (LIVE):** confirm/skip steps; upload documents + avatar; request survey/broker quotes; email their team; edit their details/solicitor; fill move info; **customise overview card order/visibility**; set appearance/accessibility; enable push notifications; give authority.

**Multi-file switcher (LIVE, sophisticated):** When one person (matched by case-insensitive email) is a buyer/seller on 2+ files **with the same agency**, the menu drawer lists their other properties with thumbnails + Buying/Selling pills and lets them hop between portals.

**Chase respond link (LIVE):** the deep-link target from chase emails reads live chase state (ignores the URL `?items=` param so link-prefetchers can't false-fire); a bare page load records nothing, engagement only bumps on a real action. (Copy there is marked DRAFT.)

**Theming engine (LIVE, sophisticated / mostly hidden):** An Elevra-derived glass system with ~30 variants (families: baseline, density, Apple-liquid, tinted, bordered, decorative, bespoke — including an iridescent sheen variant). Ambient peach/lavender/cyan wash with a dark variant. Accent-driven glows follow the client's chosen accent. Clients get appearance/accessibility controls (theme, text size, 5 accent swatches, reduce-motion, high-contrast, dyslexic font, per-device "hide money" blur), applied pre-paint by a no-flash boot script. A **founder-only Design Lab** stores glass picks globally and live-restyles *every* client portal from the founder's preferences (the flask entry point is currently hidden → that editor is PARTIALLY IMPLEMENTED, but the applied picks are live).

**Agency branding in portal:** essentially name-only (the agency *name* surfaces in a couple of places; agency logo/colours are **not** themed into the portal — its look comes from the shared Elevra system). The client never sees the behind-the-scenes progression business. The agency-name header slot was removed (truncated the greeting) and a permanent new home is pending → IN DEVELOPMENT.

---

## 9. Communications, chasing, reminders & automation

### Email engine & sender (LIVE, sophisticated)
- **Bulletproof sender cascade:** resolve the correct From ("{first} at {Agency}", never "Sales Progressor" to clients) → if it's a connected send-enabled mailbox, send via that mailbox's own SMTP (DKIM-signed, filed to Sent) → on *any* failure fall back to SendGrid from the shared `updates@thesalesprogressor.co.uk` preserving display name + reply-to. Transient vs permanent vs sender-identity errors classified; 24h retry window; dead-lettering. Deterministic RFC Message-IDs stamped so inbound replies can be matched.
- **Sender policy** (`resolveAgencySenderForTransaction`) branches across outsourced / self-managed-personal / self-managed-automated / mailbox / fallback personas, with a `canReply` flag that suppresses "just reply" when the target is unmonitored.
- **Per-agency solicitor CC** — CC the handler's secretary/assistant per solicitor contact.
- **Email branding theme (LIVE):** `Agency.emailTheme` drives hero band, button, links, footer, logo on *client* emails with WCAG auto-contrast; untrusted-blob sanitiser; coral defaults so uncustomised agencies are unchanged. Platform emails (password reset, invites, chain notices) stay SP-branded.

### AI chase generation (LIVE, sophisticated — Claude Haiku)
- **Deterministic ask, AI wording only:** the app computes the authoritative recipient × action-holder matrix (ask-direct / via-own-solicitor / via-broker / not-chased); the AI is forbidden to override it and only writes it up. British voice, banned-phrase list, no em-dashes, confidentiality boundaries, PII minimisation (street line only — no postcode/price/other-party names).
- **Exchange-stage gating:** early-step chases can't mention exchange until both sides pass VM18/PM25.
- **Agent signature ownership:** the AI never writes the sign-off; the app appends the agent's sign-off + signature (BASIC/IMAGE/CUSTOM modes, photo/title/mobile/logo).
- **Agent voice-learning loop:** once an agent edits ≥5 AI drafts, Haiku distils their (fully redacted, PII-stripped) draft→sent pairs into a short style profile re-injected into future prompts.
- Chase channels include email and WhatsApp; multi-milestone "chase all" supported; rate-limited + access-scoped.
- **"Keep the other side posted":** a chase can post a passive, signed portal update to the opposite side (in-app/push only, no email).

### Reminders engine (LIVE, sophisticated)
- Grace-days / repeat-every / escalate-after cadence per milestone rule, per-agency overridable (forward-only — existing files keep their snapshot).
- **Reliability tiers:** partial unique indexes guarantee one live chase per log + one active reminder per (transaction, rule), with P2002-as-success dedup; most-progressed-chase picked on read so a stray duplicate can't read "not chased"; **client backstop** (hand to agent after 2 chases or 14 days silence, computed on-read so a cron stall can't drop it); **solicitor backstop** (surfaces run-out solicitor steps in Needs-you); atomic state transitions via guarded updates; hard-bounce → suppress contact + hand back a "fix the email" task.

### Chasing crons & automation
| Job | What | Status |
|---|---|---|
| **client-chase** | Daily digest per contact + escalation | **IN DEVELOPMENT** — gated by `CLIENT_CHASE_ENABLED` (off); dashboard shows "paused" |
| **solicitor-chase** | Per-code working-day cadence, idempotent, escalation bell | **PARTIALLY IMPLEMENTED** — admin-switch gated, off by default |
| **drain-outbound-email** | Business-hours (Mon–Fri 08:00–19:00 Europe/London, BST-aware) queue drain with suppression + retry | **LIVE** |
| Many others | completion-safety-net, milestone digests, chain-neighbour drains, exchange-day emails, weekly client update, enquiries chase, agent weekly brief, morning digest | **LIVE** (~46 cron routes total, each bearer-secret gated) |

### Email ingestion & mailboxes (LIVE, sophisticated)
- **Provider-neutral ingest brain:** connectors fetch + normalise, then match each message to a file and store confident ones. Multi-arm dedup (provider id + Message-ID + fuzzy counterparty/subject/time window), skips re-ingesting app-sent mail, thread-continuity fallback, forwarded-inner-address extraction, auto-reply/OOO detection, attachment auto-filing with dedup, signature→contact-phone suggestions, and a "Needs filing" tray for unmatched candidates.
- **Outlook connector (LIVE):** Microsoft Graph OAuth, token refresh, reads Inbox + property-named folders, 90-day backfill, hourly sync cron.
- **IMAP app-password connector (LIVE):** for domains that can't be DNS-verified (e.g. eXp UK agents); imapflow, encrypted app-password, 90-day backfill. Sent-Items capture gated by `SENT_ITEMS_ENABLED`.
- **Mailbox SMTP send (LIVE):** send as the agent's *own* address via their mailbox's SMTP (nodemailer), file a byte-identical copy to Sent; auto-disable after 2 consecutive auth failures with owner notification.
- **AI inbound read (IN DEVELOPMENT):** summarise inbound + suggest milestone confirms — dark-launched behind `EMAIL_AI_READ_ENABLED` (no spend until accept/dismiss UI lands).

### WhatsApp (PARTIALLY IMPLEMENTED)
Off-platform Baileys bridge (separate Node project on Railway) ↔ app ingest via shared bearer secret. **Groups-only** capture (groups named "Sale of {address}" / "Purchase of {address}"; DMs never auto-captured). Per-connection pairing QR / status / disconnect. A **WhatsApp-promises cron** turns a progressor's dated commitments in chat ("I'll chase Monday") into internal to-dos via Haiku. The whole path is a **no-op/503 until `WHATSAPP_BRIDGE_SECRET` + `WHATSAPP_BRIDGE_URL` are set** and the external bridge is running.

### Notifications (LIVE)
- **Web push** (clients + agents) via VAPID; prunes stale subscriptions; returns delivered-count so callers fall back to email (needs VAPID keys configured).
- **One-alert rule (sophisticated):** the portal feed entry is always recorded; on top, exactly ONE alert fires — a push if it reaches a live device, else a branded fallback email, never both.
- **In-app agent bell** (`Notification` queue).
- **Notification preferences:** 6 email toggles + 8 per-event push toggles with conservative defaults.
- **SendGrid webhooks (LIVE):** signed (ECDSA-P256) event webhook → delivery/bounce/spam joined to the outbound queue; hard bounce suppresses the contact; inbound-parse webhook captures *prospect* replies (separate from mailbox ingestion).

---

## 10. Chain functionality — LIVE (one of the most sophisticated subsystems)

A chain is separate `PropertyTransaction` files joined by a shared `chainId` + integer `position` (0 = top). A node is either a claimed link (real file) or an unclaimed stub (carries neighbour agent contact + photo).

| Capability | What | Status |
|---|---|---|
| **Chain graph** | Not a linked list: positions within `branchKey` ladders, unique (chain, branch, position), **fork-off-any-node branching** (nested onwards, max 3), collision-free positional **insert-between** (hover "+" on connectors) | LIVE |
| **Invite / claim loop** | Stub a neighbour → email invite (or revocable manual share link) → neighbour signs up at `/claim` and claims the slot, creating/linking a file; full conversion funnel instrumented (first-viewed, claim-started, nudged, bounced, declined); token TTL | LIVE — primary viral acquisition channel |
| **Two-layer permissions** | Person-based (creator/claimer) + agency-aware intel | LIVE |
| **Chain-node intel (sophisticated)** | Per-link private negotiating facts: break-chain stance (prepared/if-required/unwilling), conditions, expected timescale, chain notes, running diary (`ChainLinkEntry`), buyer-position badge (chain-free/FTB/cash). Gated to internal + owning agency, never other agencies, never clients | LIVE (one known cross-agency stub-contact leak documented as fixed — verify before widening) |
| **Withdrawal closed-loop (sophisticated)** | Direction-aware cascade on fall-through (lost-buyer up / lost-purchase down to nearest claimed link), orphan segment **split into a brand-new chain**, per-neighbour response state (remarketing/waiting/withdraw/break), relist "buyer found" re-notification with response-branched copy, 14-day cron nudge | LIVE |
| **Onward-visibility shadow tracker (sophisticated)** | A seller buying onward gets a private tracker on their file running the *real* prerequisite graph over a lightweight "as reported" store; never crosses agency boundary, never enters the cross-agency %; pre-fills the claim reconciliation when the agent above joins | LIVE (prod) |
| **Related-sale tracker** | The buyer-side mirror (a buyer who is also selling reports that sale's progress) | **PARTIALLY IMPLEMENTED — staging only, not pushed to prod per its spec** |
| **Chain far-side trackers** | The *other party* of each neighbour deal (vendor of the onward, buyer of the related sale); agent-only toggle inside each neighbour card; tenure inherits from the near sibling | LIVE (prod); claim-time reconcile pre-fill is the one sub-area to re-verify |
| **Exchange-date sync (sophisticated)** | When one agency manages 2+ files in a chain, setting/revising the exchange date fans out to every other managed, not-yet-exchanged file in the same chain — scope- and same-agency-guarded (never touches a neighbouring agency's file), business-day-rolled, with bottleneck (latest-date) pinning on recalibrate | LIVE |
| **"Push to exchange" checklist** | Once a file is ready both sides + in a chain, chase every other link until all ready; per-link readiness provenance (exchanged/confirmed/their-file/not-yet) | LIVE |
| **Chain agent chase** | Solicit an update from a neighbour agent (unclaimed stubs only), reusing the AI phrasing engine but deliberately NOT the solicitor/client chase machinery | LIVE |
| **Automated neighbour-update pipeline** | When a seller confirms an onward step, a polite agency-branded digest is batched to the invited stub agent above; opt-in (`chainNeighbourUpdatesEnabled`), capped before exchange | LIVE |
| **Self-link multi-file chains** | An agency adds a file it already owns as a fully-claimed link immediately (silent, no invite) | LIVE |
| **Intro-call drawer** | Internal-team guided call script writing straight into move-info / cost / onward-tracker / intel stores | LIVE (internal-only) |

**Who can use chains:** internal staff always; self-managing agency users who progress ≥1 live file themselves; plus a named allowlist. (The rollout-gate code is *ahead* of its spec doc, which still says "internal + Taylor only" — in current code the self-managing-agency branch is present.) Add-node permissions remain person-based (a caveat for cross-agency chains).

---

## 11. Maps / location & property enrichment — LIVE

**Property enrichment orchestrator (LIVE, sophisticated):** a `Promise.allSettled` fan-out of free/official UK sources into one "passport" with independent degradation + caching — feeds the Overview property card and new-sale lookup:
- **HM Land Registry SPARQL (LIVE, keyless):** price-paid history per property + registered-sale counts per outcode (durable DB cache + nightly pre-warm because the endpoint is ~30s/outcode).
- **postcodes.io (LIVE, keyless):** coordinates + local authority.
- **planning.data.gov.uk (LIVE, keyless):** conservation area / Article 4 / listed-building designation by point lookup.
- **EPC Register (PARTIALLY IMPLEMENTED):** new DLUHC bearer-auth energy-certificate API (current + potential rating, floor area, UPRN, tenure, built form); gated on `EPC_API_KEY` — returns "unconfigured" when unset.

**Map UI (LIVE):** the Files list "Map" view is a MapLibre canvas with free Carto tiles, postcode→centroid geocoding (cached), status/value/share/gaps heat-shading, an outcode "patch" leaderboard, deterministic jitter so co-postcode pins don't stack. **Street View is feature-flagged off** (optional Google Maps key). A separate **chain geo map** renders a chain's properties.

---

## 12. Documents — LIVE

**Supabase Storage document pipeline (LIVE, sophisticated):** one service across buckets (private transaction-documents + whatsapp-media; public provider/agency logos, avatars, signatures; property photos). **One-time signed upload URLs** let the browser PUT direct to storage (bypassing the serverless body cap) with a finalize-time existence check; batch signed-URL minting; drift detection between storage and DB. Agents and portal clients both upload; docs can be shared to the other side's portal. **MOS (memorandum of sale) upload + AI memo-parse** endpoint feeds the new-sale flow. Gated on Supabase env; several buckets are manual setup steps.

---

## 13. Analytics, predictions & intelligence

### Agent-facing (LIVE)
- **In-app Analytics dashboard** — KPI sparklines, delta pills, speed gauge, submission/value funnels, value heat tiles, missing-fees list. DB-authoritative (works with PostHog off).
- **Fall-through risk scoring (LIVE, sophisticated):** a transparent 0–100 per-file score with weighted, UI-exposed factors (escalated chases, pace vs 12-week target, overdue reminders, inactivity, stuck milestone) and calm states for exchanged/on-hold; nightly history snapshots. Surfaced as a badge/widget on files + list.
- **Phase-aware exchange prediction (LIVE, sophisticated):** a self-adjusting predicted exchange date that walks the remaining vendor + purchaser critical path and shrinks as milestones complete; relist-aware; the real date stands once exchanged. Plus overdue-and-stuck detection with a working-day grace.

### Capture-only / dormant
- **Exchange-prediction history (IN DEVELOPMENT):** append-only, change-only trajectory log of how each prediction moved, with source attribution + inputs snapshot — captured, no read surface yet.
- **Risk history** — snapshotted nightly (read surface limited).

### PostHog (IMPLEMENTED but OFF)
Compliance-hardened single-chokepoint wrapper (EU host, consent-gated, compile-time + runtime event/property allow-lists that strip PII). Session recording disabled in v1. **Entirely no-op until `NEXT_PUBLIC_POSTHOG_KEY`/`POSTHOG_API_KEY` are set** (not in repo). The three PostHog-fed friction detectors and the Command-Centre website-growth web-behaviour half are dormant until then.

### Command Centre intelligence (superadmin-only, LIVE)
- **17 signal detectors ("living signals"):** one row per ongoing situation keyed by detector + dedupe key, refreshed each run (occurrence counting), auto-resolved when a detector stops reporting, snooze re-arming, confidence + severity (incl. a `leak` tier for revenue leaks). Detectors include revenue-at-risk, silent-agency, portal-gone-quiet, chase-not-landing, quote-inbox-aging, solicitor-confirm-pending, cost-drift, AI-quality-drift, cohort/power-user patterns, funnel-drop, source/content performance, plus 3 PostHog-fed ones (dormant).
- **AI founder briefs:** a **daily operational brief (Claude Haiku)** and a **weekly strategic review (Claude Opus `claude-opus-4-8`)**, both grounded in real week-vs-week numbers + live snapshot + deduplicated active signals + open experiments; emailed to the founder, logged as audit rows.
- **Experiment Lab (PARTIALLY IMPLEMENTED):** experiment lifecycle with frozen baseline/result snapshots + guardrails + AI-suggested experiments; mutated via API routes, "no UI in Phase 3."
- **Metrics rollup (LIVE):** a daily rollup table feeding briefs + dashboards.

---

## 14. Branding / white-labelling

**Reality: genuine white-labelling is in client emails; the portal is name-only; the agent UI accent is personal (not a client surface).**

- **Client-email branding (LIVE, genuine white-label):** per-agency hero band / button / links / footer / logo with WCAG auto-contrast and a sanitiser; studio UI on the profile page; *client emails only* — platform emails stay SP-coral.
- **Agency email-copy control (LIVE, sophisticated):** directors can override SP's default client-facing wording for milestone updates and automated emails (agency layer over SP defaults, append-only audit); solicitor/internal emails stay SP's.
- **Agent UI theme (LIVE, personal):** each agent picks a `brandColor` hex that themes their own console accent — not a client-facing surface.
- **Portal branding (minimal):** agency *name* only; no agency logo/colour theming in the portal (its look is the shared Elevra system).

---

## 15. Billing & pricing — LIVE (Stripe, automated)

- **Pricing (single source of truth `lib/billing/fee.ts`):** self-managed = **FREE** (£59 retired); outsourced = sliding **£250 / £300 / £350** by sale-price band. Per-agency legacy flat-fee override + a `free` tier. VAT-split scaffolding present but inactive.
- **First-outsourced-free (LIVE):** `Agency.firstOutsourcedFreeEligible` — an eligible agency's first outsourced exchange nets to £0 (bilateral/idempotent stamping; migrated-history hazard handled).
- **Charging flow (LIVE, automated):** exchange (VM19/PM26) stamps `exchangedAt` + snapshots price → monthly cron accrues `InvoiceLine` rows → cron issues a Stripe auto-advancing invoice per agency for the closed London month, with **deterministic per-(agency, month) idempotency keys** for exactly-once retries and per-invoice isolation → Stripe webhooks handle payment success/failure → a cron blocks new-file creation ~7 days after first failure. Card capture via SetupIntents; invoice-PDF generation; credit notes; pricing acknowledgements.
- **Progression-business ring-fence (sophisticated):** files progressed by an *external* progression business exchange but are never billed to the client's agency — they get their own per-sale charge via a separate billing arc. Demo files never bill.
- **Caveat:** Stripe keys are absent from the staging env; the code degrades gracefully (shows a "blocked"/details-free state rather than 500). Charging is prod-wired via Vercel env, not exercised locally.

---

## 16. Command Centre (internal superadmin console) — LIVE

Superadmin-only (2FA step-up + IP allowlist + signed cookie), its own `commandDb` Prisma client, every page view audit-logged, every metric filterable by self-progressed / progressor-managed / combined + agency multi-select.

**Operational + growth surfaces (LIVE):** Today/Overview (headline deltas, stuck-file leak card, signals strip, 30s auto-refresh, "what changed" deploy annotations), Insights (the AI briefs + signal feed), Agencies, Files, Outbound, Revenue (+ breakdown/per-agency), Providers (surveyor-firm marketplace + quote inbox), Website-growth, Activation, Retention, Adoption (portal-adoption funnel + comms-reachability), Chain-invites, Follow-up-usage, Experiments, Enquiries-chase, Health (cron/job info), Critique (founder screenshot+note capture), Audit, Rules, Email catalogue/template/sender management, Milestone-email + milestone-update editors, Proposals (milestone-update approvals), WhatsApp.

**Content & personal-brand studio (PARTIALLY IMPLEMENTED):** the largest subsystem — AI content drafting / compose / adapt / refine (Claude Haiku), a **voice-learning** loop (captures every draft→final edit into a voice profile), brand memory/opportunities/strategy/thoughts, **FLUX image generation** (Replicate `flux-schnell`, prompt moderation + monthly £ budget cap — pending `REPLICATE_API_TOKEN`), and `next/og` branded social cards. **Actual social publishing to LinkedIn/Meta is NOT connected** — posts are prepared and marked posted by hand; autopilot auto-publish is PLANNED.

**Explicitly not built:** the "Automation Brain" (`/command/automations`) and "Friction" (`/command/friction`, gated on the PostHog DPA) pages are **stubs** (PLANNED), hidden from nav.

**Doc-vs-reality:** the shipped Command Centre is substantially larger and more operational than the ADMIN_01–10 specs describe.

---

## 17. Prospects & AI outreach (internal acquisition tooling) — LIVE

TSP's own agency-acquisition CRM, in the Command Centre (not an agency feature):

- **Prospects CRM (LIVE):** per-branch prospects with per-field research provenance, pipeline/follow-ups/insights views, resumable **AI research enrichment** (Claude Sonnet + Anthropic web-search tool, ~1 min/agency, enriching from official sites/Companies House), batch imports, full SendGrid delivery/open/click/bounce/reply tracking, signup-conversion attribution.
- **Approval-gated outreach sequences (LIVE):** a fixed 3-step sequence (intro → nudge +14d → re-engage +14d), each send human-approved; auto-halts on reply/opt-out/bounce; opt-out + complaint suppression + email verification + warm-up drip + auto-stop-on-signup shipped. Cold mail sends from `ellis@thesalesprogressor.co.uk` with per-send reply-token attribution via SendGrid Inbound Parse.
- **AI Outreach experiment engine (LIVE, highly sophisticated):** a cross-provider adversarial multi-agent loop — **Claude Opus strategist** proposes one A/B challenger experiment → **OpenAI GPT-5.5 adversarial reviewer** (reasoning effort high) → conditional single Claude revision, with a hard "max 3 model calls, never a 4th" invariant. Zod-validated output, app-code guardrails (voice guide, banned phrases, allow-listed personalisation only), deterministic PII-free sample-feasibility, models never see prospect identities, every call logged with tokens/cost. A SHA-256 **content-hash lock at approval** refuses launch if the copy drifted. Launch only inside the Europe/London business window with send warm-up caps; statistical winner selection (p-value). The viewing page is read-only by design; the mutation/generate/approve/launch controls are layered in via separate build orders → **actively developed**. "Nothing sends without approval."

---

## 18. Integrations register

| Integration | Purpose | Status |
|---|---|---|
| Supabase (Postgres + Storage) | Database + file/photo/logo storage | **LIVE** (load-bearing) |
| Anthropic Claude | Chase/email gen + voice learning (Haiku), daily brief (Haiku), weekly review + outreach strategist (Opus), prospect research (Sonnet) | **LIVE** |
| OpenAI | Adversarial reviewer in outreach/content (GPT-5.5) | **LIVE / configurable** |
| SendGrid | Transactional + agency-domain email, DKIM/return-path auth, single-sender verify, event + inbound-parse webhooks | **LIVE** (load-bearing) |
| Nodemailer / SMTP | Per-agency mailbox send-as-agent | **LIVE** (per connected mailbox) |
| IMAP (imapflow) | Mailbox reading for non-DNS-verifiable domains | **LIVE** (per mailbox) |
| Microsoft Outlook (Graph) | Mailbox connect + folder/message/attachment reads + token refresh | **LIVE** (needs `MICROSOFT_*`) |
| Microsoft / Google OAuth | NextAuth sign-in | **LIVE / configurable** |
| Vercel Cron | ~46 scheduled jobs | **LIVE** |
| Vercel Deploy webhook | HMAC-verified deploy log for "what changed" | **LIVE** |
| Stripe | Billing: invoices, SetupIntents, webhooks, credit notes | **LIVE** (prod env) |
| HM Land Registry SPARQL | Sold prices + area sale counts | **LIVE, keyless** |
| postcodes.io | Geocoding + local authority | **LIVE, keyless** |
| planning.data.gov.uk | Conservation/Article 4/listed designations | **LIVE, keyless** |
| EPC Register (DLUHC) | Energy certificates | **PARTIAL — pending `EPC_API_KEY`** |
| Web Push (VAPID) | Client + agent push notifications | **LIVE** (needs VAPID keys) |
| MapLibre + Carto tiles | Map view | **LIVE, keyless** |
| Google Maps Embed | Street View in map | **FLAGGED OFF** (optional key) |
| Replicate / FLUX | AI social-content photography | **PENDING `REPLICATE_API_TOKEN`** + budget-gated |
| PostHog (EU) | Product + website analytics, friction detectors | **IMPLEMENTED but OFF** (no keys) |
| Upstash Redis | Rate limiting | **FLAGGED OFF** (`RATE_LIMIT_ENABLED` + creds) |
| WhatsApp / Baileys bridge | Off-platform group-message capture + control | **PENDING** (`WHATSAPP_BRIDGE_*` + external Railway bridge) |
| Sentry | Error monitoring | **LIVE** (wired) |
| Social publishing (LinkedIn/Meta/Ayrshare) | Content auto-post | **NOT CONNECTED** (manual mark-as-posted) |

---

## 19. Feature-flag register (what's dark vs live)

| Flag / gate | Default | Gates |
|---|---|---|
| `SIGNUP_JOIN_REQUESTS_ENABLED` | OFF | Request-to-join by verified domain |
| `MOVE_INVITES_ENABLED` | OFF | Invite an existing account to move agency |
| `PROGRESSION_BUSINESSES_ENABLED` | OFF | All external progression-business entry points |
| `CLIENT_CHASE_ENABLED` | OFF | Automated client-chase cron |
| Solicitor-chase admin switch | OFF | Automated solicitor-chase cron |
| `EMAIL_AI_READ_ENABLED` | OFF | AI summarise/suggest on inbound email |
| `SENT_ITEMS_ENABLED` | — | IMAP Sent-folder capture |
| `RATE_LIMIT_ENABLED` | OFF | Upstash rate limiting (all limiters PASS when off) |
| `MEDIANS_READY` (code const) | false | Milestone "slower than typical" badge |
| `SHOW_RECONCILE` (code const) | false | Legacy claim-time reconcile pre-fill |
| Street View (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) | unset | Street View modal |
| `ADMIN_IP_ALLOWLIST` | empty | Command Centre IP gate |

---

## 20. Technically sophisticated / "hidden" functionality worth highlighting

Even where not UI-prominent, these are genuinely non-trivial and differentiating:

1. **Bidirectional milestone reflection engine** — buyer/seller trackers kept in lockstep across every confirm path through a single concurrency-safe chokepoint, with overseer-attribution rules.
2. **Direction-generic chain shadow-tracker engine** — one model + one direction config driving *four* tracker kinds (onward/related × near/far), computing step availability by running the real prerequisite graph over an "as reported" store, with sibling tenure inheritance.
3. **Chain withdrawal closed-loop state machine** — direction-aware cascade, orphan-segment split into a new chain, per-neighbour response state, relist re-notification with response-branched copy.
4. **Cross-file exchange-date propagation** — scope- and same-agency-guarded fan-out with bottleneck (max-date) pinning and business-day roll.
5. **Deterministic-ask AI chase** — the app decides *what* to ask (recipient × action-holder matrix); the AI only writes it, with a redact→distil→re-inject per-agent voice-learning loop.
6. **Bulletproof sender cascade** — mailbox-SMTP-then-SendGrid fallback with sender-identity-error retry and deterministic Message-ID reply threading.
7. **Provider-neutral email ingestion** — multi-arm dedup, thread continuity, forwarded-address extraction, attachment auto-filing.
8. **Reminder reliability engineering** — partial unique indexes + P2002-as-success dedup, compute-on-read hand-over that survives cron stalls, dual client/solicitor backstops.
9. **Multi-source property enrichment** — `Promise.allSettled` fan-out across Land Registry / EPC / postcodes.io / planning.data.gov.uk with independent degradation + durable caching.
10. **Phase-aware self-adjusting exchange forecaster** + append-only accuracy-capture history.
11. **Transparent fall-through risk scoring** with UI-exposed per-factor contributions + nightly history.
12. **Direct-to-Supabase signed-upload-with-finalize-verify** document pipeline (bypasses serverless body caps).
13. **Cross-provider adversarial AI outreach** (Claude Opus strategist vs GPT-5.5 reviewer) with a hard call-count invariant and hash-locked approval — *internal tooling*.
14. **Living-signal detector framework** with auto-resolve/snooze/dedupe and a two-tier Haiku/Opus narration — *internal tooling*.
15. **PostHog privacy chokepoint** — compile-time ESLint lockdown + runtime allow-lists stripping PII.
16. **Session-version live re-read** — permission/visibility changes take effect on next page load without re-login.
17. **~30-variant Elevra glass theming engine** with a founder-only global Design Lab that live-restyles every client portal.
18. **Provisional two-phase booking confirm** — client confirmation holds all outbound email until the agent confirms the real date.

---

## 21. Summary — what's genuinely live vs dark

**Fully LIVE customer product:** the milestone engine (all confirm paths, bilateral reflection, transaction-type variants, reconciliation), Checkpoints, the client portal (with multi-file switcher, theming, dead-round safety), the agent app + file page + all dashboards, the email engine + branding + AI chase + reminders engine + Outlook/IMAP mailbox connect + mailbox SMTP send, the full chain subsystem (graph/invite/claim/withdrawal/onward/far-side/exchange-sync/neighbour-updates/self-link), property enrichment + maps, documents, risk scoring + exchange prediction + agent analytics, notifications, agency email-copy control + portal display settings + automation switches, and the full Stripe billing pipeline.

**LIVE but dependent on a live credential (code complete):** EPC (`EPC_API_KEY`), web push (VAPID), Street View (Maps key), FLUX images (`REPLICATE_API_TOKEN`), Stripe (prod env).

**PARTIALLY IMPLEMENTED / admin-gated:** solicitor-chase cron, related-sale tracker (staging-only), unlock self-heal (nightly only, no admin button), Experiment Lab (API-only), Command Centre content studio (no real social publishing), RLS (plumbed but inactive).

**IN DEVELOPMENT / dark-launched (flag off):** request-to-join, invite-to-move, external progression businesses, client-chase cron, AI inbound email read.

**PLANNED / stubbed:** Command Centre "Automation Brain" + "Friction" pages, social auto-publishing.

**NOT present (despite assumptions):** a £59 self-managed paid tier (retired → free), an "Elevra / Find-a-Coach marketplace" (in this repo "Elevra" is only the imported WebGL visual-background system, not a marketplace), a stored "connected services" table (integration status is env-derived at runtime).
