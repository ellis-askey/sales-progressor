# PRODUCT_TRUTH.md — The Sales Progressor

**This is the single authoritative source for current product facts.** Pricing, roles, permissions, business types, surfaces, tech stack, feature-flag state and launch stage live here and nowhere else. Other documents (including CLAUDE.md) point here rather than restating these facts.

**Last revalidated:** 2026-11-01, against current code on branch `staging`, git history, and live Vercel configuration.
**Origin:** promoted from `docs/audits/PRODUCT_INVENTORY_2026-10-03.md` and independently re-verified (that inventory is retained as the dated 2026-10-03 snapshot; it is now ~4 weeks behind this document — e.g. it predates the `platform` access scope added 2026-10-19).

---

## How to read this document

**Every fact carries an anchor** — a `file:line` or a commit hash — so a reader can confirm it against the code, and so staleness is detectable when the anchor moves. If a fact here has no anchor, treat it as unverified.

**Three epistemic tiers are labelled inline:**

- **[verified]** — confirmed true against current code/config on the revalidation date.
- **[historical]** — a past decision or state, kept for context; see `docs/DECISIONS.md` for rationale.
- **[unverified]** — cannot be established from the repository (e.g. a live Vercel value, or a production-data fact). Recorded as a question, never guessed.

**Source-conflict rule (per founder decision 2026-10-31):** current **code** establishes *implemented* behaviour — which is **not necessarily the approved or intended** behaviour. **Specs** establish *intended* behaviour. **Decision records** establish *agreed direction*. Where these disagree, the conflict is flagged as **unresolved** here rather than silently declaring one correct.

---

## 1. Business model and the three business types

The most-confused area historically. There are **three distinct kinds of business** on the platform. **[verified]** — `lib/security/access-scope.ts:19-88`, `prisma/schema.prisma` (`ProgressionBusiness`, `User.agencyId`, `User.progressionBusinessId`).

| Business type | Who they are | `agencyId` | `progressionBusinessId` | How they see files |
|---|---|---|---|---|
| **Estate agency** (the customer) | director / negotiator staff of an estate agency | set | null | their one agency's files (`agency` scope) |
| **TSP internal** (the platform operator) | TSP's own progressors + founder/admin | **null** | **null** (resolves to TSP implicitly) | assigned files (progressor) or all TSP files (admin) |
| **External sales-progression business** | an independent progression firm running its own bounded book on the platform | null | **set** (a non-TSP `ProgressionBusiness`) | its own tagged book (`business` scope) |

**Key fact:** TSP is modelled as "progression business #1" — the one row with `isTsp = true`. The generalisation lets other progression firms run bounded versions while TSP remains the platform operator. **[verified]** `access-scope.ts:26-39, 64-80`; spec `docs/active/progression-businesses/00-spec.md:7`.

**The access boundary is the transaction**, never the business↔agency client relationship. A `ProgressionBusinessClient` link is client management only and never grants file access. **[verified]** `access-scope.ts:64-71`; `00-spec.md:15-20`.

**Status of the external-progression-business surface:** the new entry points (self-serve signup, client management, create-sale-for-client) are gated by `PROGRESSION_BUSINESSES_ENABLED`; the security boundary itself is always-on and inert until an external `progressionBusinessId` exists. **[verified]** `lib/progression/flags.ts:1-12`. **LIVE IN PRODUCTION** — confirmed 2026-11-01 by the founder's live Stripe dashboard (`acct_1UNqo0FJibD43diI`), which shows real GBP subscription charges to external businesses (Sales Proggos, josaunders2202, Moves By Wright). The flags are on; see §6.

---

## 2. Pricing

**[verified]** — single source of truth is `lib/billing/fee.ts`.

- **Self-managed / self-progression: FREE (£0).** The old £59 self fee was **retired** under the 2026-08 model; historical invoices keep their frozen amounts. `fee.ts:21-24, 72-76`. **[historical]** the £59 fee — shipped free in commit `a4dd22b4` (2026-08-31).
- **Outsourced: a sliding scale by sale price** — £250 (≤ £349,999) / £300 (£350,000–£499,999) / £350 (≥ £500,000). `fee.ts:25-29, 100-106`.
- **First outsourced file per agency is free** (new agencies; prior exchanged outsourced files grandfather out). **[historical]** commit `4a5d35fc`.
- **Per-agency legacy override:** when `Agency.feeTier = "legacy"` with a set pence amount, a flat fee replaces the sliding scale for outsourced files. `fee.ts:50-53, 81-88`.
- **Billing point:** the agency fee is stamped at **exchange** (milestones VM19 / PM26). `lib/services/billing-trigger.ts`.
- **Billing collection is manual.** Automated invoice issuance is **off** — `BILLING_AUTO_ISSUE_ENABLED` is **absent from production** (verified via `vercel env ls production`, 2026-11-01), so the code default (no-op) governs. **[verified]** `lib/billing` + flag absence.
- **No 14-day trial** — removed with the free model. **[historical]** commit `de2938c6`.

Do **not** describe self-managed as a £59 paid tier.

---

## 3. Roles and permissions

**Six platform roles.** **[verified]** `prisma/schema.prisma:641-648` — `enum UserRole { superadmin, admin, sales_progressor, director, negotiator, viewer }`.

| Role | Who | `agencyId` | Notes |
|---|---|---|---|
| `director` | estate-agency owner/senior | set | full agency-scoped access; billing is director-only |
| `negotiator` | estate-agency day-to-day staff | set | agency-scoped, further gated by `canViewAllFiles` |
| `sales_progressor` | **TSP internal progressor OR external progression-business member** | null | own assigned files; external members also carry `progressionBusinessId` |
| `admin` | TSP internal | null | every TSP-progressed file; walled off from external businesses' books |
| `superadmin` | founder | null | everything admin can do + the Command Centre |
| `viewer` | parked/read-only state | varies | net-new OAuth users pre-signup, pending join-requesters, soft-removed members; **blocked from all mutating API calls. This role IS live** — correcting the older "not in production use" claim |

**Separate per-business role dimension:** `enum ProgressionBusinessRole { owner, progressor }` on `User.progressionBusinessRole`. **[verified]** `schema.prisma:429-432`. An external owner sees the whole business book; a member sees own-assigned unless granted see-all.

**Hybrid admin (founder):** an email allowlist grants the founder admin/superadmin powers while keeping `role = sales_progressor`, so the daily progressor UX stays intact. **[verified]** `access-scope.ts:55-62`; commit `b2295c03`.

### Access scopes — five shapes (not three)

`getAccessScope(session)` returns one of **five** shapes. **[verified]** `lib/security/access-scope.ts:19-24, 43-88`:

- `{ kind: "agency", agencyIds }` — director / negotiator / viewer → their one agency.
- `{ kind: "business", businessId }` — external progression-business member (owner or see-all) → their business book.
- `{ kind: "assigned", userId }` — TSP progressor, or an external member without see-all → own assigned files.
- `{ kind: "all" }` — admin → every TSP file (`TSP_ONLY_TX_WHERE`), never an external business's.
- `{ kind: "platform" }` — superadmin/founder → every file including external books. In **lists** it behaves like `all` (TSP files only); its extra reach is single-file (opening a specific file from the Command Centre). `access-scope.ts:108-114`.

`admin` and `superadmin` are **no longer the same scope** (`all` vs `platform`). Query helpers: `scopeTransactionWhere`, `scopeOwnershipWhere`, `scopeChaseTaskWhere`, `scopeReminderLogWhere`, plus the boolean `canReadTransaction`. Multi-tenant safety is Law 7 in CLAUDE.md; this is the current shape of the model it refers to.

---

## 4. Surfaces and routes

**[verified]** — spot-checked against `app/`.

- **Agent app `/agent/*`** — the one logged-in app. Estate-agency staff, **TSP internal staff, and external progression-business members all run here**, differentiated by a per-session visibility mode. Shell: `AgentShell`. Visual identity: the iridescent WebGL `AppBackground` + frosted glass (not the warm-cream tokens — see §8).
- **`/dashboard` and `/admin` redirect** into the agent app / Command Centre. **[verified]** `app/dashboard/page.tsx` redirects to `/agent/hub`.
- **File detail is `/agent/transactions/[id]`** (under `AgentShell`). There is **no `/transactions/[id]` route** — the older CLAUDE.md claim that `AppShell` renders it is wrong. `AppShell` is now effectively legacy (remaining use: `app/admin/migrate`).
- **Command Centre `/command/*`** — superadmin only; TSP's internal ops/growth console; external businesses never see it.
- **Buyer/seller portal `/portal/[token]`** — token-authenticated, no login, mobile-first.
- **Boardwalk suite `/boardwalk/*` + `/f/[publicId]`** — a separate white-label product with its own auth (`forms_session`), not the roles above.

---

## 5. Milestone engine (summary + one unresolved conflict)

A state machine over a static catalog of vendor (VM-series) and purchaser (PM-series) milestone definitions, each with side, order, weight and `blocksExchange`. Completions are rows in states `locked` / `available` / `complete` / `not_required`; transaction-type variants auto-mark steps not-required (freehold → management-pack steps; cash → mortgage steps; cash-from-proceeds → deposit). Bidirectional VM↔PM reflection keeps buyer/seller trackers in sync. **[verified]** code home: `lib/services/milestones.ts`, `lib/milestone-auto-nr.ts`.

**UNRESOLVED CONFLICT (awaiting founder ruling):** the **code** has a `VM21` milestone and `PM7` prerequisites that **do not match** `docs/MILESTONES_SPEC_v1.md`. Per the source-conflict rule, this is recorded as unresolved — it is **not** being treated as "code is automatically right." Open question: is the code the agreed behaviour (update the spec) or is the spec the target (the code diverges)? **No milestone spec or behaviour is being changed at this stage.**

---

## 6. Feature flags (source of truth: Vercel, not the repo)

Live flag values are set in the Vercel production environment, **not** in the repo. The repo only defines the code default (`=== "true"`, i.e. off unless set). The authoritative check is `vercel env ls production`.

**Verified via `vercel env ls production` on 2026-11-01** (names + presence visible; **values are encrypted and were not read** — no secrets pulled, per founder instruction):

| Flag | In production? | Recorded state |
|---|---|---|
| `PROGRESSION_BUSINESSES_ENABLED` | **Present** (added ~28d ago) | **[verified] on** — external businesses are onboarded and being billed in production (founder's live Stripe dashboard, 2026-11-01), which requires this surface to be enabled. |
| `PROGRESSION_BILLING_COLLECT` | **Present** (added ~25d ago) | **[verified] on** — confirmed live 2026-11-01: the production Stripe account (`acct_1UNqo0FJibD43diI`, **live mode**) shows real GBP subscription charges to external businesses on the £59 base / £39 seat / £5-per-sale model (e.g. Nov 1 2026: £5 and £249 succeeded, £149 failed for Moves By Wright). Not dark. |
| `MOVE_INVITES_ENABLED` | **Present** (Preview+Production) | **[unverified]** configured in production, value not readable. |
| `SIGNUP_JOIN_REQUESTS_ENABLED` | **Present** | **[unverified]** configured in production, value not readable. |
| `RATE_LIMIT_ENABLED` | **Present** | **[unverified]** value not read; code treats unset/false as a PASS no-op. |
| `BILLING_AUTO_ISSUE_ENABLED` | **Absent** | **[verified] off** — not set in production, so automated invoicing is dark (manual billing). |

**To confirm a value:** a safe production route-probe (e.g. whether a flag-gated page renders vs 404s) can establish on/off without pulling secrets — **not done**, pending founder go-ahead.

---

## 7. Tech stack

**[verified]** — `package.json`.

- **Framework:** Next.js 16 (App Router), TypeScript strict. `package.json` `"next": "^16.2.4"`.
- **Database:** Supabase Postgres via Prisma (`@prisma/client ^5.22.0`); ~130 models.
- **Auth:** NextAuth (JWT); email+password, Google + Azure OAuth; TOTP 2FA.
- **Email:** SendGrid.
- **Billing:** Stripe (`stripe ^22.1.1`).
- **AI:** Anthropic (`@anthropic-ai/sdk ^0.91.0`) **and** OpenAI (`openai ^7.15.0`). Current model map: **Haiku 4.5** (`claude-haiku-4-5-20251001`) for chase/agent/daily-brief — `lib/anthropic.ts:13`, `lib/agent/provider.ts:48`; **Opus 4.8** (`claude-opus-4-8`) for weekly insight review + outreach strategist — `lib/services/insight/weekly-review.ts:13`, `lib/outreach/ai/claude.ts:14`; **Sonnet 5** (`claude-sonnet-5`) for prospect research — `lib/prospects/research.ts:14`. (Corrects the older "Opus 4.7" claim.)
- **Hosting:** Vercel (project `salesprogressor`). Supabase project IDs are in CLAUDE.md; **[unverified]** against live config from the repo.

---

## 8. Design identity (fact pointer)

The agent app's visual identity is the **iridescent `AppBackground` (WebGL) + frosted-glass cards**, *not* the warm-cream palette tokens (the cream is just the theme's neutrals). **[verified]** `components/decor/AppBackground.tsx`, mounted `app/agent/layout.tsx`. The internal `AppShell` dark-photo backdrop is legacy. Full design-token / component-catalog reconciliation is **Phase 2** (not done here); `design/tokens.ts` is known to carry retired hover values and `COMPONENT_LIBRARY_CATALOG.md` undercounts primitives — tracked, not yet fixed.

---

## 9. Launch stage

**Pre-launch for estate agents** (onboarding ~100 on the free self-managed tier) — **[verified]** `docs/audits/PRE_LAUNCH_FINAL_SIGNOFF.md:1-3`. **The external sales-progression-business billing path, by contrast, is already live and taking real money** (§1/§6, confirmed via the production Stripe dashboard 2026-11-01). Agency-side auto-invoicing remains manual/dark (§2). Real paying-customer counts for each path live in Stripe, not the repo. Test accounts: `docs/test-accounts.md`.

---

## 10. Provisional — NOT settled product truth

Recent but not settled; do not treat as stable (recent ≠ correct):

- ~~**External-progression-business surface** — configured in prod but value-unverified; treat as not-confirmed-live.~~ **Resolved 2026-11-01: this is LIVE in production** (real Stripe charges, §1/§6). No longer provisional.
- **Withdrawn-file reactivation** — commit `c533abd4` (2026-10-31), staging migration only, prod migration outstanding; preview behind `/dev/chain-reconnect`.
- **Onward "same person?" matcher (Phase 2)** — behind `/dev` + a `/test` harness as of 2026-10-31.
- **Agency RLS** (`lib/prisma-rls.ts`) — wrapper present but strict policies not active (staging bypass live); currently a no-op.

---

## 11. Verification log (2026-11-01)

Facts in this document were checked directly against: `lib/billing/fee.ts`, `lib/security/access-scope.ts`, `lib/progression/flags.ts`, `prisma/schema.prisma` (role/enum block), `package.json`, the model constants under `lib/`, `app/dashboard/page.tsx`, and `vercel env ls production` (names/presence only). The Oct-3 inventory was used as the starting draft and corrected where code had moved since (notably the `platform` scope, added 2026-10-19).

**Maintenance:** when product behaviour, pricing, permissions, business types, surfaces, flags or stack change, update this file in the same change and record the *why* in `docs/DECISIONS.md`. (The automatic hook + `/record-decision` command that would enforce this are proposed as Phase 2 and not yet in place.)
