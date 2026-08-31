# CLAUDE.md — Sales Progressor

**This file is the persistent context for every Claude Code session in this repo.**
**Always read this file before taking any action. Re-read at the start of any new task.**

Last updated: 2026-06-26 (Phase 0 of the discipline migration — Laws 1-21 established. See [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) for the full migration roadmap.)

---

## Project overview

Sales Progressor is a UK estate agency sales progression SaaS. The product manages residential property transactions from offer-accepted through exchange to completion — replacing manual chasing, spreadsheets, and fragmented communication with structured milestones, automated reminders, and live visibility for every party.

The customer is an estate agency. Two service tiers:

- **Self-managed (£59 per sale, charged on exchange)** — agency uses the platform themselves to manage their own files. **Fully functional today.**
- **Outsourced (£250+ per sale, charged on exchange)** — Sales Progressor's internal team progresses the file on the agency's behalf. **Fully functional today** (Package D shipped 2026-05-03; access scope helper at `lib/security/access-scope.ts`).

Current stage: pre-launch, ~5 test users, no paying customers. Phase 0 of the discipline migration in progress as of 2026-06-26.

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

This is the core multi-tenancy model. Customer agency data is scoped by `agencyId`. Internal staff exist outside that scope and access transactions through `assignedUserId` (sales_progressor) or admin-level cross-agency views (admin / superadmin).

### Access scope helper

Internal staff visibility is handled by `lib/security/access-scope.ts`. `getAccessScope(session)` returns one of three shapes:
- `{ kind: "all" }` — admin / superadmin (no agency filter)
- `{ kind: "assigned", userId }` — sales_progressor (sees their assigned files only)
- `{ kind: "agency", agencyIds }` — director / negotiator / viewer (their agency)

Use this helper for every multi-tenant read or write. `scopeTransactionWhere` for lists, `scopeOwnershipWhere` for single-tx guards, `scopeChaseTaskWhere` / `scopeReminderLogWhere` for related models. Do not introduce ad-hoc `agencyId: session.user.agencyId` patterns — they break for internal staff (whose agencyId is null).

Shipped as Package D, 2026-05-03. Hub dashboard at `/agent/hub` routes internal staff through `resolveInternalVisibility()` in `lib/services/agent.ts`. Unassigned-files widget is at `components/hub/UnassignedFilesView.tsx`.

---

## Surfaces

Each role uses a distinct surface. Do not mix them:

| Surface | URL | Roles allowed | Brand |
|---|---|---|---|
| **Marketing site** | `thesalesprogressor.co.uk` | Public | Dark navy + coral hero, glass cards |
| **Agent app** | `portal.thesalesprogressor.co.uk/agent/*` | `director`, `negotiator` | Warm cream + coral + glass |
| **Internal dashboard** | `/dashboard` redirects to `/agent/hub` (internal staff land on the agent hub). The `AppShell` chrome is used on `/admin/*` and the internal `/transactions/[id]` file view. | `admin`, `sales_progressor`, `superadmin` | Dark + glass + property photography backdrop (`AppShell`) |
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
  /dashboard             Redirects to /agent/hub (AppShell chrome now lives on /admin/* + /transactions/[id])
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
  /ui                    Canonical primitives (see docs/reference/COMPONENT_LIBRARY_CATALOG.md)
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
  BUILD_PLAN.md          The discipline-migration roadmap (Phase 0 - Phase 6)
  POLISH_TBD.md          Deferred polish backlog with tracked decisions
  /reference             Always-live guides
    COMPONENT_LIBRARY_CATALOG.md   Closed catalog of every primitive + every duplicated pattern
    COMPONENT_LIBRARY.md           Developer reference for canonical patterns
    DESIGN_TOKENS.md, VOICE.md, MOTION_GUIDE.md, HOVER_STATES.md, MODAL_DRAWER_*.md
  /active                Open plans + ongoing ops
  /done                  Shipped work, grouped by feature/arc
  /meta                  Housekeeping + retired prompts
  /admin                 Command Centre specifications (ADMIN_01–10)
  /chain-feature         10-part chain reference series (inter-linked)
  /chase-generation      Chase AI corpus + glossary (code-coupled)
  /help/_discovery       Raw help documentation (large self-contained)
  /polish-pass           Page-by-page polish inventory + workflow (code-coupled)
  /audits                Standalone investigation reports
.env                     Local secrets — NEVER commit
```

---

## Source-of-truth documents

When working on a topic, read the relevant doc BEFORE writing code. If a doc and the codebase contradict, surface the contradiction in your response — do not silently pick one.

| Topic | Source of truth |
|---|---|
| **The discipline migration roadmap** (what's being remediated next) | [`docs/BUILD_PLAN.md`](docs/BUILD_PLAN.md) |
| **Deferred polish backlog** (decisions on what gets fixed, grandfathered, or deferred) | [`docs/POLISH_TBD.md`](docs/POLISH_TBD.md) |
| **Component catalog** (closed list of canonical primitives + to-extract + grandfathered) | [`docs/reference/COMPONENT_LIBRARY_CATALOG.md`](docs/reference/COMPONENT_LIBRARY_CATALOG.md) |
| **Component developer reference** (how to use the canonical patterns) | [`docs/reference/COMPONENT_LIBRARY.md`](docs/reference/COMPONENT_LIBRARY.md) |
| **Agent-app internals** (glass Lab, portal theme gotcha, z-index layers, empty-state hero/card system, popup primitives) — read before `/agent/*` work; append new reusable patterns here in the same change | [`docs/reference/AGENT_APP_INTERNALS.md`](docs/reference/AGENT_APP_INTERNALS.md) |
| **Any visual decision** (colour, spacing, radius, shadow, motion, z-index) | [`docs/reference/DESIGN_TOKENS.md`](docs/reference/DESIGN_TOKENS.md) + [`design/tokens.ts`](design/tokens.ts) |
| **Any modal or drawer** | [`docs/reference/MODAL_DRAWER_INDEX.md`](docs/reference/MODAL_DRAWER_INDEX.md) → [`MODAL_DRAWER_SYSTEM.md`](docs/reference/MODAL_DRAWER_SYSTEM.md) |
| **Any user-facing string** | [`docs/reference/VOICE.md`](docs/reference/VOICE.md) |
| **Any animation or transition** | [`docs/reference/MOTION_GUIDE.md`](docs/reference/MOTION_GUIDE.md) |
| **Any hover / focus / active / disabled state** | [`docs/reference/HOVER_STATES.md`](docs/reference/HOVER_STATES.md) |
| **Before committing or declaring done** | [`docs/DEFINITION_OF_DONE.md`](docs/DEFINITION_OF_DONE.md) |
| **How to add a new screen / primitive / modal / email / migration** | [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) |
| **Recurring decisions log** (z-index, terminology sweeps, env-var conventions) | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| Role architecture | This file (CLAUDE.md, the table above) — verified against prod DB 2026-05-03 |
| Milestone engine state machine | `docs/MILESTONES_SPEC_v1.md` |
| Milestone weights and gating | `docs/MILESTONES_WEIGHTS_v1.md` |
| Command Centre product spec | `docs/admin/ADMIN_01_SPEC.md` (and ADMIN_02–10 for subsystems) |
| Visual design (agent app) | `docs/VISUAL_DIRECTION.md` |
| Active package being built | `docs/active/package-d/scope.md` (current — others under `docs/active/`) |
| Manual ops tasks (founder side) | `docs/active/ELLIS_MANUAL_TODO.md` |
| Technical debt | `docs/active/TODO.md` |
| Bug log | `docs/POST_LAUNCH_FIXES.md` |
| Test accounts | `docs/test-accounts.md` |
| Access scope (internal staff visibility) | `lib/security/access-scope.ts` — see "Access scope helper" above |

---

# Laws

The 21 binding laws of this codebase. Numbered. Enforced where possible mechanically (pre-commit / CI / ESLint), otherwise by code review and self-discipline. Every law states **how it is enforced** in its own text.

Laws apply to every session — Claude Code, human contributors, future tooling. The first action of any non-trivial task is to re-read this section.

If a law needs to change, it changes through a documented amendment: PR titled `laws: amend Law X — <reason>`, body explains old/new wording and cost of each, founder sign-off in the PR thread. See "Migration & override" at the bottom of this section.

## Law 1 — Source-of-truth first

Before writing code that affects a documented system, read the relevant spec doc in [docs/reference/](docs/reference/). Quote the specific section in the commit message. If no spec exists for what's about to be built, surface that fact and ask whether to proceed before any code change.

**Enforcement:** PR description must cite the spec section or include the line "no spec — confirmed scope with founder on <date>".

## Law 2 — Verify before claiming done

- `npx tsc --noEmit` must be clean before commit.
- Relevant tests must pass.
- Never say "shipped" or "done" without evidence: PR URL, file paths, test output, or screenshots.
- For visual changes: screenshot required. Type checking does not verify visual correctness.
- **Stage every file before commit.** Run `git add <explicit paths>` (or `git add -u`) before every `git commit`. Never rely on `git mv` auto-staging. (Burned by this on 2026-05-21.)

**Enforcement:** pre-commit hook runs tsc; CI runs tests; PR template requires evidence section.

## Law 3 — Migrations to staging first

Database migrations apply to **staging Supabase first**, verified, then to production. Never both at once. Migration filenames are `YYYYMMDDHHMMSS_descriptive_name`.

**Enforcement:** CI step asserts no unapplied prod migration newer than the latest staging-applied migration.

## Law 4 — Look before you create

Search the codebase before creating a new file. If a similar component, helper, hook, or pattern exists, extend it. Never duplicate. **No new files in `components/<domain>/` for a pattern that already exists in `components/ui/`.** No new files in `lib/services/` for behaviour already in an existing service.

**Enforcement:** PR template includes "did you search for an existing version" checkbox. Code review.

## Law 5 — One concern per PR

Each PR addresses one concern. "While I'm here I'll also fix..." is a violation. File the temptation in [docs/POLISH_TBD.md](docs/POLISH_TBD.md) instead.

**Enforcement:** code review. PR template includes "this PR addresses exactly one concern: ___".

## Law 6 — Push back when scope drifts

If a request contradicts a spec, falls outside the active package, mixes concerns that should be separate PRs, or has unstated edge cases — say so in plain English. Don't silently expand scope or guess. Surface contradictions rather than reconciling them quietly.

**Enforcement:** self-discipline. Reinforced in CLAUDE.md re-reads.

## Law 7 — Multi-tenant safety (non-negotiable)

For customer agency data: every database query filters by `agencyId` derived from the authenticated session. For routes accepting client-supplied IDs: verify the resource belongs to the authenticated user's scope BEFORE acting. Use the access scope helper at [lib/security/access-scope.ts](lib/security/access-scope.ts):

- `scopeTransactionWhere(scope)` for lists
- `scopeOwnershipWhere(scope, id)` for single-tx guards
- `scopeChaseTaskWhere` / `scopeReminderLogWhere` for related models

**Never** introduce ad-hoc inline `findFirst({ where: { id, agencyId } })` — they break for internal staff (`agencyId = null`).

For internal staff: agencyId filtering doesn't apply. `sales_progressor` scoped by `assignedUserId`. `admin` / `superadmin` see everything via the helper.

**A query that doesn't have a clear access model is a tenant isolation hole.** No exceptions outside `/app/command/*` (which uses `commandDb` with explicit superadmin context).

**Enforcement:** automated test asserts every list endpoint goes through the access scope helper. Pre-commit hook flags new `findFirst({ where: { ..., agencyId: ... } })` patterns that don't use the helper.

## Law 8 — Command Centre isolation

Code under `/lib/command/` and `/app/command/` is superadmin-only.

- Do not import from `/lib/command/*` into agent app or internal dashboard code.
- Do not import agent app or dashboard business logic into `/lib/command/*` unless it's a genuinely shared utility (e.g. `lib/email.ts`, `lib/prisma.ts`).
- Command Centre uses `commandDb` from [lib/command/prisma.ts](lib/command/prisma.ts) for queries needing superadmin context.

**Enforcement:** ESLint rule on import paths.

## Law 9 — Brand consistency

Three distinct visual surfaces for logged-in users. Never mix tokens between them:

| Surface | Shell | Visual system |
|---|---|---|
| Agent app | [`AgentShell`](components/layout/AgentShell.tsx) | Warm cream, coral primary `#FF6B4A`, glass cards, humanist sans-serif |
| Internal dashboard | [`AppShell`](components/layout/AppShell.tsx) | Dark photo backdrop with near-black overlay, glass sidebar |
| Command Centre | Inline in [`app/command/(protected)/layout.tsx`](app/command/(protected)/layout.tsx) | Utilitarian dark `#0a0a0a`, hairline borders `#262626`, blue accent `#2563eb`, solid surfaces (no glass), Lucide icons |

Social card templates in [/lib/command/content/images/](lib/command/content/images/) inherit from the marketing site's dark hero (navy + coral).

**Enforcement:** code review. Components in `components/layout/` are the gate for visual systems.

## Law 10 — Show raw evidence when stakes are high

For architectural questions, role/permission questions, schema questions, or anything where being wrong has compounding cost:

- Quote the actual file content verbatim.
- Run the actual database query and show the result.
- Don't summarise. Don't interpret. Show the raw text or output.

When the founder asks "show me how X works": show file paths, line numbers, and direct quotes. Save interpretation for after the evidence is on screen.

**Enforcement:** self-discipline. Added because two CC sessions made confident architectural claims that turned out to be wrong.

## Law 11 — Ask when unclear

If a decision is needed and not documented anywhere: pause. State the decision in plain English. Offer 2–3 reasonable options with pros/cons. Wait for guidance. Don't guess. Don't proceed silently. Don't fabricate a decision and bury it in a commit.

**Enforcement:** self-discipline.

## Law 12 — Definition of Done

Every commit and every component checks against [docs/DEFINITION_OF_DONE.md](docs/DEFINITION_OF_DONE.md):

- If a component doesn't have hover / focus / active / disabled states, it isn't done.
- If a string hasn't been voice-passed against [docs/reference/VOICE.md](docs/reference/VOICE.md), it isn't done.
- If a modal doesn't use the canonical pattern from [docs/reference/MODAL_DRAWER_SYSTEM.md](docs/reference/MODAL_DRAWER_SYSTEM.md), it isn't done.
- If a commit changes a CSS token without updating [design/tokens.ts](design/tokens.ts), it isn't done.
- If a UI element ships without loading, empty, error, and first-time states, it isn't done.

**Enforcement:** PR template DoD checklist. Code review.

---

## Law 13 — Never half-build

No dead controls. No no-op links. No buttons that do nothing. No `disabled` placeholders standing in for "we'll wire this up later". No dashed-border "coming soon" boxes.

Every UI element either:
- works for real against the live data layer, OR
- works against a typed mock service in [lib/services/](lib/services/) that returns data in the production shape, marked with `// lands: <phase or date>` so future readers know why it's mocked

If a feature lands in a later phase, **the seam is real**: the service exists, the types exist, the component renders against the service. The only thing that's not yet live is the data source.

**Why:** the half-built dashed-box pattern is the single biggest reason features feel less complete than they should. We don't ship "coming soon" — we ship working seams.

**Enforcement:** pre-commit grep sweep for:
- `onClick={() => {}}` and `onClick={() => undefined}` (literal no-ops)
- `// TODO: wire up` / `// TODO: implement` in committed code
- `disabled` props paired with `title="Coming soon"` or similar

## Law 14 — Every UI element is a library component

If a pattern exists in [components/ui/](components/ui/), you use it. If a pattern doesn't exist but is duplicated elsewhere in `components/<domain>/`, you propose adding it to [docs/reference/COMPONENT_LIBRARY_CATALOG.md](docs/reference/COMPONENT_LIBRARY_CATALOG.md) **before** building. Never roll a new primitive without writing down what it is first.

Domain-specific components stay in their domain folder, but the domain folder must have a `README.md` listing every component and one-line "why this is domain-specific, not a primitive."

**Exception:** the grandfather rule (Law 19) allows existing duplicate patterns to remain in place until their surface comes up for remediation.

**Enforcement:** pre-commit hook checks new files in `components/<domain>/` against the catalog's "to-extract" list — if a canonical primitive exists for the pattern, the commit is blocked.

## Law 15 — Scripts must justify

Every new file in [scripts/](scripts/) must:

- Have an entry in [docs/SCRIPTS_REGISTRY.md](docs/SCRIPTS_REGISTRY.md) recording: purpose, lifetime (one-shot / ongoing), author, date, deletion criteria.
- Pass the "could this be a feature, an admin action, an npm script, or a test instead?" check. If yes, it goes there, not in `scripts/`.
- If one-shot: a deletion ticket exists at commit time, referenced in the registry entry.

**Why:** the `scripts/` directory grew to 155 files. Most were one-off band-aids that never got cleaned up. The cost is invisible until the directory becomes the basement where bugs hide. Target post-Phase-4: ≤ 15 files.

**Enforcement:** pre-commit hook fails if a new `scripts/` file lacks a SCRIPTS_REGISTRY entry.

## Law 16 — No bulk rewrites

No automated find/replace across multiple files. No `sed` sweeps. No bulk codemod. No mass-renames via regex.

Every change is **hand-rolled**, **one consumer at a time**, in a **single reviewable PR**. Reversibility per file is a feature, not a nice-to-have.

**Exception:** a single explicit rename via the IDE's rename-symbol tool, scoped to a single symbol, is acceptable if visually reviewed before commit.

**Enforcement:** self-discipline. Reinforced by Law 5 (one concern per PR) — a bulk rewrite is by definition many concerns.

## Law 17 — Behavioural baseline before remediation

Before any [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) Phase 3 surface remediation begins, capture a baseline:

- Every route fetched on page load
- Every server action called
- Every click handler and its observable effect
- Every email / push / DB side-effect
- Screenshots: desktop 1280px AND mobile 375px, happy + error states

An E2E Playwright happy-path test must exist for the surface. If it doesn't, **write the test first** as part of the same PR series.

After the work: re-capture the baseline. Diffs are reviewed. Any unexplained behavioural diff is a regression.

**Enforcement:** PR template for Phase 3 surface work requires baseline doc link.

## Law 18 — Visual + behavioural regression in CI

Three layers:

1. **Visual regression** — Playwright `toHaveScreenshot()` covers every canonical primitive in `components/ui/` rendered in every state in `/dev/gallery`, at desktop 1280px and mobile 375px. Diff threshold tight (~0.1%). Runs on every PR.
2. **Behavioural regression** — Playwright happy-path E2E test per Phase-3-completed surface. Login → navigate → click primary CTA → assert side-effect. Runs on every PR.
3. **Multi-tenant safety regression** — automated test asserts every list endpoint goes through the access scope helper from Law 7. Runs on every PR.

Visual diff failures block the PR. No override.

**Enforcement:** CI. Cannot merge to master if any of the three layers fails.

## Law 19 — Grandfather generously

When a bespoke pattern can't be migrated to a canonical primitive without risking behavioural change:

- Mark it `outlier-grandfathered` in [docs/reference/COMPONENT_LIBRARY_CATALOG.md](docs/reference/COMPONENT_LIBRARY_CATALOG.md).
- File a POLISH_TBD entry with `decision: deferred because <reason>`.
- Move on.

Grandfathered items are reviewed quarterly. They either get bumped to active migration or stay grandfathered for another quarter. "Can't safely migrate" is a **valid final answer**. Forced migrations break things. We don't break things to win.

**Enforcement:** self-discipline. The pressure to "do it properly" is the rewrite trap — Law 19 is the safety valve.

## Law 20 — No hard-coded demo data

- No hard-coded seeded customer names in user-facing copy.
- No hard-coded agency names in user-facing copy.
- No hard-coded demo addresses in user-facing copy outside seed files and Playwright tests.
- Strings that inject names use the standard interpolation: `{address}`, `{name}`, `{firstName}`.

**Enforcement:** pre-commit grep sweep for known demo strings outside whitelisted directories (`scripts/seed-*`, `__tests__/`, `e2e/`).

## Law 21 — Voice gate on user-facing strings

Every user-facing string passes [docs/reference/VOICE.md](docs/reference/VOICE.md):

- No em-dashes in prose (banned 2026-06-07).
- No exclamation marks in client-facing copy.
- No system self-references ("the system", "the platform", "automatically"). Use "we'll" instead.
- No hedging language ("kind of", "perhaps", "we think", "should be").
- No "round" as a user-facing noun (use "sale").
- No titles (Mr./Mrs./Miss/Dr.) in rendered names.
- No technical codes (status enums, milestone IDs) surfaced to users.
- No "delete" in user-facing strings — use "remove".

**Enforcement:** pre-commit grep sweep for em-dashes in committed `*.tsx` / `*.ts` strings outside comments. Other voice rules enforced by code review.

---

## Migration & override

If a law needs to change, it changes through a documented amendment:

1. PR titled `laws: amend Law X — <reason>`.
2. Body explains the change, the cost of the old wording, and the explicit cost of the new wording.
3. Founder sign-off in the PR thread.
4. Merged to master.

Overrides for a single PR exist in genuine emergencies:

- Commit message includes `LAWS-OVERRIDE: <law-number> <one-line reason>`.
- Override logged in [docs/LAW_OVERRIDES.md](docs/LAW_OVERRIDES.md).
- Reviewed at the next quarterly review. If overrides for a given law exceed 2 in a quarter, the law itself is reviewed.

Pre-commit hooks ship in **warn-only mode for two weeks** after introduction. If zero false positives in that window, they flip to block mode.

---

# Hard rules — absolute (never violated)

These are non-negotiable absolutes. Distinct from Laws because they have no override mechanism — they cannot be overridden by any rationale.

- Never commit `.env` or any file containing secrets.
- Never auto-publish to social platforms (LinkedIn, Twitter, Instagram, TikTok) without per-post user confirmation.
- Never delete user data without explicit confirmation; default to anonymisation.
- Never add a new third-party integration without surfacing it in [docs/active/ELLIS_MANUAL_TODO.md](docs/active/ELLIS_MANUAL_TODO.md) (env vars, signup steps, DPA requirements).
- Never bypass the multi-tenancy model (covered by Law 7).
- Never mark something "done" that hasn't been verified (covered by Law 2).
- Never invent brand colours, fonts, or logo assets. Extract from existing codebase or pause and ask.
- Never ship migrations to production without staging verification first (covered by Law 3).

---

# Anti-drift discipline

The habits that keep the Laws from rotting. Read in conjunction with the Laws above.

1. **Re-read this file at the start of any non-trivial task.**
2. **Re-read the active package scope doc** if one exists.
3. **Quote the relevant law in commit messages** to prove it was read.
4. **File temptations as POLISH_TBD entries**, don't ship them (Law 5).
5. **Surface contradictions, don't reconcile silently** (Law 6).
6. **Hard pauses are mandatory pauses**, not "optional checkpoints I can skip if I'm confident."
7. **Show raw evidence, not interpretation** (Law 10).
8. **Component canonicalisation.** Before creating any new UI element, check [docs/reference/COMPONENT_LIBRARY_CATALOG.md](docs/reference/COMPONENT_LIBRARY_CATALOG.md). If a canonical pattern exists, use it. If one doesn't, add it to the catalog *before* building (Law 14).
9. **Grandfather rule** (Law 19). Known outliers in existing code are listed in COMPONENT_LIBRARY_CATALOG.md / DESIGN_TOKENS.md / VOICE.md as grandfathered. Do not refactor old code as a side effect of new work. Existing cleanup is commissioned separately through [BUILD_PLAN.md](docs/BUILD_PLAN.md).

---

## How to respond

For every PR or significant change, your response includes:

- **What I did** — plain English, no jargon
- **Files changed** — list with one-line "what changed" per file
- **Tests run** — `tsc` output, any test commands, migration verification
- **What you need to do** — manual steps required (env vars, dashboard config, follow-up actions). If a manual task is required, it must also be added to `docs/active/ELLIS_MANUAL_TODO.md`
- **Risks / what could go wrong** — honest assessment, not reassurance
- **Next step** — one clear action

For routine read-only operations (reading a file, running a search), keep response minimal.

For multi-PR runs with autonomous gates: one-line acknowledgement per PR ("PR XX shipped"), full checkpoint at hard pauses only.

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

When adding a new integration, surface it in `docs/active/ELLIS_MANUAL_TODO.md` with the manual setup steps the founder needs to take.

---

## Communication style

- Plain English over jargon
- Specific over vague ("created `app/api/chains/route.ts` with agencyId check on line 42" beats "added some auth")
- Honest over reassuring ("I'm not sure this handles the case where X" beats "should be fine")
- Direct over hedged
- Brief by default, detailed when stakes are high (production data, security, billing)

---

## When this file changes

If you make changes that affect the architecture, file structure, role model, or Laws above — propose an update to this file in the same PR. Surface "I'm proposing to update CLAUDE.md because…" in the response.

For Laws specifically: amendments follow the "Migration & override" mechanism above. PR titled `laws: amend Law X — <reason>`.

This file should stay accurate. A stale CLAUDE.md is worse than no CLAUDE.md.
