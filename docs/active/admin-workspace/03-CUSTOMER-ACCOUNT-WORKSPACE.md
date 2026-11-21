# TSP Admin — Unified Customer Account Workspace (implementation plan)

**Status:** plan for review. **Not implemented.** No code to be written until this structure is approved.

**Date:** 2026-11-20. Grounded against current HEAD (verified: all routes/functions/components below exist today).
**Reads with:** [`00-AUDIT-AND-ARCHITECTURE.md`](00-AUDIT-AND-ARCHITECTURE.md) §B, [`01-PHASE-0-1-PROPOSAL.md`](01-PHASE-0-1-PROPOSAL.md) §3 (the earlier proposal this refines), [`02-SECURITY-REMEDIATION.md`](02-SECURITY-REMEDIATION.md) (step-up dependency).

---

## 1. Objective & the core design choice

Make `/command/agency/[agencyId]` the single place to **understand, manage and support** one customer, by organising the Agency File's existing sections into tabs and pulling the two sibling surfaces (`revenue/[agencyId]`, the agent detail page) into it — **reusing every existing data function, component, server action and route unchanged**.

**Route strategy — evolve in place (lowest risk).** The account stays at its current route `/command/agency/[agencyId]`, gaining a `?tab=` parameter (the exact pattern `trials/[slug]` already uses via `ParamTabs`). This preserves:
- every existing `revalidatePath("/command/agency/[id]")` / `"/command/agencies"` target (so the live-update behaviour is unchanged),
- every inbound deep link and bookmark (no route moves),
- the `router.refresh()`-driven UI updates the automation controls rely on.

No new account route is minted. `revenue/[agencyId]` and `agencies/[userId]` are **folded in as tabs** and then redirected to the tabbed account **only after** their parity is verified (see §5).

---

## 2. Two customer types, one pattern — NOT one implementation

The workspace must eventually hold **independent sales-progression companies** too. They are a **different model with different rules** — this plan explicitly does **not** assume parity:

| | Estate agency | Progression company |
|---|---|---|
| Model | `Agency` | `ProgressionBusiness` |
| Route | `/command/agency/[agencyId]` | `/command/businesses/[id]` |
| Billing | per-exchange fee (£50 / sliding / legacy / free), stamped at exchange | **subscription** (£59 director / £39 seat / £5 per sale), Stripe schedule |
| Team | agency `User`s (director/negotiator) | `User.progressionBusinessRole` (owner/progressor) |
| "Clients" | n/a | `ProgressionBusinessClient` links (management only, never file access) |
| Data loaders | `agency-file.ts`, `revenue.ts`, `usage.ts` | `businesses.ts` (`getBusinessDetail/Watch/Friction/SendingIdentity`) |

**Approach:** build a shared **account workspace *pattern*** (the tabbed chrome, header, `ParamTabs` nav, and the table/empty/action primitives) that both account types render through — but each keeps its **own tab set and its own data layer**. The agency account is this slice; the progression-company account is a later slice that reuses the *shell* with business tabs and `businesses.ts` loaders. No forcing of `Agency` and `ProgressionBusiness` into a shared schema or shared business logic.

---

## 3. Agency account — proposed tab structure

`/command/agency/[agencyId]?tab=overview` (default). Six tabs. Every data call and component already exists; only the active tab's data is fetched (lazy, the `trials/[slug]` pattern), so the account is no slower than today's single page.

### Tab 1 — Overview  *(default)*
- **Contains:** header (name, mode, file counts, opened/first-sale dates), the payment/blocked **alerts strip**, a live-sales snapshot, recent activity, "managed by" business links.
- **Reads:** `getAgencyFileHeader(agencyId)`, `getAgencySales(agencyId, now)`, `getManagingBusinesses(agencyId)` — all existing in `agency-file.ts` / `businesses.ts`.
- **Reuses:** the in-file `SalesTable`/alert rendering (kept) + `ReadinessPill`.
- **Actions:** none (read snapshot); "Revenue →" / team / managing-business links.

### Tab 2 — People
- **Contains:** the agency's team table; selecting a person shows their usage detail + founder-managed photo and agency email branding — i.e. the current `agencies/[userId]` surface, in context.
- **Reads:** `header.team` (from `getAgencyFileHeader`) for the list; `getAgentDetail(userId)` (`usage.ts`) for the drill-down.
- **Reuses verbatim:** `AgentPhotoManager` → `POST /api/command/agents/[userId]/{photo,focus}`; `EmailBrandingStudio` → `POST/PATCH/DELETE /api/command/agencies/[agencyId]/logo`.
- **Consolidates:** `agencies/[userId]` (kept reachable standalone; later redirected into the tab).
- **Gating:** superadmin (unchanged). Note the branding write is **agency-wide** and shared with the director's own `/agent/settings` — preserve as one source.

### Tab 3 — Sales & files
- **Contains:** live sales table with stage, chase health, idle, predicted exchange, billing toggle.
- **Reads:** `getAgencySales(agencyId, now)`.
- **Reuses verbatim:** `MarkFreeToggle` → `setSaleFreeOnExchangeAction` (keeps the "already billed ⇒ refuse" guard). File rows link to `/command/files?tx=`.

### Tab 4 — Billing
- **Contains:** fact strip (mode, fee tier, VAT, Stripe, payment status, lifetime billed), banked/pipeline/forecast KPIs, pipeline outlook, active-files-with-expected-fees, recent exchanges, and the **editable fee controls**.
- **Reads:** `getAgencyRevenueDetail(agencyId, now)` (`revenue.ts`) — the exact function `revenue/[agencyId]` uses today.
- **Reuses verbatim:** `AgencyFeeEditor` → `saveAgencyFeeAction` (incl. the retroactive free `updateMany`); `MarkFreeToggle`.
- **Consolidates:** `revenue/[agencyId]` → this tab (then redirect `/command/revenue/[agencyId]` → `?tab=billing` after parity).
- **Single-source rule:** `getAgencyFileHeader` and `getAgencyRevenueDetail` both read overlapping `Agency` billing columns (`feeTier`, `legacyOutsourcedFeePence`, `vatRegisteredAt`, `paymentFailedAt`, `stripeCustomerId`, …). The Billing tab fetches the agency row **once** and feeds both the fact strip and the fee editor — no double-source.
- **`isInternal` branch:** `getAgencyRevenueDetail` returns `null` for internal agencies; this tab must render the "not applicable" state for them (matching today).

### Tab 5 — Comms & deliverability
- **Contains:** client-email delivery summary + recent rows; reachability (bounced/unsubscribed/paused contacts + paused files); read-only sender/branding summary.
- **Reads:** `getAgencyEmailLog(agencyId)`, `getAgencyReachability(agencyId, now)` (both `agency-file.ts`).
- **Actions:** read-only in this slice. (Future: "resend a failed email" / delivery timeline — §D of doc 00, a later Operate slice.)

### Tab 6 — Settings
- **Contains:** automation controls, setup readiness, portal/branding config (read), signup attribution (read), and the **Data & GDPR danger zone**.
- **Reads:** `getAgencySetupReadiness({ agencyId })`, `solicitorChaseSettings` singleton (for the chase-master context), settings snapshot from `getAgencyFileHeader`.
- **Reuses verbatim:** `AgencyAutomationControls` (6 flags + lifecycle) → `agency-{chase,weekly-update,whatsapp,retention}` actions; `AgencyDataControls` → `offboard` route (close/purge) + `/api/gdpr/contact`; `ViewAsButton` → `startViewAsAction`.
- **Gating preserved exactly:** automation/fee = `hasAdminPowers`, no step-up; **danger zone = real `superadmin` + step-up cookie + typed confirm + reason + audit** (and blocked for internal agencies). **This tab's danger zone depends on Slice 2** (`requireStepUp()` + founder TOTP) if the founder is to use close/purge/GDPR; until then it behaves exactly as today (hybrid can't invoke the four step-up routes).

---

## 4. The five shared write paths — must stay single-sourced

Carried from doc 01 §8; the account must not fork any of these:
1. **Automation flags** — written from both the `agencies` Controls matrix and the account via the same `agency-{chase,weekly-update,whatsapp}` actions. One writer.
2. **Agency logo** — `EmailBrandingStudio` (People tab) and the director's `/agent/settings` write the same `Agency.logo*`; shown read-only in Comms. One source.
3. **`freeOnExchange`** — `saveAgencyFeeAction` (bulk) and `setSaleFreeOnExchangeAction` (per-file); keep the already-billed guard.
4. **Revalidation nuance** — automation actions `revalidatePath("/command/agencies")` (the list), so the account UI updates via `router.refresh()`. **Preservation tests assert the refresh path, not the revalidate target.**
5. **`isInternal` branching** — differs across `getAgencyRevenueDetail` (null), `getAgencyFileHeader` (allowed), offboard (blocked). Branch consistently per tab.

---

## 5. Consolidation & redirect map

| Existing surface | Becomes | When redirected |
|---|---|---|
| `/command/agency/[agencyId]` | the account (tabs added in place) | — (unchanged route) |
| `/command/revenue/[agencyId]` | account → Billing tab | `→ ?tab=billing` **after** Billing parity verified |
| `/command/agencies/[userId]` | account → People (person drill) | kept standalone; redirect later (optional) |
| `/command/agencies` (list) | row opens the account | unchanged (it already links to the account) |

Redirects use Next `redirect()`/route config and land only after the destination tab is proven equivalent — bookmarks and inbound links keep working throughout.

---

## 6. Preservation contract

Use the eight-dimension testable contract from [`01-PHASE-0-1-PROPOSAL.md`](01-PHASE-0-1-PROPOSAL.md) §8, applied to each tab's reads/writes/gating. Additions for this slice:
- **Billing parity test:** assert `getAgencyRevenueDetail` figures render identically in the tab vs the old page for a fixed agency (incl. the internal-agency null branch).
- **People parity test:** `getAgentDetail` metrics + the photo/branding write paths unchanged.
- **Shared-write test:** toggling an automation flag in the account and in the `agencies` Controls matrix writes the same `Agency` column via the same action (one writer).
- **Redirect test:** `/command/revenue/[agencyId]` resolves to `?tab=billing` once cut over.

---

## 7. Proposed build order (within the account slice, reviewable sub-steps)

1. **Tab shell** — add `?tab=` + `ParamTabs` to `/command/agency/[agencyId]`, moving today's sections under **Overview** + **Settings** with **zero data/behaviour change** (pure reorganisation). Ship/verify this first — it's the safest step and proves the shell.
2. **People tab** — bring `getAgentDetail` + the two editor components in-context.
3. **Billing tab** — bring `getAgencyRevenueDetail` + fee controls; single-source the agency row; add the parity test; then redirect `revenue/[agencyId]`.
4. **Sales & files** and **Comms & deliverability** — reorganise existing reads into their tabs.
5. Extract the **shared account shell pattern** so the progression-company account (next slice) can reuse it.

---

## 8. Open questions for review

1. **Tab set** — six tabs as above, or fold Comms into Overview / split differently?
2. **People standalone route** — redirect `/command/agencies/[userId]` into the account tab, or keep it as a separate deep-linkable page too?
3. **Danger zone before Slice 2** — the Settings danger zone needs `requireStepUp()` (Slice 2) for the founder to use close/purge/GDPR. Build the account now with the danger zone behaving exactly as today (superadmin-only, hybrid can't invoke), and wire founder step-up when Slice 2 lands — agreed?
4. **Progression-company account** — confirm it's a **separate next slice** reusing the shell with its own tabs (Overview/Team/Clients/Billing/Setup) and `businesses.ts` loaders, not a shared agency implementation.
