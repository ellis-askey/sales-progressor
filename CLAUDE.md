# CLAUDE.md — Sales Progressor

**This file is the persistent context for every Claude Code session in this repo.**
**Always read this file before taking any action. Re-read at the start of any new task.**

Last updated: 2026-05-03 (verified against production DB and source code)

---

## Project overview

Sales Progressor is a UK estate agency sales progression SaaS. The product manages residential property transactions from offer-accepted through exchange to completion — replacing manual chasing, spreadsheets, and fragmented communication with structured milestones, automated reminders, and live visibility for every party.

The customer is an estate agency. Two service tiers:

- **Self-managed (£59 per sale, charged on exchange)** — agency uses the platform themselves to manage their own files. **Fully functional today.**
- **Outsourced (£250+ per sale, charged on exchange)** — Sales Progressor's internal team progresses the file on the agency's behalf. **Not yet fully functional — see "Known gap: Outsourced workflow" below.**

Current stage: pre-launch, ~5 test users, no paying customers.

---

## Role architecture

This codebase has **five user roles**. Verified against production DB on 2026-05-03.

| Role | Who | Has agencyId? | Surface |
|---|---|---|---|
| `director` | Customer agency staff — top of agency hierarchy | Yes (customer agency) | `/agent/*` |
| `negotiator` | Customer agency staff — day-to-day | Yes (customer agency) | `/agent/*` |
| `sales_progressor` | **Sales Progressor's internal team** — handles outsourced files | **No (null)** | `/dashboard` |
| `admin` | **Founder / senior internal** — sees all files across the platform | **No (null)** | `/dashboard` |
| `superadmin` | **Founder** — Command Centre access | **No (null)** | `/command/*` |

The `viewer` role exists in code but is not in production use as of this writing.

### Critical distinction

**Customer agency users have `agencyId` set to their agency. Internal staff (`sales_progressor`, `admin`, `superadmin`) have `agencyId = null`.**

This is the core multi-tenancy model. Customer agency data is scoped by `agencyId`. Internal staff exist outside that scope and access transactions through different mechanisms (when those mechanisms exist — see known gap below).

### Known gap: Outsourced workflow

**Internal staff (`sales_progressor`, `admin`) currently cannot see any transactions on `/dashboard`.**

The query path filters by `session.user.agencyId`, which is `""` for internal staff (`null` coalesced to empty string). No transaction has `agencyId = ""`, so the result is always empty.

The schema fields exist:
- `PropertyTransaction.serviceType` (`self_managed` | `outsourced`)
- `PropertyTransaction.assignedUserId` (intended to link to internal staff)
- An assignment UI exists (the unassigned-files widget)

But the read path — the query that shows an internal staff member their assigned files — was never built.

**Implication for any work touching internal staff or outsourced files:**

- The `/dashboard` page renders but shows an empty transaction list for internal staff
- The outsourced (£250+) tier on the pricing page advertises functionality that is not currently operable
- Any feature that assumes internal staff can "see their assigned files" must build the read path first
- This is tracked as **Package D — Outsourced Workflow** for future planning

When working on anything related to outsourced files, internal staff visibility, or the `/dashboard` route — surface this gap and confirm scope before proceeding.

---

## Surfaces

Each role uses a distinct surface. Do not mix them:

| Surface | URL | Roles allowed | Brand |
|---|---|---|---|
| **Marketing site** | `thesalesprogressor.co.uk` | Public | Dark navy + coral hero, glass cards |
| **Agent app** | `portal.thesalesprogressor.co.uk/agent/*` | `director`, `negotiator` | Warm cream + coral + glass |
| **Internal dashboard** | `portal.thesalesprogressor.co.uk/dashboard` | `admin`, `sales_progressor`, `superadmin` | Dark + glass + property photography backdrop (`AppShell`) |
| **Command Centre** | `portal.thesalesprogressor.co.uk/command/*` | `superadmin` only | Utilitarian dark, hairline borders, no glass, no photography (layout inline in `app/command/(protected)/layout.tsx`) |
| **Buyer/seller portal** | `portal.thesalesprogressor.co.uk/portal/[token]` | Token-authenticated visitors | Light, clean, mobile-first |

The agent app and the internal dashboard use **different layout shells** (`AgentShell` vs `AppShell`). Don't mix imports between them.

The Command Centre has no separate shell component. Its layout is assembled inline in `app/command/(protected)/layout.tsx` using `CommandSidebar` from `components/command/CommandSidebar.tsx`. Distinct visual system from both agent and internal dashboard.

---

## Tech stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript (strict)
- **Database**: Supabase (PostgreSQL) via Prisma ORM
  - Production project ID: `gmkfustgwipgihpmpjpr`
  - Staging project ID: `etidawkbqctarmsdjoxp` (eu-west-1)
- **Auth**: NextAuth.js (Credentials provider, JWT strategy)
- **Email**: SendGrid via `@sendgrid/mail`
- **AI**: Anthropic Claude (Haiku 4.5 for chase + content drafting; Opus 4.7 for weekly insight reviews)
- **Hosting**: Vercel
- **File storage**: Supabase Storage
- **Image generation**: `next/og` (Edge runtime), Replicate FLUX (AI photography)
- **Rate limiting**: Upstash Redis (feature-flagged, currently disabled)
- **Analytics**: PostHog EU (when key configured)

---

## File structure

```
/app                     Next.js App Router routes and API handlers
  /agent/*               Agent app (director, negotiator)
  /dashboard             Internal dashboard (admin, sales_progressor)
  /portal/[token]        Buyer/seller portal
  /command               Command Centre (superadmin only)
    /(protected)         Auth-gated command centre routes
  /api                   API route handlers
    /command             Command Centre API endpoints (superadmin only)
    /cron                Scheduled jobs (Vercel cron)
    /webhooks            External webhooks (Vercel deploy, etc.)
/components
  /command               Command Centre components — do not import outside /command
  /layout
    AgentShell.tsx       Layout for agent app
    AppShell.tsx         Layout for internal dashboard
    (no separate shell file — assembled inline in app/command/(protected)/layout.tsx using CommandSidebar)
  /milestones            Milestone engine UI (agent app)
  /transaction           Transaction-related agent UI
  /portal                Buyer/seller portal UI
/lib                     Server-side utilities, services, helpers
  /command               Command-Centre-specific server code
    /content             Content drafting, voice, image generation
    /insights            Daily brief, weekly review, signal detectors
  /services              Cross-cutting business logic
  /security              Auth helpers, ownership validation
/prisma
  /schema.prisma         Single source of truth for data model
  /migrations            Prisma migrations — apply to staging first
/docs                    Specs, scope documents, audit reports
  /admin                 Command Centre specifications (ADMIN_01–10)
  /_archive              Superseded/historical docs
.env                     Local secrets — NEVER commit
```

---

## Source-of-truth documents

When working on a topic, read the relevant doc BEFORE writing code. If a doc and the codebase contradict, surface the contradiction in your response — do not silently pick one.

| Topic | Source of truth |
|---|---|
| Role architecture | This file (CLAUDE.md, the table above) — verified against prod DB 2026-05-03 |
| Milestone engine state machine | `docs/MILESTONES_SPEC_v1.md` |
| Milestone weights and gating | `docs/MILESTONES_WEIGHTS_v1.md` |
| Command Centre product spec | `docs/admin/ADMIN_01_SPEC.md` (and ADMIN_02–10 for subsystems) |
| Visual design (agent app) | `docs/VISUAL_DIRECTION.md` |
| Active package being built | `docs/PACKAGE_X_SCOPE.md` (if one exists) |
| Manual ops tasks (founder side) | `docs/ELLIS_MANUAL_TODO.md` |
| Technical debt | `docs/TODO.md` |
| Bug log | `docs/POST_LAUNCH_FIXES.md` |
| Test accounts | `docs/test-accounts.md` |
| Outsourced workflow gap | This file ("Known gap" section above), pending Package D |

---

## Development rules

### Rule 1 — Read source-of-truth first

Before writing code that affects a documented system, read the relevant spec doc above. Quote the specific section in your commit message. If no source-of-truth doc exists for what you're about to build, surface that fact and ask whether to proceed.

### Rule 2 — Verify before claiming done

- Run `npx tsc --noEmit` before committing
- Run relevant tests if they exist
- Never say "shipped" or "done" without evidence: PR URL, file paths, test output, or screenshots
- For visual changes, post a screenshot — visual quality cannot be verified by tsc

### Rule 3 — Migrations to staging first

Database migrations apply to **staging Supabase first**, verified, then production. Never both at once. Migration filenames are date-prefixed (`YYYYMMDDHHMMSS_descriptive_name`).

### Rule 4 — Look before you create

Search the codebase before creating new files. If a similar component, helper, hook, or pattern exists, extend it rather than duplicating.

### Rule 5 — One concern per PR

Each PR addresses one concern. If you find yourself thinking "while I'm here I should also fix..." — do not. File the thought in the active follow-ups doc.

### Rule 6 — Push back when scope drifts

If the user asks for something that:

- Contradicts a source-of-truth doc
- Falls outside the active package's scope
- Mixes concerns that should be separate PRs
- Has unstated edge cases that need decisions

…say so in plain English. Don't silently expand scope or guess at unstated requirements.

### Rule 7 — Multi-tenant safety (non-negotiable)

For customer agency data: every database query must filter by `agencyId` derived from the authenticated session.

For routes accepting client-supplied IDs: verify the resource belongs to the authenticated user's agency BEFORE acting on it. Use the access scope helper from `lib/security/access-scope.ts` (built in Package D). Until Package D ships, ownership is enforced via inline `findFirst({ where: { id, agencyId } })` patterns. Do NOT introduce new ad-hoc inline checks — wait for Package D's helper if writing new code that needs ownership enforcement.

For internal staff (where `agencyId = null`): **agencyId-based filtering does not apply**. Internal staff access transactions through `assignedUserId` (when that path exists) or admin-level cross-agency views. Build these paths explicitly; don't assume agencyId filtering is the only mechanism.

A query that doesn't have a clear access model is a tenant isolation hole. There are no exceptions outside Command Centre routes (which use `commandDb` with explicit superadmin context).

### Rule 8 — Command Centre isolation

Code under `/lib/command/` and `/app/command/` is superadmin-only.

- Do not import from `/lib/command/*` into agent app or internal dashboard code
- Do not import agent app or dashboard business logic into `/lib/command/*` unless it's a genuinely shared utility (e.g. `lib/email.ts`, `lib/prisma.ts`)
- Command Centre uses `commandDb` from `lib/command/prisma.ts` for queries that need superadmin context

### Rule 9 — Brand consistency

Three distinct visual surfaces for logged-in users. Do not mix tokens between them:

- **Agent app** (`AgentShell`): warm cream, coral primary (`#FF6B4A`), glass cards, humanist sans-serif. Source: `app/globals.css` and `docs/VISUAL_DIRECTION.md`
- **Internal dashboard** (`AppShell`): dark photo backdrop with near-black overlay, glass sidebar (`glass-sidebar` utility class), used by admin and sales_progressor. Source: `components/layout/AppShell.tsx`
- **Command Centre**: utilitarian dark, near-black background (`#0a0a0a`), hairline borders (`#262626`), blue accent (`#2563eb`) for active nav, solid surfaces (no glass), Lucide icons. Layout assembled inline in `app/command/(protected)/layout.tsx` using `CommandSidebar` from `components/command/CommandSidebar.tsx`. Source: `docs/admin/ADMIN_01_SPEC.md`

For social card templates (in `/lib/command/content/images/`): inherit from the marketing site's dark hero (navy + coral).

### Rule 10 — Show raw evidence when stakes are high

For architectural questions, role/permission questions, schema questions, or anything where being wrong has compounding cost:

- Quote the actual file content verbatim
- Run the actual database query and show the result
- Don't summarise. Don't interpret. Show the raw text or output

This rule was added because two CC sessions made confident architectural claims that turned out to be partly wrong. The fix is to demand raw evidence rather than digested interpretation.

When the user asks "show me how X works," show file paths, line numbers, and direct quotes. Save interpretation for after the evidence is on screen.

### Rule 11 — Ask when unclear

If a decision is needed and not documented anywhere:

- Pause
- State the decision in plain English
- Offer 2–3 reasonable options with pros/cons
- Wait for guidance

Don't guess. Don't proceed silently. Don't fabricate a decision and bury it in a commit.

---

## How to respond

For every PR or significant change, your response includes:

- **What I did** — plain English, no jargon
- **Files changed** — list with one-line "what changed" per file
- **Tests run** — `tsc` output, any test commands, migration verification
- **What you need to do** — manual steps required (env vars, dashboard config, follow-up actions). If a manual task is required, it must also be added to `docs/ELLIS_MANUAL_TODO.md`
- **Risks / what could go wrong** — honest assessment, not reassurance
- **Next step** — one clear action

For routine read-only operations (reading a file, running a search), keep response minimal.

For multi-PR runs with autonomous gates: one-line acknowledgement per PR ("PR XX shipped"), full checkpoint at hard pauses only.

---

## Anti-drift discipline

This project has had recurring scope drift in past CC sessions. To prevent it:

1. **Re-read this file at the start of any non-trivial task**
2. **Re-read the active package scope doc** if one exists
3. **Quote the relevant spec section in commit messages** to prove it was read
4. **File temptations as follow-ups, don't ship them**
5. **Surface contradictions, don't reconcile silently**
6. **Hard pauses are mandatory pauses**, not "optional checkpoints I can skip if I'm confident"
7. **Show raw evidence, not interpretation, when stakes are high** (see Rule 10)

---

## Hard rules — never violated

- Never commit `.env` or any file containing secrets
- Never auto-publish to social platforms (LinkedIn, Twitter, Instagram, TikTok) without per-post user confirmation
- Never delete user data without explicit confirmation; default to anonymisation
- Never add a new third-party integration without surfacing it in `docs/ELLIS_MANUAL_TODO.md` (env vars, signup steps, DPA requirements)
- Never bypass the multi-tenancy model:
  - For customer agency data: filter by `agencyId`
  - For internal staff data: build explicit access paths (`assignedUserId`, role-based admin queries) — never assume agencyId filtering applies
- Never mark something "done" that hasn't been verified
- Never invent brand colours, fonts, or logo assets — extract from existing codebase or pause and ask
- Never ship migrations to production without staging verification first

---

## Connected services and integrations

| Service | Purpose | Status |
|---|---|---|
| Supabase | Database + file storage | Live |
| Anthropic Claude | AI chase, content drafting, insights | Live |
| SendGrid | Transactional email | Live (sender: `updates@thesalesprogressor.co.uk`) |
| Vercel | Hosting + cron + analytics | Live |
| Land Registry SPARQL | UK property price history | Live (public, no auth) |
| EPC Register | Energy performance data | Live (gov API key) |
| Replicate | AI image generation (FLUX) | Pending API token |
| PostHog (EU) | Product analytics | Pending DPA + key |
| Upstash Redis | Rate limiting | Pending account + creds |

When adding a new integration, surface it in `docs/ELLIS_MANUAL_TODO.md` with the manual setup steps the founder needs to take.

---

## Communication style

- Plain English over jargon
- Specific over vague ("created `app/api/chains/route.ts` with agencyId check on line 42" beats "added some auth")
- Honest over reassuring ("I'm not sure this handles the case where X" beats "should be fine")
- Direct over hedged
- Brief by default, detailed when stakes are high (production data, security, billing)

---

## When this file changes

If you make changes that affect the architecture, file structure, role model, or rules above — propose an update to this file in the same PR. Surface "I'm proposing to update CLAUDE.md because…" in the response.

This file should stay accurate. A stale CLAUDE.md is worse than no CLAUDE.md.
