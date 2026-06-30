# Phase 3 · Surface 4 · Transaction List · Behavioural Baseline

**Route:** [`/agent/transactions`](../../../app/agent/transactions/page.tsx)
**Status:** baseline pinned per [Law 17](../../../CLAUDE.md#law-17--behavioural-baseline-before-remediation).
**Drafted:** 2026-06-30.

---

## 1. Route + auth

- `app/agent/transactions/page.tsx` — async server component (370 lines).
- Layout: `AgentShell`.
- Auth: `requireSession()`.
- Allowed roles: `director`, `negotiator`, `sales_progressor`, `admin`, `viewer`.

---

## 2. Data fan-out

Three parallel queries + 1 conditional ID query:

| # | Query | Returns | Used by |
|---|---|---|---|
| 1 | `listTransactions(...)` | all txs in scope | full list |
| 2 | `countTransactionsByStatus(...)` | counts per status | status tabs |
| 3 | `getExchangeForecast(...)` | 12 forecast months | `ForecastStrip` |
| 4 (conditional) | `getHubFilteredIds(...)` OR `getMonthExchangingIds(...)` | matching tx IDs | client-side filter |

Visibility derivation matches Surfaces 2 + 3.

---

## 3. Render branches

### 3a. True empty (no transactions in scope)
- `PageHeader`
- Centered `agent-glass-strong` card with HouseLine icon
- Director / agency staff: "Create your first sale" + "New sale" Link CTA
- `sales_progressor`: "No files assigned yet"

### 3b. Has transactions, current filter empty
- `PageHeader` + (optional) hub-filter banner OR month-filter banner
- `ForecastStrip`
- Empty-state inside `agent-glass-strong` card using canonical `<EmptyState>` primitive
- 3 sub-branches: hub-filter / month-filter / status-filter

### 3c. Has transactions and filter has matches
- `PageHeader`
- Optional filter banner (hub or month)
- `ForecastStrip` (hidden when hub filter active)
- `TransactionListWithSearch` rendering the table

---

## 4. Role variations

| Role | Title | Subtitle | New-sale Link | AgentFlagButton | showAgencyColumn | showAssignedToColumn |
|---|---|---|---|---|---|---|
| director | "All Files" | "Every file across the agency." | ✓ | ✓ | ✗ | ✓ |
| negotiator | "My Files" | "Files assigned to you." | ✓ | ✓ | ✗ | ✗ |
| sales_progressor | "My Files" | "Files assigned to you." | ✗ | ✗ | ✓ | ✗ |
| admin | "All Files" | "Every file across the platform." | ✓ | ✗ | ✓ | ✓ |
| viewer | "My Files" | "Files assigned to you." | ✗ | ✗ | ✓ | ✓ |

⚠️ **Voice violation flagged**: admin subtitle uses "the platform" (banned per VOICE.md system-self-reference rule). Fixed in PR F1.

---

## 5. Filters

- **Hub filter** (`?filter=exchanging-this-week|completing-this-week|closing-this-month|exchanging-next-30-days`): hub-driven shortcuts.
- **Month filter** (`?exchanging=YYYY-MM`): month from forecast strip click.
- **Status filter** (`?filter=active|on_hold|completed|withdrawn|all`): status tabs (default "active").
- Three-way priority: hub → month → status.

---

## 6. Component inventory (page-level scope)

| File | Lines | Role |
|---|---|---|
| `app/agent/transactions/page.tsx` | 370 | Page orchestrator + filter banners + empty state |
| `components/transactions/TransactionListWithSearch.tsx` | 703 | List shell + search input + status tabs + filter chips (4 createPortal popovers) |
| `components/transactions/TransactionTable.tsx` | 193 | Table chrome + column header (1 `agent-glass-strong`) |
| `components/transactions/TransactionRowView.tsx` | 420 | Single row (1 createPortal popover) |
| `components/transactions/ForecastStrip.tsx` | 142 | Month pill strip |
| `components/transactions/PostExchangeStrip.tsx` | 102 | **1 `glass-card` — clean Card swap target** |
| `components/transactions/RiskBadgeWithPopover.tsx` | 166 | Risk chip (1 createPortal popover) |
| `components/transactions/ExchangeTargetCell.tsx` | 99 | Editable date cell |

Plus reused canonical primitives: `PageHeader`, `EmptyState`, `AgentFlagButton`, `StatPill` (via header).

---

## 7. Mutations + side-effects

| Source | Action | Side-effect |
|---|---|---|
| ExchangeTargetCell | `<input type="date">` change → `updateExpectedExchangeDateAction` | Updates `expectedExchangeDate` for the row |
| TransactionListWithSearch search input | client-side filter | none |
| TransactionListWithSearch sort dropdown | client-side sort | none |
| RiskBadgeWithPopover | hover/click → popover with explanation | none |
| TransactionRowView click | navigate to `/agent/transactions/${id}` | nav |

---

## 8. Visual primitives in use

### Cards
- `glass-card` (Card primitive's canonical chrome): 1 instance — `PostExchangeStrip.tsx:24` ✓ Clean Card swap
- `agent-glass-strong` (hub-style chrome): 3 instances — page empty state (L233), TransactionListWithSearch empty (L682), TransactionTable header (L116). **Extend Surface 2/3 chrome grandfather.**

### Buttons
- `agent-btn-primary` as `<Link>` className: 2 instances in `page.tsx` ("New sale" header L150, empty-state CTA L266). **ButtonLink-pending grandfather (existing entry).**

### Popovers (`createPortal`)
- 4 in TransactionListWithSearch (search clear, status tabs, sort menu, filter chips — anchored popovers)
- 1 in TransactionRowView (per-row menu)
- 1 in RiskBadgeWithPopover (risk explanation)
- **Total: 6** — **Extend Surface 3 popover grandfather entry.**

### Skeletons
- None. No `loading.tsx`, no `agent-skeleton` ghosts.

### Voice
- Page already mostly clean. Only `page.tsx:140` "Every file across the platform." (banned: "the platform").
- All em-dashes (24 total across files) are either inside `{/* JSX comments */}` or single-character "—" placeholder cells (TransactionRowView L408 + L415, ForecastStrip L110) — not prose. Same grandfather pattern as VOICE.md's "Chased — next in {n} days" toast.

---

## 9. Outbound navigation

- "Clear filter" Links → `/agent/transactions`
- Empty-state "View all files" / "View all" Links → `/agent/transactions`
- Each row click → `/agent/transactions/${id}`
- "New sale" → `/agent/transactions/new-v2`
- AgentFlagButton → opens modal (chase flag flow, separate surface)

---

## 10. Known oddities to preserve

- Three-way filter priority (`hubFilter → monthFilter → statusFilter`) — preserve exactly
- Active month pill renders with `.on` state when `monthFilter` is active even when banner above also shows the state — both are intentional (banner = explicit escape hatch, pill = visual position confirmation)
- "ASSIGNED TO" column hidden for negotiator + sales_progressor (their own files only — column would be redundant)
- "AGENCY" column shown only for internal staff
- Empty-state for sales_progressor differs from director ("No files assigned yet" vs "Create your first sale") — intentional role-specific copy
- Month-filter is `?exchanging=YYYY-MM` (not `?filter=`) — explicit URL contract
- `getMonthExchangingIds` uses Postgres day-resolution, not client-side date filtering — preserve

---

## 11. Scope lock

- **In scope**: page.tsx + 7 components under `components/transactions/`
- **Out of scope**: `lib/services/transactions.ts`, `lib/services/hub.ts`, `EmptyState`/`PageHeader`/`AgentFlagButton` (already canonical), `ChaseDrawer` (consumed elsewhere)

This Surface 4 baseline is pinned 2026-06-30.
