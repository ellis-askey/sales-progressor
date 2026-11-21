# TSP Admin — Phase 0 & Phase 1 implementation proposal

**Status:** proposal for approval. **No application code will be written until you approve the "first implementation slice" (§10).** Planning artefact only.

**Reads with:** [`00-AUDIT-AND-ARCHITECTURE.md`](00-AUDIT-AND-ARCHITECTURE.md) (architecture + decisions) and [`02-SECURITY-REMEDIATION.md`](02-SECURITY-REMEDIATION.md) (the security detail Phase 0 depends on).

**Core design choice (lowest-risk):** the unified customer account is built by **evolving the existing Agency File *in place* at its current route** (`/command/agency/[agencyId]`), organised into tabs via a `?tab=` param — **not** a new route. This preserves every existing `revalidatePath` target, every deep link, and every backend action unchanged. New data (Billing, People) is pulled into tabs by calling functions that already exist.

---

## Contents
1. [The two phases at a glance](#1--the-two-phases-at-a-glance)
2. [Navigation hierarchy](#2--navigation-hierarchy)
3. [Customer workspace structure](#3--customer-workspace-structure)
4. [Shared workspace patterns](#4--shared-workspace-patterns)
5. [Global search design](#5--global-search-design)
6. [Phase 0 — scope, files, verification](#6--phase-0--scope-files-verification)
7. [Phase 1 — scope, files, dependencies](#7--phase-1--scope-files-dependencies)
8. [Preservation: the testable functionality contract](#8--preservation-the-testable-functionality-contract)
9. [Security implications](#9--security-implications)
10. [Rollout & rollback](#10--rollout--rollback)
11. [The exact first slice to approve](#11--the-exact-first-slice-to-approve)

---

## 1 — The two phases at a glance

- **Phase 0 — Prerequisites (no UX change).** Close the audit-log gap, add the `requireStepUp()` guard for sensitive actions (incl. founder), unify hybrid detection, documentation fixes, hide Friction/Automations from nav (routes retained). Everything additive or doc-only; the one behaviour change (step-up on sensitive actions) is approval-gated per [`02`](02-SECURITY-REMEDIATION.md).
- **Phase 1 — Nav + workspace + accounts + search.** Restructure the sidebar into the 8-section model (pointing mostly at existing routes); introduce the tabbed account shell by evolving the Agency File in place; add the Progression-company account and People views; ship the ⌘K global search. Redirect/retire duplicate routes only after the preservation contract (§8) passes.

**Not in these phases:** billing operations, Stripe writes, section consolidation beyond Customers, Content/Analytics reorganisation. Those are Phases 2–4.

---

## 2 — Navigation hierarchy

Sidebar restructured in `components/command/CommandSidebar.tsx`. A **persistent ⌘K search** sits in the header above the scope filters. Most leaves point at **existing routes** (no new pages) — the change is grouping + secondary nav, not new surfaces.

```
⌘K  Search — agencies · progression companies · people · files        (NEW, §5)

Today
├─ Today                     /command/overview
└─ Briefing                  /command/insights

Customers                                                            (grouping)
├─ Overview                  /command/customers           (NEW light landing, optional)
├─ Estate agencies           /command/agencies            (existing list)
│    └─ «account»            /command/agency/[id]?tab=…    (existing route, now tabbed §3)
├─ Progression companies     /command/businesses          (existing list)
│    └─ «account»            /command/businesses/[id]?tab=…
├─ People                    /command/agencies?tab=agents (existing)
│    └─ «person»             /command/agencies/[userId]    (existing)
└─ Trials                    /command/trials/boardwalk     (existing, a lens)

Money
├─ Revenue                   /command/revenue  (breakdown = inline drill, existing)
├─ Referrals                 /command/providers · /command/providers/quotes
└─ Billing operations        (Phase 2 — not built yet)

Operations
├─ Files                     /command/files
├─ Messages                  /command/outbound
├─ WhatsApp                  /command/whatsapp
├─ Proposed updates          /command/proposals
└─ Deliverability            /command/email-senders · /command/agent-emails · /command/email-threading

Growth
├─ Prospects                 /command/prospects
├─ Outreach                  /command/ai-outreach
├─ Analytics                 /command/website-growth (+ secondary: activation/retention/adoption/
│                              followup-usage/growth/timeframes/chain-invites/crm-requests)
├─ Experiments               /command/experiments
└─ Chase performance         /command/enquiries-chase

Content                      /command/content  (5 tabs: Ideas·Create·Plan·Measure·Brand — Phase 3)

Platform
├─ Email catalogue           /command/emails
├─ Milestone emails & updates /command/milestone-emails · /command/milestone-updates
├─ Other client emails       /command/email-templates
├─ Chase cadence             /command/solicitor-chase
├─ Rules                     /command/rules
└─ Automations               (hidden — route retained)

System
├─ Monitoring                /command/health · /command/activity · /command/audit
├─ Settings                  /command/settings · /command/settings/connections
├─ Founder tools             /command/updates · /command/critique
└─ Reset demo                /command/admin/demo
    (Friction hidden — route retained)
```

In Phase 1 the **Growth → Analytics secondary nav** and **Content tabs** are *nav grouping only* (the pages stay where they are); the actual page consolidation is Phase 3. This lets the new IA land without moving any analytics/content code.

---

## 3 — Customer workspace structure

The Agency File (`app/command/(protected)/agency/[agencyId]/page.tsx`) gains a `?tab=` param and renders one of **6 tabs**. Every data call and component already exists; the Billing and People tabs pull in functions used elsewhere today.

```
/command/agency/[agencyId]?tab=overview        (default)
│
├─ Overview       getAgencyFileHeader + getAgencySales (snapshot) + alerts strip
│                 + recent activity.  [all existing reads]
│
├─ People         team table (from header.team) → getAgentDetail(userId) inline/linked
│                 components: AgentPhotoManager, EmailBrandingStudio
│                 [existing agencies/[userId] surface, in-context]
│
├─ Sales & files  getAgencySales → SalesTable + MarkFreeToggle
│                 links to /command/files?tx=
│
├─ Billing        getAgencyRevenueDetail(agencyId)  ← was revenue/[agencyId]
│                 + AgencyFeeEditor + MarkFreeToggle
│                 ONE fetch of the shared Agency billing row (no double-source)
│
├─ Comms &        getAgencyEmailLog + getAgencyReachability
│  deliverability  + read-only sender/branding group
│
└─ Settings       AgencyAutomationControls (6 flags) + getAgencySetupReadiness
                  + onboarding actions (Phase 2+) + portal/branding config
                  + Data & GDPR danger panel (AgencyDataControls) — step-up gated
```

**Composition rules (preserve behaviour):**
- **Reuse components verbatim** — `AgencyAutomationControls`, `AgencyFeeEditor`, `MarkFreeToggle`, `AgencyDataControls`, `ViewAsButton`, `AgentPhotoManager`, `EmailBrandingStudio`. No prop/behaviour changes.
- **Single-source the shared `Agency` billing row** — `getAgencyFileHeader` and `getAgencyRevenueDetail` both read overlapping `Agency` columns (`feeTier`, `legacyOutsourcedFeePence`, `vatRegisteredAt`, `paymentFailedAt`, `stripeCustomerId`, …). The Billing tab fetches once and feeds both the facts panel and the fee editor.
- **Respect the `isInternal` branch** — `getAgencyRevenueDetail` returns `null` for internal agencies; `getAgencyFileHeader` allows them; `AgencyDataControls`/offboard block internal. The Billing/Data tabs must branch the same way per tab.
- **Lazy-load per tab** — only the active tab's data is fetched (the `trials/[slug]` pattern), so the account is not slower than today's single page.

**Progression-company account** (`businesses/[id]`): already 5 tabs' worth of sections — reorganise into `?tab=` Overview · Team · Clients · Billing · Setup. Pure reframing; all reads exist (`getBusinessDetail`, `getBusinessWatch`, `getBusinessFriction`, `getBusinessSendingIdentity`).

---

## 4 — Shared workspace patterns

One reusable tabbed-section pattern, built on **primitives that already exist** — no new primitive library.

- **Tabs:** `ParamTabs` (`components/command/ui/primitives.tsx:113`) — URL-param tabs with `hrefFor(key)`, already used by `trials/[slug]`. This is the shell for both the account tabs and the Growth→Analytics secondary nav.
- **Tables / shells:** `TableShell`, `Tr`, `Td`, `Section`, `KpiCard`, `CardEmpty` (same file).
- **Filters:** `components/command/shared/FilterSelect.tsx` (href-carrying options, server-driven).
- **Tooltips / status:** `InfoTip`, `ReadinessPill`, `ManagedByTag`, `BusinessStatusPill`.
- **Scope preservation:** all intra-CC links built with `buildFilterUrl` (`lib/command/scope.ts:71`) so the `?mode`/`?agency` scope threads through tabs and search results. `ScopeFilters` stays `<Suspense>`-wrapped (uses `useSearchParams`).
- **Active-state contract:** keep the sidebar's `pathname === href || pathname.startsWith(href + "/")` logic; `?tab=` changes don't change the active top-level item.

**New shared pieces (small, additive):** one `SearchInput` primitive (every surface hand-rolls `<form>`+SVG today) and one CC-skinned command palette (§5). Nothing else new.

---

## 5 — Global search design

A superadmin ⌘K palette spanning agencies, progression companies, people, files — **mechanics cloned from the agent app, re-skinned for the Command Centre**.

- **Backend (new):** `app/api/command/search/route.ts` — `GET ?q=`, `requireSuperAdmin`, `commandDb`, parallel `findMany` across the four entities, each capped (e.g. 6). Returns `{ agencies, businesses, people, files }`. Models the existing `app/api/agent/search/route.ts` (3-entity parallel search) but superadmin-scoped and covering agencies/businesses. Uses `contains` (ILIKE) — adequate for typeahead; no new indexes needed in Phase 1 (ranked FTS deferred).
- **Frontend (new):** `components/command/CommandGlobalSearch.tsx` — clone the **mechanics** of `components/layout/AgentGlobalSearch.tsx` (⌘K/Esc, 220 ms debounce, arrow-nav, portal, prefetch) with the **dark CC skin** (`#0a0a0a`/`#111`, blue `#2563eb`, no glass). Mounted once in `app/command/(protected)/layout.tsx`.
- **Result → route:**

| Entity | Display | Links to | Cheap source |
|---|---|---|---|
| Agency | name · mode · managedBy | `/command/agency/[id]` | `commandDb.agency.findMany({where:{isInternal:false}, select:{id,name,modeProfile}})` |
| Business | name · status | `/command/businesses/[id]` | `getBusinessNameMap` / `getBusinessesOverview` |
| Person | name · role · agency | `/command/agencies/[userId]` | `getUsageOverview().agents` |
| File | address · status · agency | `/command/files?tx=` | `searchFiles(q)` |

- **Scope threading:** every result link built with `buildFilterUrl` so it keeps the active `?mode/?agency`.

**Two decisions this surfaces (in [`00`](00-AUDIT-AND-ARCHITECTURE.md) §G):** (1) `searchFiles` omits the `LIVE_FILE_WHERE` filter, so it can return demo/withdrawn/internal files — apply the live filter for search, or intentional? (2) there is no CC contact/person detail route — buyer/seller/solicitor matches can only deep-link to a file (so Phase-1 search covers agencies/businesses/agents/files, not portal contacts).

---

## 6 — Phase 0 — scope, files, verification

All items detailed in [`02-SECURITY-REMEDIATION.md`](02-SECURITY-REMEDIATION.md) §5. Summary of affected files:

| Item | Affected files | Type | Verify |
|---|---|---|---|
| Audit coverage | `app/actions/{ai-switch,agency-fees,agency-retention,sale-billing}.ts`, `app/actions/demo-reset.ts`, milestone/email save routes, `platform-updates.ts`, logo/photo routes — add `recordAdminAction` | Additive | A row appears per action |
| `requireStepUp()` | new export in `lib/command/session.ts`; wire into `offboard` + 3 GDPR routes (replace local `stepUpValid`) + future sensitive actions; `setup-2fa` accepts hybrid | ⛔ approval-gated | Staging: sensitive action refused without fresh step-up, passes with it; browsing unaffected |
| Unify hybrid detection | new `isHybridSuperadmin(session)`; use in layout/middleware/guard | Refactor, no behaviour change | Existing access unchanged |
| Doc fixes | `CLAUDE.md` (`commandDb` truth), IP-allowlist docs, remove dead `config.ts` parse | Doc/dead-code | — |
| Hide stubs | `CommandSidebar.tsx` — Friction/Automations not in nav (routes kept) | Nav-only | Routes still reachable by URL |
| Hygiene | `ai-outreach/page.tsx` stale header; `enquiries-chase` broken `/transactions/[id]` link | Fixes | Link resolves; header accurate |

**Phase 0 ships no visual/UX change** (except the sidebar losing two dead links and gaining nothing). It is safe to ship incrementally and independently of Phase 1.

---

## 7 — Phase 1 — scope, files, dependencies

### New files
- `app/api/command/search/route.ts` — cross-entity search endpoint.
- `components/command/CommandGlobalSearch.tsx` — CC-skinned ⌘K palette.
- `components/command/ui/SearchInput.tsx` — extracted search input primitive (optional but tidy).
- *(optional)* `app/command/(protected)/customers/page.tsx` — light Customers landing (or reuse `/command/agencies` as the entry).

### Modified files
- `components/command/CommandSidebar.tsx` — `NAV_SECTIONS` → the 8-section model (§2); mount search in header. **Preserve** `ScopeFilters`, `ThoughtQuickCapture`, mobile drawer, active-state logic.
- `app/command/(protected)/layout.tsx` — mount `CommandGlobalSearch`.
- `app/command/(protected)/agency/[agencyId]/page.tsx` — add `?tab=` + `ParamTabs`; move existing sections under tabs; add Billing tab (`getAgencyRevenueDetail`) and People tab (`getAgentDetail`). **Reuse all components unchanged.**
- `app/command/(protected)/businesses/[id]/page.tsx` — reorganise existing sections into `?tab=`.

### Dependencies (reused, unchanged)
`lib/command/agency-file.ts` (header/sales/email/reachability), `lib/command/revenue.ts` (`getAgencyRevenueDetail`), `lib/command/usage.ts` (`getAgentDetail`, `getUsageOverview`), `lib/command/businesses.ts`, `lib/command/agency-readiness.ts`, `lib/command/files.ts` (`searchFiles`), `lib/command/scope.ts` (`buildFilterUrl`), `components/command/ui/primitives.tsx`, `components/command/shared/*`, and every Agency-File component/action listed in §8.

### Explicitly NOT changed in Phase 1
No server action, no API route behaviour, no Prisma model, no `revalidatePath` target, no auth logic (beyond Phase 0's approved step-up). The account route stays `/command/agency/[agencyId]`.

---

## 8 — Preservation: the testable functionality contract

Per decision 7, the preservation map becomes a **testable contract** across eight dimensions. Format below; applied in full to the **Phase-1 scope** (the Agency File, its components/actions, `agencies/[userId]`, `revenue/[agencyId]`, the `agencies` Controls matrix). Each later consolidation phase adds its own contract block (contract-as-you-consolidate — avoids a 65-page big-bang).

**Contract format — eight dimensions per page/action:**

| Dim | What it covers | How verified |
|---|---|---|
| 1. Forms & mutations | every write still fires the same action with the same payload | manual trigger on staging + assert DB delta + a Playwright `surface-*` happy path |
| 2. Filters & search | every filter/search returns the same rows | before/after row-count parity on a fixed query |
| 3. Modals/drawers/contextual | every menu/drawer/row-action still opens & acts | manual + screenshot diff |
| 4. URL params & deep links | `?mode/?agency/?tab/?tx/?metric` + inbound links resolve | link-check script + manual |
| 5. Permissions & auth | superadmin/hybrid/step-up gating unchanged | attempt as each role; assert allow/deny |
| 6. Background jobs & integrations | crons/SendGrid/Stripe-read/WhatsApp untouched | no code change asserted + smoke |
| 7. Audit logging | actions that logged before still log (and Phase 0 adds more) | assert `AdminAuditLog` row |
| 8. Error & empty states | notFound/empty/error render as before | force each state on staging |

### Applied contract — Phase 1 scope

| Surface / action | Dimension(s) to assert | Specific test |
|---|---|---|
| **Agency File → tabs** | 4, 8 | `?tab=overview\|people\|sales\|billing\|comms\|settings` each render; unknown tab → overview; `notFound()` still fires for bad agencyId |
| `AgencyAutomationControls` (6 flags) | 1, 5, 7 | toggle each → `Agency.<flag>` flips via `updateAgency{Chase,WeeklyUpdate,WhatsApp}StreamAction`; `hasAdminPowers` still required; UI updates via **`router.refresh()`** (NOT revalidate — the actions revalidate `/command/agencies`, not the account); Phase-0 audit row present |
| lifecycle toggle | 1, 7 | `updateAgencyRetentionPausedAction` flips `retentionEmailsPaused`; audit row |
| `AgencyFeeEditor` | 1, 5, 7 | set free/legacy/standard → `saveAgencyFeeAction`; **retroactive `freeOnExchange` updateMany** still runs; legacy>0 validation; audit row |
| `MarkFreeToggle` | 1, 5 | per-sale free → `setSaleFreeOnExchangeAction`; **refuses if `billedAtExchange` set** |
| `AgencyDataControls` (close/purge/erase) | 1, 3, 5, 7 | each needs reason; purge needs typed name + confirm; **superadmin + step-up** enforced (Phase 0 adds founder step-up); internal-agency → disabled notice; `agency.close`/`agency.purge`/`gdpr.contact.anonymise` audit rows |
| `ViewAsButton` | 1, 5 | superadmin only; target must be director/negotiator/viewer; sets `VIEW_AS_COOKIE`; `recordGodAction(view_as_start)`; redirects `/agent/hub`; exit via `/api/view-as/stop` |
| **Billing tab** (`getAgencyRevenueDetail`) | 2, 8 | pipeline/banked/fee figures match today's `revenue/[agencyId]`; **internal agency → null branch** handled; shared `Agency` row fetched once |
| **People tab** (`getAgentDetail`) | 1, 2, 4 | agent metrics match `agencies/[userId]`; `AgentPhotoManager` → photo/focus API routes; `EmailBrandingStudio` → agency logo route (agency-wide write preserved) |
| `agencies` Controls matrix | 1, 7 | the `setAll*` master actions still write the **same `Agency` flag columns** as the per-agency actions — **single write path preserved** (shared-path risk #1) |
| Deep links | 4 | `/command/revenue/[agencyId]` and inbound links still land (redirect to `?tab=billing` if route folded); `files?tx=`, `/agent/transactions/[id]` intact |

### The 5 shared write paths (must stay single-sourced)
1. **Automation flags** — written from `agencies` Controls matrix *and* Agency File via the same `agency-{chase,weekly-update,whatsapp}` actions.
2. **Agency logo** — written from `agencies/[userId]` `EmailBrandingStudio` *and* the director's `/agent/settings`; shown read-only on the Agency File.
3. **`freeOnExchange`** — `saveAgencyFeeAction` (bulk) *and* `setSaleFreeOnExchangeAction` (per-file); keep the "already billed ⇒ refuse" guard.
4. **Revalidation** — automation actions revalidate the *list*, not the file; account UI relies on `router.refresh()`.
5. **Internal-agency branch** — differs across `getAgencyRevenueDetail` (null) / `getAgencyFileHeader` (allowed) / offboard (blocked).

---

## 9 — Security implications

- **Phase 0 introduces the step-up guard** that Phase 1's account danger-zone (close/purge/erase) and all future financial actions depend on. The account's Data & GDPR panel inherits it; nothing in Phase 1 relaxes a gate.
- **No new DB power** — the account reads/writes go through the same `commandDb`/`prisma` + `hasSuperAdminPowers`/`hasAdminPowers` paths as today. The documented `commandDb` reality (full-access, app-layer-guarded) is unchanged and now correctly described.
- **Global search runs on `commandDb`** behind `requireSuperAdmin` — same trust boundary as every other CC read. It exposes no data a superadmin can't already reach.
- **Audit:** Phase 0's coverage work means the account's mutations (fee, free, retention, GDPR, view-as) are all logged before Phase 1 surfaces them together.
- **IP allowlist / RLS unchanged** — explicitly out of scope, per [`02`](02-SECURITY-REMEDIATION.md); no change without separate approval.

---

## 10 — Rollout & rollback

**Rollout (incremental, CC stays live throughout):**
1. **Phase 0 first**, shippable in small independent commits (audit rows, then guard, then docs). Each verifiable alone.
2. **Phase 1 behind a nav flag** — the new `NAV_SECTIONS` structure can land while every old route still works (leaves point at existing routes). The account `?tab=` evolution is backward-compatible (default tab = today's full page content reorganised).
3. **Global search** ships additively (new endpoint + mounted palette); if hidden, nothing else breaks.
4. **Redirect/retire duplicates only after the §8 contract passes** — e.g. `/command/revenue/[agencyId]` → `/command/agency/[id]?tab=billing` once Billing-tab parity is verified. Until then both coexist.

**Rollback:**
- Phase 0 audit/docs: revert commit (additive).
- Phase 0 step-up: remove the `requireStepUp()` call on an action to restore prior behaviour without touching auth core; founder TOTP enrolment reversible (clear `totpActivatedAt`).
- Phase 1 nav: revert `NAV_SECTIONS` to restore the old sidebar; routes unaffected.
- Phase 1 account tabs: the route is unchanged, so reverting the page file restores the single-page Agency File; no data migration, no redirect to unwind (redirects are added last and are the easy thing to remove).
- Everything staging-first (Law 3); no schema change in either phase.

---

## 11 — The exact first slice to approve

To keep the very first coding slice small, safe, and verifiable, I propose **Slice 1 = Phase 0, audit + safe items only** (everything that does *not* change your auth flow):

**Slice 1 (safe, additive, no approval-gated auth change):**
- Add `recordAdminAction` to the unlogged mutations (priority: demo reset, AI switch, fee/free/retention, then content/email edits, then uploads).
- Unify hybrid detection into `isHybridSuperadmin(session)` (no behaviour change).
- Documentation fixes (`commandDb` truth, IP-allowlist 403/exact-match, remove dead parse).
- Hide Friction/Automations from nav (routes retained); fix the stale `ai-outreach` header and the broken `enquiries-chase` link.

**Slice 2 (needs your explicit go-ahead — changes your flow):** the `requireStepUp()` guard + founder TOTP enrolment ([`02`](02-SECURITY-REMEDIATION.md) §1).

**Slice 3 (Phase 1 kickoff):** the tabbed account shell at `/command/agency/[agencyId]` (Overview + Settings tabs first, reusing existing components), behind a nav flag.

**What I need from you to start:**
1. Approve **Slice 1** as the first code (safe, reversible, no auth change).
2. Approve or adjust the **sensitive-action set** and the **founder step-up** approach (gates Slice 2) — see [`02`](02-SECURITY-REMEDIATION.md) §6.
3. Answer the two Phase-1 search questions: `searchFiles` live-filter, and confirm Phase-1 search covers agencies/businesses/agents/files (not portal contacts).

I will not write application code until you approve Slice 1.
