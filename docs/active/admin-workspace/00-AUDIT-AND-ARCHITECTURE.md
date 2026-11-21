# TSP Admin — Founder Workspace: audit & proposed architecture

**Status:** investigation + planning only. No code changed, no schema touched, no behaviour altered.

**Dates:** audit 2026-11-15 · decisions locked 2026-11-15 (founder review).
**Method:** parallel read-only sub-audits tracing the actual implementation of every `/command/*` route, its actions and its backend — cross-checked against the prior [2026-08-13 Command Centre audit](../../audits/COMMAND_CENTRE_ADMIN_AUDIT_2026-08-13.md), the [admin spec set](../../admin/README.md), and [PRODUCT_TRUTH](../../PRODUCT_TRUTH.md) §1–6.

**The one non-negotiable:** nothing is proposed for deletion. All 65 route pages are accounted for in the preservation map (§C). Where consolidation is proposed the functionality moves; it never disappears.

**Companion docs:**
- [`01-PHASE-0-1-PROPOSAL.md`](01-PHASE-0-1-PROPOSAL.md) — the detailed, file-accurate Phase 0 + Phase 1 implementation proposal (the slice to approve before any coding).
- [`02-SECURITY-REMEDIATION.md`](02-SECURITY-REMEDIATION.md) — the dedicated security remediation proposal (step-up, `commandDb`, IP allowlist, audit coverage).

---

## Contents

- [Decisions locked (founder-approved, 2026-11-15)](#decisions-locked-founder-approved-2026-11-15)
- [A. Current Command Centre audit](#a--current-command-centre-audit)
- [B. Proposed new navigation (refined)](#b--proposed-new-navigation-refined)
- [C. Existing → new preservation map](#c--existing--new-preservation-map)
- [D. Founder-workspace opportunities (monitor → operate)](#d--founder-workspace-opportunities-monitor--operate)
- [E. Missing capabilities, prioritised](#e--missing-capabilities-prioritised)
- [F. Implementation sequence](#f--implementation-sequence)
- [G. Risks and open questions](#g--risks-and-open-questions)

---

## Decisions locked (founder-approved, 2026-11-15)

1. **Eight top-level sections approved** — Today · Customers · Money · Operations · Growth · Content · Platform · System. But *challenge the internal organisation of every section* — combine overlapping workflows, add secondary nav, cut complexity. Do **not** convert 40 links into 40 tabs. Refined internals are in §B.
2. **Unified customer account is built by composing the existing Agency File**, not rebuilt. Preserve the existing backend actions, permissions, data relationships and behaviour. The account becomes the central place to understand, manage and support each customer.
3. **Global search is prioritised alongside Customers**, not deferred to the end — agencies, progression companies, people and files.
4. **Financial operations are staged:** read-only billing operations first; then **Stripe refunds as the first write action**, once security, audit and billing reconciliation are in place. All financial actions must be **server-authorised, auditable, idempotent, and reconciled with Stripe as the authoritative provider**.
5. **A dedicated security remediation proposal** covers the four findings (hybrid-superadmin 2FA bypass, `commandDb` full DB access, `ADMIN_IP_ALLOWLIST`, incomplete audit logging) — intended design, real risk, affected code, safe sequence. **Server-side step-up is required for sensitive financial/destructive operations, including the founder's own account.** Do **not** auto-enforce IP restrictions, change DB access, or alter authentication without explaining consequences and getting approval → see [`02-SECURITY-REMEDIATION.md`](02-SECURITY-REMEDIATION.md).
6. **Preserve unfinished/diagnostic functionality:** hide **Friction** and **Automations** from primary nav but keep routes+code; keep **Email Threading** as a diagnostic until Outlook routing is independently verified. Nothing deleted at this stage.
7. **Preserve behaviour, not just routes:** the preservation map becomes a **testable functionality contract** across eight dimensions (forms/mutations, filters/search, modals/drawers/contextual actions, URL params/deep links, permissions/auth, background jobs/integrations, audit logging, error/empty states). Format + Phase-1 application in [`01`](01-PHASE-0-1-PROPOSAL.md).
8. **Sequencing reprioritised** (§F): security & audit prerequisites → nav architecture & shared workspace patterns → unified customer accounts → global search → read-only billing operations → remaining consolidation → new operational actions. No big-bang.

---

## A — Current Command Centre audit

### A.1 Shape

**65 route pages** under `app/command/(protected)/`, plus the shell (`app/command/layout.tsx` outer gate; `(protected)/layout.tsx` 2FA/step-up + page-view audit; `page.tsx` → redirect; `auth/step-up`, `setup-2fa`). The nav (`components/command/CommandSidebar.tsx`) groups them into six labelled sections but presents ~40 as a **flat list of links** — that flat list is the core problem, not the number of groups.

This is the same system the [2026-08-13 audit](../../audits/COMMAND_CENTRE_ADMIN_AUDIT_2026-08-13.md) described (then 17 screens). Its analyst-console→operator-cockpit reorganisation was *partly* adopted (the Today/Agencies/Files/Money spine exists) but the surface re-sprawled from 17 to 65, and almost everything added since is still read-only reporting.

### A.2 Access (verified, with one correction to the first-pass audit)

- **Gate:** `getServerSession` + `hasSuperAdminPowers(session)` (`lib/agent-session.ts:78`) at the outer layout; re-asserted in the protected layout. `hasSuperAdminPowers` = `role === "superadmin"` **or** email in `HYBRID_SUPERADMIN_EMAILS` (`lib/security/hybrid-emails.ts` — one entry, `ellis@…`).
- **2FA / step-up:** real superadmins need a TOTP secret + a valid HMAC-signed `command_session` cookie (`lib/command/session.ts`), with `STEP_UP_MAX_AGE_MS` 30 min / `IDLE_MAX_AGE_MS` 8 h / `SESSION_HARD_MAX_MS` 24 h (`lib/command/config.ts:27-31`). **Hybrid superadmin (you) skips 2FA/step-up entirely** — the protected layout derives `isHybridSuperadmin = session.user.role !== "superadmin"` (`(protected)/layout.tsx:38`).
- **Step-up on mutations:** only **four route handlers** check the step-up cookie — `offboard` + the three `/api/gdpr/*` routes — each via a duplicated local `stepUpValid()`, and each *also* hard-requires `role === "superadmin"` (so hybrid can't invoke them). **Every other mutation checks superadmin only, never step-up.**
- **`commandDb`** (`lib/command/prisma.ts`) is a plain full-access `PrismaClient` — **no RLS/superadmin DB context** (CLAUDE.md is wrong on this; `rls-test` confirms RLS bypass). Isolation is app-layer only.
- **`ADMIN_IP_ALLOWLIST` — correction:** it **is** enforced, in `middleware.ts:50-60` (403 if client IP not listed). The `lib/command/config.ts:19-25` parse is the dead copy (imported nowhere). Enforcement uses exact-string match (`includes`), so **CIDR ranges silently never match** despite the docs. Default empty = off.
- **Audit:** `AdminAuditLog` via `recordAdminAction()` (`lib/command/audit/write.ts`), append-only (ESLint `no-admin-audit-mutation`). Coverage **partial** — see A.5.

### A.3 Operational vs read-only

Of the 65 pages, genuinely **operational** (real writes/sends/destructive): the customer surfaces (`agency/[id]`, `agencies` Controls, `agencies/[userId]`), comms (`whatsapp`, `proposals`, `email-senders`, milestone/email copy editors, `files`, `emails` kill-switches), growth (`prospects`, `ai-outreach`, `experiments`, `insights` signal actions), the whole Providers subsystem, and system controls (`settings` AI kill-switch, `settings/connections`, `updates`, `critique`, `admin/demo` destructive reset). **Everything else (~2/3) is read-only reporting.** Two dead stubs: `friction`, `automations`.

### A.4 Structural facts that shape the redesign

1. **The Agency File (`/command/agency/[agencyId]`) is already the customer convergence point** — the single per-agency edit surface; the whole link graph converges on it. The unified account is ~70% built.
2. **Deliberate overlap in three clusters:** customer views (`agencies` / `agency/[id]` / `revenue/[agencyId]` / `trials/[slug]`), analytics (`website-growth` umbrella over `activation`/`growth`/`adoption`; `growth` owns cohorts `retention` borrows), business revenue (`businesses` ↔ `revenue`).
3. **Shared write paths that must not fork** — the 6 automation flags are written from **both** the `agencies` Controls matrix and the Agency File via identical `app/actions/agency-{chase,weekly-update,whatsapp}` actions. (Full list of 5 shared paths in [`01`](01-PHASE-0-1-PROPOSAL.md).)
4. **Shared scope contract** (`?mode`/`?agency` via `parseMode`/`parseAgencies`, linked with `buildFilterUrl` in `lib/command/scope.ts`) couples the sidebar to several pages. Preserve on any move.
5. **Deep-link graph** to `/command/files?tx=…` and `/agent/transactions/[id]`. One broken link found: `enquiries-chase` → `/transactions/[id]` (route gone).
6. **Content is fully self-contained** (13 pages, own lib + ~10 models, no external dependants) — already one unit.
7. **Providers is a coherent self-contained CRM** — only debt is internal duplication (a `StatusBadge` reimplemented 5×).

### A.5 The two facts that gate "operate"

- **Zero live Stripe writes** anywhere under `lib/command/**` or `app/api/command/**`. The pages only *read* Stripe IDs / `InvoiceLine` and deep-link out. All money movement is in crons (`business-billing`, `accrue-invoices`, `issue-invoices`, `check-failed-payments`). Refund-from-TSP is greenfield.
- **Partial audit coverage.** Logged: page views, auth, agency close/purge, all provider/quote actions, GDPR routes. **Not logged:** content AI routes, logo/photo uploads, milestone/email-template edits, agent writes, AI kill-switch, publishing, demo reset. Closing this gates any financial action.

---

## B — Proposed new navigation (refined)

**Principle:** fewer destinations; the customer as a first-class object you *open*; each section organised by the job it does, with secondary nav only where it earns its place. The refinement below **challenges each section's internals** rather than mapping pages 1:1 to tabs.

### Top-level (8) + a global search bar

A **persistent ⌘K global search** sits above the nav (agencies / progression companies / people / files) — see §D and [`01`](01-PHASE-0-1-PROPOSAL.md).

### 1. Today — *Monitor*
**2 tabs:** Today (`overview`) · Briefing (`insights` + signal triage). De-duplicate the businesses tile + signal strip it currently shares with other pages.

### 2. Customers — *Manage + Investigate* — the centrepiece
**Sub-nav:** Overview · Estate agencies · Progression companies · People · Trials.
Each list opens a **unified account workspace**. The Agency File's 9 visual blocks collapse to **6 tabs** (not 1:1):

| Account tab | Composed from |
|---|---|
| **Overview** | header + alerts + live-sales snapshot + recent activity (`getAgencyFileHeader`, `getAgencySales`) |
| **People** | team table + agent detail (`getAgentDetail`), photo/branding editors — the current `agencies/[userId]` surface, in-context |
| **Sales & files** | `getAgencySales` + links to `/command/files?tx=` |
| **Billing** | `getAgencyRevenueDetail` (pipeline/banked/fees) **+** `AgencyFeeEditor` + `MarkFreeToggle` — single fetch of the shared `Agency` billing row |
| **Comms & deliverability** | `getAgencyEmailLog` + `getAgencyReachability` + sender/branding (read) |
| **Settings** | `AgencyAutomationControls` + readiness (`getAgencySetupReadiness`) + onboarding actions + portal/branding config + **Data & GDPR as a step-up-gated danger panel** |

*Progression-company account* → **5 tabs:** Overview · Team · Clients · Billing · Setup (sending identity folded into Setup). Already account-shaped (`businesses/[id]`).
*People* = cross-customer roster → person page (reachable standalone and from an account's People tab).
*Trials* = the trial cockpit kept as a **lens over an account**, not a tab.

### 3. Money — *Monitor + Operate*
**3 tabs:** Revenue (`revenue`, with `revenue/breakdown` as an inline drill-down, not a sibling) · Referrals (the Providers subsystem + quotes) · **Billing operations** (new — read-only first: failed payments, pending invoices, pending-on-exchange; later the home for Stripe refunds/credits). *Fee rules* becomes a reference panel inside Billing operations, not a tab.

### 4. Operations — *Operate* — the daily "do the work" surface
**5 tabs:** Files (`files`) · Messages (`outbound`) · WhatsApp (`whatsapp`) · Proposed updates (`proposals`) · Deliverability (`email-senders` + `agent-emails` log + the `email-threading` diagnostic, kept per decision 6).

### 5. Growth — *Operate + Monitor*
**5 tabs:** Prospects (CRM) · Outreach (`ai-outreach` — rename its "Experiments" to resolve the collision with product tests) · **Analytics** · Experiments (product tests) · Chase performance (`enquiries-chase`).
*Analytics* has its own secondary nav absorbing the six overlapping read-only pages behind the `website-growth` umbrella: Overview (`website-growth`) · Activation · Retention · Adoption · Feature usage · Trends · Timeframes · Chain invites — as **views within one page**, not seven siblings. `crm-requests` sits here as a demand view.

### 6. Content — *Operate* — 11 tabs → **5**
Reorganised by job, not by page:

| Tab | Absorbs |
|---|---|
| **Ideas** | Inbox + Opportunities + Topics + Thoughts (all feed Create via `?item`/`?opp`/`?thought`) |
| **Create** | the guided Create flow + Drafts + image studio |
| **Plan** | Calendar + Strategy (quarter focus, balance, brand review) |
| **Measure** | Performance + `engagement/[draftId]` drill-down |
| **Brand** | Brand positioning + memory + Voice training |

Overview becomes the section landing above the tabs. Nothing in `lib/command/content/*` changes — this is pure reframing of routes into one tabbed home.

### 7. Platform — *Manage* — product-behaviour configuration
**Tabs:** Email catalogue (`emails`, incl. bucket kill-switches) · Milestone emails & updates (`milestone-emails` + `milestone-updates`) · Other client emails (`email-templates`) · Chase cadence (`solicitor-chase`) · Rules (`rules`) · Automations (hidden until built — decision 6).

### 8. System — *Monitor + Operate*
**Grouped tabs:** Monitoring (Status `health` · Activity · Audit log) · Settings (AI kill-switch + Connections) · Founder tools (Platform updates · Critique) · Reset demo (isolated, staging-only). Friction hidden here (route retained).

**Future top-level — Progressor Network:** not built; gets its own section when the agent↔progressor marketplace exists. Provider referrals stay under Money until then.

**Net effect:** 8 destinations + a global search bar instead of a 40-link wall; the customer becomes an object you open; "operate" surfaces (Operations, Money → Billing ops) are named so new capability has an obvious home; Content 11→5, the Agency account 9→6, Money 5→3, the analytics six-page cluster → one page with secondary nav.

---

## C — Existing → new preservation map

Every one of the 65 route pages. Treatment: **Retain** · **Relocate** · **Consolidate** · **Improve** · **Investigate**. (In [`01`](01-PHASE-0-1-PROPOSAL.md) each Phase-1 row is expanded into the testable functionality contract per decision 7.)

> Routes under `app/command/(protected)/`. "Risk" = relocation/consolidation risk.

### Customers

| Existing route | Functionality | New home | Treatment | Risk |
|---|---|---|---|---|
| `agencies` | Agency + agent roster, 6-flag Controls matrix, support-email | Customers → Estate agencies list + People | Consolidate | Med — Controls shares write path with Agency File |
| `agencies/[userId]` | Agent usage, photo, agency email branding | account → People → person | Relocate | Med — 3 API routes; logo is agency-wide cross-surface write |
| `agency/[agencyId]` | **Agency File** — all per-agency edits, GDPR/offboard, view-as | Estate-agency account (spine) | Improve | **High** — concentrates writes + destructive paths |
| `businesses` | External-business roster + billing pulse | Customers → Progression companies list | Relocate | Low |
| `businesses/[id]` | Business detail | Progression-company account | Relocate | Low |
| `revenue/[agencyId]` | One agency's revenue | account → Billing tab | Consolidate | Med — reads `revenue` vs Agency File's `agency-file`; single-source the shared `Agency` row |
| `trials/[slug]` | Trial cockpit (7 read-only tabs) | Customers → Trials (lens) | Retain | Low-med — registry hard-coded in `lib/command/trials.ts` |

### Money

| Existing route | New home | Treatment | Risk |
|---|---|---|---|
| `revenue` | Money → Revenue | Retain | Med — preserve `?mode/?agency` scope |
| `revenue/breakdown` | Money → Revenue (drill-down) | Consolidate | Low — preserve `?metric` links |
| `providers` (+ 4 editor components) | Money → Referrals | Relocate | Low |
| `providers/service-types` (+2) | Money → Referrals config | Relocate | Low |
| `providers/quotes` | Money → Referrals (quotes) | Relocate | Med — `OutboundEmailQueue` `quote:{id}` contract |
| `providers/quotes/[id]` (+ StatusControls) | Money → Referrals quote | Relocate | Med — hard link into `/agent/transactions` |

### Operations

| Existing route | New home | Treatment | Risk |
|---|---|---|---|
| `files` | Operations → Files | Retain | Med — writes portal-visible hero photo |
| `outbound` | Operations → Messages | Retain | Low-med — `bodySearch` tsvector |
| `whatsapp` | Operations → WhatsApp | Retain | **High** — many mutations + external bridge/Meta |
| `proposals` | Operations → Proposed updates | Retain | **High** — confirm cascade + agent-run + load-time write |
| `email-senders` (+actions) | Operations → Deliverability | Relocate | Med — SendGrid + shared verified-email records |
| `agent-emails` | Operations → Deliverability (log) | Relocate | Low |
| `email-threading` | Operations → Deliverability (diagnostic) | **Retain (per decision 6)** | Very low |

### Growth

| Existing route | New home | Treatment | Risk |
|---|---|---|---|
| `prospects` | Growth → Prospects | Retain | High coupling — write surface + AI |
| `ai-outreach` | Growth → Outreach | Improve | High — email/AI spend; **fix stale "read-only" header** |
| `website-growth` | Growth → Analytics (umbrella) | Consolidate | Low |
| `activation` | Growth → Analytics → Activation | Consolidate | Med — canonical funnel others cross-link |
| `retention` | Growth → Analytics → Retention | Consolidate | Med |
| `adoption` | Growth → Analytics → Adoption | Consolidate | Low-med — one direct `prisma` query to port |
| `followup-usage` | Growth → Analytics → Feature usage | Consolidate | Low — URL/title drift |
| `growth` | Growth → Analytics → Trends | Consolidate | Med — owns `weeklyCohort` |
| `timeframes` | Growth → Analytics → Timeframes | Consolidate | Low |
| `chain-invites` | Growth → Analytics → Chain invites | Consolidate | Low |
| `experiments` | Growth → Experiments | Retain | Med — rename to resolve collision |
| `enquiries-chase` | Growth → Chase performance | Retain | Low — fix broken `/transactions/[id]` link |
| `crm-requests` | Growth → Analytics (demand) | Relocate | Very low |

### Content (all → Content section, 5 tabs)

`content` (Overview landing) · `content/inbox`,`content/opportunities`,`content/topics`,`content/thoughts` → **Ideas** · `content/create`,`content/drafts` → **Create** · `content/calendar`,`content/strategy` → **Plan** · `content/performance`,`content/engagement/[draftId]` → **Measure** · `content/brand`,`content/voice` → **Brand**. Treatment: Consolidate. Risk: Low (self-contained).

### Platform

| Existing route | New home | Treatment | Risk |
|---|---|---|---|
| `emails` (+EmailCatalogue, actions) | Platform → Email catalogue | Relocate | Low-med — platform-wide bucket switches |
| `milestone-emails` | Platform → Milestone emails & updates | Relocate | Low |
| `milestone-updates` | Platform → Milestone emails & updates | Relocate | Med — writes portal-visible copy |
| `email-templates` | Platform → Other client emails | Relocate | Low |
| `solicitor-chase` | Platform → Chase cadence | Relocate | Low |
| `rules` | Platform → Rules | Retain | Low |

### System

| Existing route | New home | Treatment | Risk |
|---|---|---|---|
| `overview` | Today → Today | Retain | High coupling (hub) |
| `insights` | Today → Briefing | Retain | Med |
| `health` | System → Monitoring (Status) | Retain | Low |
| `activity` | System → Monitoring (Activity) | Retain | Low |
| `audit` | System → Monitoring (Audit log) | Retain → Improve | Low — gains newly-logged actions |
| `settings` | System → Settings | Retain | **High** — sole home of global AI kill-switch |
| `settings/connections` | System → Settings (Connections) | Retain | Med — Outlook |
| `updates` | System → Founder tools (Platform updates) | Retain | Med — publishes to agents |
| `critique` | System → Founder tools (Critique) | Retain | Low |
| `admin/demo` (+ResetDemoForm) | System → Reset demo (isolated) | Retain | **High** — cross-env destructive |
| `friction` | hidden (route kept, per decision 6) | Investigate-later | — dead stub |
| `automations` | hidden (route kept, per decision 6) | Investigate-later | — dead stub |

*(Shell/auth retained unchanged.)*

**Coverage check:** 65 pages, all mapped. 0 deletions. `friction`/`automations` hidden-not-removed; `email-threading` retained as diagnostic — all per decision 6.

---

## D — Founder-workspace opportunities (monitor → operate)

Where TSP Admin performs the action instead of sending you to another tool. Each: what you do today, safety, what exists to build on, where it lands.

1. **Refunds (first write action).** Today: Stripe dashboard. In-app: refund against a charge with step-up + typed confirm + idempotency key + audit + Stripe-reconciled. Build-on: Stripe IDs/`InvoiceLine` already read; **zero Stripe writes exist** → new infra. Lands: Customers → account → Billing, and Money → Billing operations.
2. **Retry/resolve failed payments.** Build-on: `check-failed-payments` cron detects them. Lands: Money → Billing operations.
3. **Manage a progression-company subscription** (seats/pause/cancel). Build-on: `getBusinessPlanSchedule` already reads the schedule. Lands: Progression-company account → Billing.
4. **Issue/void/resend an invoice.** Build-on: `accrue-invoices`/`issue-invoices` crons + `InvoiceLine`. Lands: Money → Billing operations.
5. **Email delivery investigation + resend.** Build-on: `OutboundEmailQueue` + `send-failures` already surface bounce/block. Lands: account → Comms & deliverability.
6. **Onboarding actions** — resend director/portal invites, trigger password reset (mind the SendGrid reset rate-limit). Lands: account → Settings (onboarding).
7. **Lifecycle you already have** — view-as, close/purge, GDPR erase, fee tier, mark-sale-free, automation flags — surfaced consistently in the account **and brought fully under the audit log** (several aren't today).
8. **Entitlements/plan per customer** — consolidate scattered fee tier + flags + access into one panel.

**Guardrail position:** external services (Stripe, SendGrid) stay the source of truth; TSP Admin is the secure interface. Every financial/destructive action → step-up (incl. founder), typed confirm, idempotency guard, `AdminAuditLog` row with before/after.

---

## E — Missing capabilities, prioritised

| # | Capability | Value | Complexity | Risk | Verdict |
|---|---|---|---|---|---|
| 1 | **Unified customer account workspace** | Very high | Medium | Low | Phase 1. Recomposition; Agency File is 70% of it. |
| 2 | **Full admin-audit coverage** + per-account activity timeline | High | Low | Low | Phase 0 enabler — prerequisite for financial actions. |
| 3 | **Global search** (⌘K across agencies/businesses/people/files) | High | Low-med | Low | Phase 1 (alongside Customers — decision 3). |
| 4 | **Billing operations — read-only** (failed payments, pending invoices) | High | Low-med | Low | After accounts; surfaces existing cron data. |
| 5 | **Billing operations — Stripe refunds then writes** | Very high | High | High | After 1–4 + security; staged, step-up, reconciled. |
| 6 | **Support & diagnostics** per customer (delivery timeline, integration status, Sentry errors) | Med-high | Medium | Low | Sentry MCP available. |
| 7 | **Entitlements/plan model** | Medium | Medium | Low-med | Consolidate scattered fee/flags/access. |
| 8 | **Progressor Network admin** | Med (future) | High | Med | When the network exists. |
| 9 | **Client portal dwell-time** (open since 2026-08) | Low-med | Medium | Low | The only uncollected metric; low priority. |

---

## F — Implementation sequence

Reordered per decision 8. The current Command Centre stays fully operational throughout; each phase adds the new framing alongside existing routes and redirects only after verification. Detailed Phase 0/1 in [`01`](01-PHASE-0-1-PROPOSAL.md).

- **Phase 0 — Security & audit prerequisites + hygiene.** Reusable server-side `requireStepUp()`; apply to sensitive financial/destructive actions **including the founder** (decision 5). Close the audit-log coverage gap. Hygiene: CLAUDE.md `commandDb` correction, stale `ai-outreach` header, broken `enquiries-chase` link, hide Friction/Automations from nav (routes kept). **No IP/DB/auth change without separate approval** (see [`02`](02-SECURITY-REMEDIATION.md)). No UX change.
- **Phase 1 — Nav architecture + shared workspace patterns + unified customer accounts + global search.** The tabbed section shell + ⌘K search + the Estate-agency account (composing the Agency File) + Progression-company account + People. Redirect duplicates only after the preservation contract passes.
- **Phase 2 — Read-only billing operations.** Money → Billing operations surfacing existing cron/`InvoiceLine` data. No Stripe writes.
- **Phase 3 — Remaining section consolidation.** Operations, Growth (analytics cluster → one page), Content (11→5), Platform, System. Mostly relocation + reframing.
- **Phase 4 — New operational actions.** Stripe **refunds first**, then credits/retry/invoice/subscription — each server-authorised, auditable, idempotent, Stripe-reconciled, step-up-gated, staging-first, one at a time.
- **Phase 5 — Investigate/diagnostics.** Per-customer diagnostics (Sentry, delivery timeline, integration health); extend search.
- **Future.** Progressor Network; final call on Friction/Automations.

---

## G — Risks and open questions

### Resolved by the 2026-11-15 decisions
IA (8 sections, refined internals) ✓ · compose-not-rebuild the account ✓ · global search prioritised ✓ · staged finance, refunds first ✓ · step-up incl. founder for sensitive ops ✓ · Friction/Automations hidden, Email Threading retained ✓ · preservation becomes a testable contract ✓ · sequencing reordered ✓.

### Risks to hold onto through implementation
- **Shared write paths** (5, listed in [`01`](01-PHASE-0-1-PROPOSAL.md)) — automation flags, agency logo, `freeOnExchange`, etc. must stay single-sourced.
- **`revalidatePath` targets** point at the *list* (`/command/agencies`), not the file — a new account route won't match them; the UI stays live via `router.refresh()`. **Preservation tests assert the refresh path, not the revalidate target.**
- **`commandDb` has no DB-level isolation** — any new "operate" action inherits full DB power; guard discipline is the only safety net ([`02`](02-SECURITY-REMEDIATION.md)).
- **Scope contract + deep-link graph** (`?mode/?agency`, `files?tx=`, `/agent/transactions`) must survive every relocation; thread scope via `buildFilterUrl`.
- **Internal-agency branching differs by surface** (`getAgencyRevenueDetail` returns null for internal; `getAgencyFileHeader` allows them) — the account must branch on `isInternal` consistently per tab.

### Open questions remaining for you
1. **`searchFiles` scope:** it omits the `LIVE_FILE_WHERE` filter every other Files view applies, so global search could surface demo/withdrawn/internal files. Intended, or should search apply the live filter?
2. **IP allowlist (CIDR):** it's enforced but exact-match only — CIDR silently fails. Leave as-is (per decision 5, no auto-change), document the limitation, or fix the matcher? (Proposal in [`02`](02-SECURITY-REMEDIATION.md); no change without your go-ahead.)
3. **Billing reconciliation source:** before refunds, do we reconcile against Stripe via API read at action-time, or via a stored webhook/ledger? (Affects Phase 2 design — flagged, not yet decided.)

---

*No code, schema, billing, auth, or behaviour changed. Findings traced to current code on `staging`; unconfirmed items flagged inline.*
