# Inventory: Transaction List

**Route:** `/agent/transactions`
**Stage 1 status:** Draft — awaiting Ellis review
**Amendments:** See §14

> **No polish page exists yet.** Stage 2 will build `app/agent/polish/transaction-list/page.tsx` from scratch using this inventory + transaction-detail / hub / work-queue baselines.

> **Dashboard relationship — surface this first.** `/agent/dashboard` renders the same `TransactionListWithSearch` core component as this page (lines 6, 151). The list rendering, status tabs, empty state, and filter logic are structurally near-identical. Dashboard adds `ForecastStrip`, `AgentFlagButton`, `AgentRequestsPanel` on top. **Polish work on transaction list will auto-apply to dashboard's list section** — dashboard's Stage 1 will be much smaller (only the additions need a fresh look). See §12 appendix for the full mapping.

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/transactions` |
| File | `app/agent/transactions/page.tsx` |
| Component type | Mixed — server component page + client `TransactionListWithSearch` (filter/sort state, dropdowns) |
| Who sees it | Director (titled "All Files"), Negotiator (titled "My Files") — same component, different h1 string + scoped data via `agentId` |
| How they reach it | Sidebar nav ("Files"); hub `ForecastStrip` chips deep-link with `?filter=exchanging-this-week` etc.; breadcrumb from `/agent/transactions/[id]` |
| Reachable without a transaction? | Yes — renders zero-files empty state. |

---

## 2. Components rendered

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `AgentShell` (layout) | `components/layout/AgentShell.tsx` | Out of scope | Wrapper; sidebar/topbar |
| Inline glass header (h1 + "+ New sale" + bloom decorations) | `page.tsx:94–166` | Match polish page | **Custom inline header, NOT canonical `PageHeader`.** Uses `--agent-text-h1` (large), custom rgba bg + bloom-decoration absolute divs. Hub/transaction-detail/work-queue all use `PageHeader` with `--agent-text-h2`. Dashboard (the parallel) uses `PageHeader`. **Inconsistency to resolve in Stage 2.** |
| Hub filter indicator banner | `page.tsx:171–212` (inline) | Match polish page | Conditionally rendered when `?filter=exchanging-this-week` etc. Bespoke inline-styled coral-tinted strip. Convert to canonical surface treatment. |
| Zero-files empty state | `page.tsx:214–257` (inline) | Match polish page | `glass-card` → `agent-glass-strong`. Voice fix on body copy (Rule 1 — "you'll see it here"). |
| Status tabs strip | `page.tsx:262–301` (inline) | Match polish page | Bespoke Tailwind: `bg-white/60 text-slate-900/90 shadow-sm` for active, hover `bg-white/20`. Each tab is a `<Link>`. **Convert to `agent-segment-pill` / `agent-segment-pill-sm` for canonical hover/focus/active behaviour.** Count badges become inline pills or `.agent-segment-pill-note`. |
| `EmptyState` (filter-empty) | `components/ui/EmptyState.tsx` | Match polish page | Generic empty-state component used here when filtered-empty. Wrapper class `glass-card` → `agent-glass-strong`. Tailwind text classes → token-driven. |
| `TransactionListWithSearch` | `components/transactions/TransactionListWithSearch.tsx` | Match polish page | **Main content client component.** Contains search input, 3 filter chips, table. Significant class audit required. Sub-components below. |
| ↳ `AssignedToChip` | (inline, TransactionListWithSearch.tsx:34) | Match polish page | Bespoke pill (`chipBase` / `chipDefault` / `chipActive` Tailwind constants). Dropdown menu items use `agent-hover-row` ✓. Convert chip trigger to `agent-segment-pill`. Convert dropdown container to `agent-dropdown-in`. Convert items to `agent-dropdown-item`. |
| ↳ `RiskChip` | (inline, TransactionListWithSearch.tsx:92) | Match polish page | Same Tailwind chip pattern. Same conversions. Multi-select dropdown with checkboxes — markup preserved. |
| ↳ `ManagedByChip` | (inline, TransactionListWithSearch.tsx:143) | Match polish page | Same conversions. Voice — "Self-progressed" / "With progressor" need translation per VOICE_GUIDELINES.md table → "Managed by you" / "Our team is handling". |
| ↳ Search input | (inline, TransactionListWithSearch.tsx:302) | Match polish page | `glass-input` Tailwind → `agent-input`. Embedded search icon + clear `×` button preserved. |
| ↳ Filtered empty | (inline, TransactionListWithSearch.tsx:345) | Match polish page | `glass-card px-5 py-8 text-center` → `agent-glass-strong`. Text classes → tokens. Voice review on `"No files match the active filters."` (Rule 3 — borderline passive). |
| `TransactionTable` | `components/transactions/TransactionTable.tsx` | Match polish page | Card with grid header + body. `glass-card` + `clipPath: inset(0 round 20px)` → `agent-glass-strong` + `overflow: hidden`. Header row Tailwind classes converted to token-driven inline. Sortable column headers' hover/active states audited. |
| ↳ `TransactionRowView` | `components/transactions/TransactionRowView.tsx` | Match polish page | Row component — has dual mobile-card / desktop-grid layouts. Hover `hover:bg-white/20 active:bg-white/30 transition-colors` → `agent-hover-row`. Tailwind text colour classes (`text-slate-900/90` etc.) → token-driven. |
| ↳ `StatusBadge` | `components/ui/StatusBadge.tsx` | Reuse from transaction-detail | Canonical pill component used across the app. No changes — its bg/border Tailwind hex (`bg-red-50 text-red-700 border-red-200`) is the StatusBadge solid pattern that the work-queue StatPill fix already validated. |
| ↳ `ExchangeTargetCell` | `components/transactions/ExchangeTargetCell.tsx` | Out of scope | Native iOS date picker via hidden `<input type="date">`. Server PATCH wiring + native picker integration untouched. Only visible text styles audited (12px coral colour). |
| ↳ `RiskBadgeWithPopover` | `components/transactions/RiskBadgeWithPopover.tsx` | Match polish page | Hover popover. Trigger button uses `RISK_CONFIG[level]` bg/border/color Tailwind. Popover container: `bg-white rounded-xl shadow-xl` → `agent-dropdown-in` (with portal — same pattern as work-queue dropdowns to escape ancestor overflow). |
| `loading.tsx` (skeleton) | **None exists** | Match polish page | **Gap.** Stage 2 should add a skeleton: header shape + 5–8 row placeholders. Work-queue `loading.tsx` as reference. |

**Depth note:** `TransactionListWithSearch` defines 3 inline chip components (`AssignedToChip`, `RiskChip`, `ManagedByChip`) that all repeat the same `chipBase`/`chipDefault`/`chipActive` Tailwind class pattern. After conversion to `agent-segment-pill`, the helpers can either stay (cleaner API) or fold into inline buttons (less indirection). Stage 2 to decide.

**Depth note:** `splitAddress` helper is duplicated across `TransactionRowView.tsx:34`, `ForecastStrip.tsx:7`, and `lib/services/hub.ts` (per memory). Code smell — file in `docs/TODO.md`, not fixed in this pass.

---

## 3. Data dependencies

| Data | Source | Shape | Notes |
|---|---|---|---|
| `session` | `requireSession()` | `{ id, agencyId, role, name }` | Redirect to login if missing |
| `vis` | `resolveAgentVisibility(userId, agencyId)` | Visibility scope (director sees all agency files; negotiator sees own) | Drives `seeAll` + `agentId` flags below |
| `allTransactions` | `listTransactions(agencyId, agentId, opts)` | `TransactionRow[]` | Full list before client filter; includes `health`, `serviceType`, `contacts`, `agentUser`, `assignedUser` |
| `counts` | `countTransactionsByStatus(agencyId, agentId, opts)` | `{ active, on_hold, completed, withdrawn }` numeric counts | Powers status-tab count badges |
| `searchParams.filter` | URL query | `string \| undefined` | Either a `HubFilter` (exchanging-this-week etc.) or a `TransactionStatus \| "all"` |
| `matchingIds` | `getHubFilteredIds(vis, hubFilter)` | `string[]` | Only fetched when a hub filter is active; filters `allTransactions` by ID set |
| Derived: `filteredTransactions` | computed in server component | `TransactionRow[]` | After hub-filter or status-filter applied |
| Derived: `isDirector` | `session.user.role === "director"` | boolean | Toggles h1 text + `showOwner` column on table |

**Null / missing data:**
- `allTransactions.length === 0` → zero-files empty state (with `+ New sale` CTA)
- `filteredTransactions.length === 0` (filter applied, no results) → `EmptyState` card
- `health === undefined` on a transaction → risk badge shows "—"; lastActive shows "Just added"

---

## 4. States

### Standard states

| State | Trigger | What the user sees |
|---|---|---|
| **Loading** | Server fetch in progress | **Currently no `loading.tsx`** — page renders nothing during fetch. Stage 2 to add skeleton. |
| **Zero files** | `allTransactions.length === 0` | HouseLine icon + "Create your first sale" + body voice violation + "+ New sale" CTA (`glass-card`) |
| **Active list (default)** | `allTransactions.length > 0`, no filter | Header + status tabs (Active selected) + `TransactionListWithSearch` |
| **Hub filter active** | `searchParams.filter` is a `HubFilter` | Header + filter banner ("Showing exchanging this week (3)") + list filtered. **Status tabs hidden** when hub filter is active. |
| **Status filter — non-active tab** | `searchParams.filter` is a `TransactionStatus` other than "active" | Status tabs show selected tab; list filtered to that status |
| **Filtered empty (status)** | Status filter yields zero rows | `EmptyState` with "No active files" / "No on_hold files" etc. + "View all" link |
| **Filtered empty (hub filter)** | Hub filter yields zero rows | `EmptyState` with `FILTER_EMPTY[hubFilter].title/description` + "View all files" link |
| **Client-filter empty** (inside TransactionListWithSearch) | Search + chip filters yield zero rows | `glass-card` muted message ("No files match \"query\"" / "No files match the active filters.") + "Clear filters" link |
| **Error** | Server throws | `error.tsx` boundary — not styled this pass |

### Page-specific states

| State | Trigger | What the user sees |
|---|---|---|
| **Director view ("All Files")** | `session.user.role === "director"` | h1 reads "All Files"; row's Owner column shown when no owner filter applied (`showOwner` true) |
| **Negotiator view ("My Files")** | role `negotiator` | h1 "My Files"; data scoped to `agentId = session.user.id`; no Owner column |
| **Multiple owners filter chip visible** | `uniqueUsers.length > 1` | AssignedToChip appears in chip row |
| **Mixed service-type filter chip visible** | At least one transaction `self_managed` AND one `outsourced` | ManagedByChip appears |
| **Sort active on column** | User clicked a sortable header (Property / Exchange / Status / Risk / Last active) | Active column's chevron solid; click toggles asc/desc |
| **Risk filter narrowed** | One or more risk levels selected | Rows filtered to those levels; chip shows "Risk: At risk, Watch" |
| **Search active** | Query in search input | Rows filtered by `propertyAddress.includes(query)`; `×` clear button visible |
| **Last-active "stale" badge** | `> 30 days` since last activity | Inline red "Stale" badge on the Last active cell |
| **Exchange-date inline edit** | User taps the coral "Set exchange date" prompt | Native iOS date picker opens; PATCH to `/api/transactions/[id]` on selection |
| **Risk popover open** | User hovers (desktop) or taps risk badge | Popover with score breakdown via `RISK_CONFIG[level]` |

---

## 5. Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| "+ New sale" (header) | Glass header right | Navigate to `/agent/transactions/new` | Never | — |
| "+ New sale" (empty-state CTA) | Empty state card | Same | Never | — |
| Status tab `<Link>` (All / Active / On Hold / Completed / Withdrawn) | Status strip | Sets `?filter=...` URL param (or removes for active) | Never | — |
| Clear filter "× Clear filter" | Hub filter banner right | Navigate to `/agent/transactions` (clears filter) | Never | — |
| "View all files" / "View all" | `EmptyState` action | Same | Never | — |
| Search input | TransactionListWithSearch | Filters rows client-side by `propertyAddress.includes(q)` | Never | — |
| Search clear `×` | Search input right | Resets query to `""` | Renders only when `query.length > 0` | Hidden |
| AssignedToChip trigger | Filter chip row | Opens dropdown | Renders only when `uniqueUsers.length > 1` | Hidden |
| AssignedToChip option | Dropdown | `setSelectedUserId(id)` | Never | — |
| AssignedToChip clear `×` | Chip when active | Resets to null | Renders only when chip is active | — |
| RiskChip trigger | Filter chip row | Opens dropdown | Never | — |
| RiskChip checkbox (Low / Medium / High) | Dropdown | Toggles `selectedRiskLevels` Set | Never | — |
| ManagedByChip trigger | Filter chip row | Opens dropdown | Renders only when both service types exist | Hidden |
| ManagedByChip option | Dropdown | `setManagedByFilter` | Never | — |
| "Clear all" | Chip row, far right | Resets all client-side filters | Renders only when `anyFilterActive` | Hidden |
| Sort header (Property) | Desktop column header | Toggles sort by property name asc/desc | Never | — |
| Sort header (Exchange Target) | Same | Sort by `expectedExchangeDate` | Never | — |
| Sort header (Status) | Same | Sort by `STATUS_ORDER` | Never | — |
| Sort header (Risk) | Same | Sort by `riskScore()` | Never | — |
| Sort header (Last active) | Same | Sort by `health.lastActivityAt` | Never | — |
| Transaction row link | Each row | Navigate to `/agent/transactions/[id]` | Never | — |
| ExchangeTargetCell native input | Inline in row | Opens native date picker; PATCH on change | `saving` (during fetch) | Coral text fades to 0.45 opacity |
| RiskBadgeWithPopover trigger | Risk cell | Toggles popover (hover on desktop, tap-toggle on mobile) | Never | — |

---

## 6. Conditional renders

```tsx
{hubFilter && <HubFilterBanner />}
// Shows: when URL has ?filter=exchanging-this-week | completing-this-week | closing-this-month | exchanging-next-30-days

{allTransactions.length === 0 ? <ZeroFilesEmptyState /> : <ListSection />}
// Zero-files: new agency, no transactions
// ListSection: any other state

{!hubFilter && <StatusTabs />}
// Status tabs shown ONLY when no hub filter is active
// When hub filter active: tabs hidden, banner shows instead

{filteredTransactions.length === 0 ? <FilteredEmptyState /> : <TransactionListWithSearch />}
// Filtered empty: server-side filter (status or hub) yields zero rows
// TransactionListWithSearch: when there are rows to render

{/* Inside TransactionListWithSearch: */}
{showUserFilter && <AssignedToChip />}        // Multiple owners exist
{showManagedByFilter && <ManagedByChip />}    // Both service types exist
{anyFilterActive && <ClearAllButton />}        // Any client-side filter active

{filtered.length === 0 ? <ClientFilteredEmpty /> : <TransactionTable />}
// Client-filtered empty: search + chip filters yield zero
// Table: rows exist after all filters

{/* Inside TransactionRowView: */}
{tx.assignedUser ? <AssignedAvatar /> : tx.serviceType === "outsourced" ? <AwaitingAssignment /> : tx.agentUser ? <AgentName /> : <Unassigned />}
// Cascade of fallbacks for the Assigned-To cell

{lastActive.stale && <StaleBadge />}  // > 30 days inactive

{showOwner && <OwnerColumn />}  // Director view + no owner filter applied
```

---

## 7. Copy inventory

**Verbatim rule:** every string exactly as it renders. Flagged with `← FLAG for voice pass`.

```
# Page header
"All Files"                              [h1 — director]
"My Files"                               [h1 — negotiator]
"+ New sale"                             [primary CTA]

# Hub filter banner (dynamic)
"Showing exchanging this week (N)"       [example — uses FILTER_LABELS]
"× Clear filter"                         [clear button]

# Hub filter labels (FILTER_LABELS map)
"Exchanging this week"
"Completing this week"
"Closing this month"
"Exchanging in the next 30 days"

# Filter-empty titles (FILTER_EMPTY map)
"No files exchanging this week"
"No files completing this week"
"No files closing this month"
"No files exchanging in the next 30 days"

# Filter-empty descriptions
"Files appear here when their expected exchange date is within the next 7 days."
"Files appear here when their completion date is within the next 7 days."
"Files appear here when their expected exchange date falls within the current calendar month."
"Files appear here when their expected exchange date is within the next 30 days."

# Empty state action
"View all files"
"View all"

# Zero-files empty state
"Create your first sale"                 [heading]
"Once you submit a sale, you'll see it here. Track milestones, manage chases, and progress to exchange."
                                         [body] ← FLAG for voice pass — Rule 1 (system self-reference: "you'll see it here")
"+ New sale"                             [CTA — same as header button]

# Status tabs
"All"
"Active"
"On Hold"
"Completed"
"Withdrawn"

# Filtered empty (status)
"No active files"                        [dynamic — statusFilter inserted]
"No on_hold files"                       ← FLAG for voice pass — schema underscore "on_hold" rendered verbatim. Should be "No on-hold files".
"No completed files"
"No withdrawn files"
"Try a different filter."                [description]

# Search input
"Search by address…"                     [placeholder]

# Filter chips (closed state labels)
"Owner"                                  [AssignedToChip — no selection]
"Risk"                                   [RiskChip — no selection]
"Managed by"                             [ManagedByChip — no selection]

# Filter chips (active state labels)
"Owner: {firstName}"                     [AssignedToChip — selected]
"Risk: At risk, Watch"                   [RiskChip — example with two selected]
"Self-progressed"                        [ManagedByChip — value] ← FLAG for voice pass — translation table: self_managed → "Managed by you"
"With progressor"                        [ManagedByChip — value] ← FLAG for voice pass — translation table: outsourced → "Our team is handling"

# Filter chip dropdowns
"All owners"                             [AssignedToChip option]
"Low risk"                               [RiskChip checkbox — uses RISK_LABEL]
"Medium risk"                            ← FLAG — labels are RISK_LABEL ("On track" / "Watch" / "At risk" / "No data"). Inline render is "{RISK_LABEL[level]} risk" so the strings are "On track risk", "Watch risk", "At risk risk", "No data risk" — **broken grammar.** Surface for fix in §7.1.
"High risk"
"All"                                    [ManagedByChip option]
"Self-progressed"                        ← same as chip label flag
"With progressor"                        ← same as chip label flag

# Risk labels (RISK_LABEL map)
"On track"
"Watch"
"At risk"
"No data"

# Risk popover (RiskBadgeWithPopover)
"{score}/100"                            [score readout]
[plus factor rows from RISK_CONFIG — verified inside RiskBadgeWithPopover, not all rendered here]

# Clear all
"Clear all"                              [chip row right]

# Client-filtered empty (inside TransactionListWithSearch)
"No files match \"{query}\""             [search-only empty]
"No files match the active filters."     [chip-filter empty] ← FLAG for voice pass — Rule 3 (active/specific)
"Clear filters"                          [reset link]

# Table column headers (desktop)
"Property"
"Assigned To"
"Exchange Target"
"Status"
"Risk"
"Last active"
"Owner"                                  [shown only when isDirector + no owner filter]

# Transaction row — Property cell
"{addressLine}"                          [first part of address]
"{location}"                             [last two address segments — e.g. "Bath, BA1 2NE"]
"Vendor: {firstNameLastInitial} · Buyer: {firstNameLastInitial}"
"Vendor: not set"                        [missing vendor]
"Buyer: not set"                         [missing buyer]
"Names not set"                          [neither vendor nor buyer]
"→ {nextActionLabel}"                    [dynamic — health.nextActionLabel]

# Transaction row — Assigned To cell
"{assignedUser.name}"                    [with avatar]
"Awaiting assignment"                    [outsourced + no assignedUser]
"{agentUser.name}"                       [fallback]
"Unassigned"                             [italic]

# Transaction row — service tag
"With progressor"                        ← FLAG — same translation
"Self-progressed"                        ← FLAG — same translation

# Transaction row — Last active cell
"Just added"                             [no activity, transaction is new]
"Today, {HH:mm}"                         [today]
"Yesterday"
"{N} days ago"
"Stale"                                  ← FLAG for voice pass — Rule 2 (dev shorthand, same precedent as work-queue's "stale" → "not progressing" fix at FileAlertsStrip.tsx:61). Suggest "Quiet" or "Inactive" or per-row equivalent.

# Owner cell (when shown)
"{agentUser.name}"
"{ROLE_LABEL[role]}"                     [Director / Negotiator / Progressor / Admin]
"—"                                      [no owner]

# ExchangeTargetCell
"Set exchange date"                      [coral, no date set] — actually labelled with target date — verify in component
"{date}"                                 [formatted exchange date]
```

### 7.1 Voice flags surfaced — pre-locked rewrites

| Location | Current copy | Proposed copy | Reason |
|---|---|---|---|
| Zero-files body (page.tsx:246) | "Once you submit a sale, you'll see it here. Track milestones, manage chases, and progress to exchange." | "Sales appear here once you submit one. Track milestones, manage chases, and progress to exchange." | Rule 1 — drop "you'll see it here" system-narration framing; lead with the user-facing outcome |
| Status-filtered empty (page.tsx:321) | "No on_hold files" | "No on-hold files" | Schema underscore renders verbatim; humanise the hyphenation |
| ManagedByChip label "Self-progressed" | (multiple sites) | "Managed by you" | VOICE_GUIDELINES.md translation table |
| ManagedByChip label "With progressor" | (multiple sites) | "Our team is handling" | VOICE_GUIDELINES.md translation table |
| RISK_LABEL dropdown render | "On track risk" / "Watch risk" / "At risk risk" / "No data risk" | "On track" / "Watch" / "At risk" / "No data" (drop the trailing "risk") | **Broken grammar** — the inline render at TransactionListWithSearch.tsx:132 appends " risk" to the RISK_LABEL value. "At risk risk" reads wrong. Either drop the suffix or move it inside RISK_LABEL where it makes sense |
| Client-filtered empty (TransactionListWithSearch.tsx:350) | "No files match the active filters." | "No files match." | Rule 3 — drop the passive pointer to "the active filters"; same pattern as work-queue Stage 3 voice review |
| Last active "Stale" badge | "Stale" | "Quiet" — or migrate to the work-queue precedent "Not progressing" if a multi-word label fits | Rule 2 — "stale" is dev shorthand; same correction Ellis caught on FileAlertsStrip during work queue Stage 4 |

---

## 8. Desktop view

| Field | Value |
|---|---|
| Breakpoint | Desktop ≥ 768px (md:) for table layout; ≥ 1024px (lg:) for AgentShell sidebar fully expanded |
| Layout | Single-column main; AgentShell sidebar (240px fixed) on left |
| Page-specific desktop elements | Glass header with two absolute-positioned bloom decorations (coral top-right, gold bottom-left); 7-column (or 8 with Owner) grid table; sortable column headers with chevrons on hover |
| Desktop-only elements | Table grid header row (`hidden md:grid`); chevron sort indicators |

```
Desktop layout (≥ 1024px):
┌─ AgentShell sidebar ──┬─ main content ──────────────────────────────────────┐
│                        │  ┌─ Glass header (bloom decorations) ────────────┐ │
│                        │  │ All Files (h1)              [+ New sale]      │ │
│                        │  └────────────────────────────────────────────────┘ │
│                        │  [hub filter banner — conditional]                  │
│                        │  [All] [Active] [On Hold] [Completed] [Withdrawn]   │
│                        │  [search input.....................................] │
│                        │  [Owner ▾] [Risk ▾] [Managed by ▾] [Clear all]      │
│                        │  ┌─ TransactionTable (glass-card) ──────────────┐  │
│                        │  │ Property | Assigned To | Exch. | Status |    │  │
│                        │  │ ──────── | ─────────── | ───── | ────── |    │  │
│                        │  │ row 1                                        │  │
│                        │  │ row 2                                        │  │
│                        │  │ ...                                          │  │
│                        │  └──────────────────────────────────────────────┘  │
└────────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 9. Mobile view

| Field | Value |
|---|---|
| Breakpoint | Mobile < 768px (md: collapses) |
| Layout | Single column. AgentShell sidebar → topbar with hamburger |
| Elements that reorder | Header h1 + "+ New sale" stack vertically (`flex-col gap-3 md:flex-row`) |
| Elements that become stacked cards | TransactionTable grid → per-row vertical card (`flex md:hidden` / `hidden md:grid` dual layout already in TransactionRowView) |
| Status tabs | Horizontal scroll (`overflow-x-auto`) |
| Filter chips | Wrap (`flex-wrap`) |
| Hidden on mobile | Table grid header row (`hidden md:grid`); sort chevrons |

```
Mobile layout (375px):
┌───────────────────────────────┐
│ [☰] All Files          [user] │  ← AgentShell topbar
├───────────────────────────────┤
│ Glass header                  │
│ All Files                     │
│ [+ New sale]                  │  ← stacked under h1
├───────────────────────────────┤
│ [hub filter banner — wrap]    │
│ [All][Active][On Hold]...     │  ← horizontal scroll
│ [search..............]        │
│ [Owner ▾] [Risk ▾] [Mgd ▾]    │
│ ┌─ TransactionRowView card ─┐ │
│ │ │ Address line             │ │  ← left risk stripe + body
│ │ │ Vendor: X · Buyer: Y     │ │
│ │ │ [Status] [Risk] Last: ...│ │
│ │ │ Exchange: {date}         │ │
│ │ │ Assigned: {name}         │ │
│ └──────────────────────────┘ │
│ ┌─ (next row card) ─────────┐ │
│ ...                           │
└───────────────────────────────┘
```

**Mobile gaps to document for Stage 2:**

1. **Status tabs horizontal scroll** — `overflow-x-auto` works but tabs lack scroll affordance. Stage 2 could add a fade-out gradient on right edge to hint at more content. Worth flagging.
2. **Filter chip row** — wraps onto multiple lines when many chips. Acceptable but at 375px with active states + clear-all, can get tall. Document.
3. **Mobile row card** — already well-designed in `TransactionRowView` (lines 156–206). Keep mostly intact during transplant; only class audits.

---

## 10. Animations / transitions already in place

| Element | Animation | Source |
|---|---|---|
| Filter chip hover | `hover:border-slate-900/20 hover:text-slate-900/70 transition-colors` | TransactionListWithSearch chips |
| Dropdown menu items | `agent-hover-row` (canonical ✓) | TransactionListWithSearch chip dropdowns |
| Row hover | `hover:bg-white/20 active:bg-white/30 transition-colors` | TransactionRowView desktop + mobile |
| Status tab hover | `hover:bg-white/20 transition-colors` | page.tsx:285 |
| Sort chevron reveal | `opacity-0 group-hover/hdr:opacity-100 transition-opacity` | TransactionTable:65 |
| Risk popover open | None — instant `{open && <div>}` | RiskBadgeWithPopover:51 |
| ExchangeTargetCell colour transition | inline `color` change between saving/idle states | ExchangeTargetCell:50 |

---

## 10.5. Global animation and interaction inheritance

Reference: `docs/polish-pass/ANIMATION_STANDARDS.md`.

**Animation classes (§1–6):**

| Class | Applies? | Where | Status |
|---|---|---|---|
| `.agent-acc` / `.agent-acc-in` | No | No collapsible sections on this page | N/A |
| `.agent-reveal-in` / `.agent-reveal-out` | No | No inline edit forms or transient panels | N/A |
| `.agent-dropdown-in` | YES (needed) | AssignedToChip / RiskChip / ManagedByChip dropdown containers; RiskBadgeWithPopover popover | **Needs wiring.** All four currently use raw inline-positioned divs with no entrance animation. Per work-queue B1 lessons, should also be `createPortal`-rendered to escape any ancestor `overflow: hidden`. |
| `.agent-row-flash` | No | No optimistic-update success rows on this page | N/A |
| `.agent-row-exit` | No | No row-delete or row-exit flows on this page | N/A |
| `.agent-btn` press-down | PARTIAL | "+ New sale" buttons (header + empty state) ✓ via `agent-btn-primary`. Sort headers + chip triggers + status tabs are inline `<button>`/`<Link>` without `agent-btn`. | Audit in Stage 2 |

**Interactive-state classes (§6–12):**

| Class | Applies? | Where | Status |
|---|---|---|---|
| `.agent-segment-pill` | YES (needed) | Status tabs (All / Active / On Hold / Completed / Withdrawn); filter chips (Owner / Risk / Managed by) | **Needs wiring.** Currently bespoke `chipBase`/`chipDefault`/`chipActive` Tailwind. |
| `.agent-link` / `.agent-link-muted` | YES (needed) | "View all files" / "View all" (EmptyState actions); "Clear all" filter reset; "× Clear filter" hub-banner reset; "Clear filters" client-filtered-empty | **Needs wiring.** All use bespoke inline Tailwind. |
| `.agent-btn-ghost-bordered` | No | No bordered ghost CTAs on this page | N/A |
| `.agent-acc-hdr` | No | No accordion headers | N/A |
| `.agent-icon-btn` | YES (needed) | Search clear `×`; chip clear `×` (Owner / Managed by) | **Needs wiring.** Currently inline-styled `<span>` / `<button>` with no canonical class. |
| `.agent-dropdown-item` | YES (needed) | AssignedToChip / RiskChip / ManagedByChip dropdown options | **Needs wiring.** Currently `agent-hover-row` (partial — hover works, but no focus/active states from `.agent-dropdown-item`). |
| `.agent-hover-row` | YES (needed) | TransactionRowView's clickable row (currently `hover:bg-white/20 active:bg-white/30 transition-colors`) | **Needs wiring.** Convert to canonical for theme-aware hover. |
| `.agent-hover-link` | No | No colour-shift-only text hovers on this page | N/A |

**E1 exception status:** Not applicable to this page. No urgency colour-coding hierarchy.

**Stage 4 items flagged from this section:**
1. Wire `agent-dropdown-in` (with portal) on all 4 dropdown containers (3 chips + risk popover)
2. Convert filter chips → `agent-segment-pill` (or `agent-segment-pill-sm`)
3. Convert status tabs → `agent-segment-pill` (or new tab variant — Stage 2 decision)
4. Convert dropdown items → `agent-dropdown-item`
5. Convert row hover → `agent-hover-row`
6. Convert search input → `agent-input agent-input-sm` (with `fontSize: 13` per work-queue precedent)
7. Convert all `× Clear` links → `agent-link-muted`
8. Convert clear-button × controls → `agent-icon-btn agent-icon-btn-sm`
9. Replace inline glass header with canonical `PageHeader` (consistency with hub/transaction-detail/work-queue/dashboard) — bloom decorations either dropped or canonicalised
10. Add `loading.tsx` skeleton

---

## 11. Known edge cases

- **Hub-filter URL takes precedence over status filter.** When `?filter=exchanging-this-week` is set, status tabs are hidden and the hub-filter banner shows instead. Status filter resumes when filter is cleared.
- **`active` status is the default.** No `?filter` param means active. The "Active" tab's URL is `/agent/transactions` (no query string).
- **Long property addresses ellipsis-truncate** in desktop table (`text-overflow: ellipsis; white-space: nowrap`). Mobile cards use `leading-snug` without truncation.
- **Risk popover position** — currently absolute, opens upward via `bottom-full`. If row is near top of viewport, popover may clip. Stage 2 portal-conversion solves this.
- **`agentUser.name` vs `assignedUser.name` cascade** — three-level fallback in row "Assigned To" cell. Don't touch the cascade logic during transplant.
- **`isLast={i === sorted.length - 1}` prop on rows** — used to suppress the bottom border on the final row. Preserve this logic.

---

## 12. Out of scope for redesign

- **All server actions / data queries** — `listTransactions`, `countTransactionsByStatus`, `getHubFilteredIds`, `getExchangeForecast`
- **`PATCH /api/transactions/[id]`** from `ExchangeTargetCell` — date-update endpoint
- **`calculateRiskScore` logic + `RISK_CONFIG`** — risk classification rules
- **`StatusBadge`** internals — `STATUS_COLORS` Tailwind classes already shipped on transaction-detail
- **Native iOS date picker integration** in `ExchangeTargetCell`
- **`AgentShell`** wrapper — out of scope (touched only in its own dedicated pass if ever)

### 12.1 Dashboard relationship (appendix — read before starting Page 6)

`/agent/dashboard` and `/agent/transactions` are **structural near-duplicates** at the list level. Verified mapping:

| Surface | `/agent/transactions` | `/agent/dashboard` | Notes |
|---|---|---|---|
| Header | Inline glass header w/ bloom decorations + custom h1 | Canonical `PageHeader` + h1 + `AgentFlagButton` | **Different.** Transaction list should adopt canonical PageHeader in Stage 2. |
| Empty state | Zero-files card + "+ New sale" | Same copy + **ghost preview** (filter tabs + 3 mock rows at 0.3 opacity) | Dashboard has the ghost preview pattern; transaction list doesn't |
| Status tabs | `[All][Active][On Hold][Completed][Withdrawn]` with counts | **Identical** | Same Tailwind, same logic |
| Filtered empty | `EmptyState` with "Try a different filter." | **Identical** | Same component, same copy |
| Filter chips | `TransactionListWithSearch` (Owner / Risk / Managed by) | **Same component, same instance** | Polish work on TransactionListWithSearch covers both pages |
| Table | `TransactionTable` → `TransactionRowView` | **Same components** | Same exact rendering |
| Search | Inline in `TransactionListWithSearch` | **Same** | |
| Hub filter banner | Yes — handles `?filter=exchanging-this-week` etc. | No — different URL param handling | Transaction-list-only feature |
| `ForecastStrip` | Not rendered | Renders when `forecastMonths.length > 0` | Dashboard-only widget |
| `AgentRequestsPanel` | Not rendered | Renders when `agentRequests.length > 0` | Dashboard-only widget |
| `AgentFlagButton` | Not rendered | Renders in PageHeader actions | Dashboard-only |

**Implication for Page 6 (dashboard) Stage 1:**
- ~80% of dashboard's Stage 1 inventory will be "same as transaction-list — see §X"
- The polish work on `TransactionListWithSearch`, `TransactionTable`, `TransactionRowView`, status tabs, filtered-empty state in this Stage 2/Stage 4 cycle **automatically applies to dashboard** (shared imports)
- Dashboard's incremental work: `ForecastStrip` polish, `AgentFlagButton` placement, `AgentRequestsPanel` polish, the ghost-preview pattern in zero-files state
- Recommend dashboard inventory be a much shorter document referencing this one + focused on the 3–4 dashboard-only surfaces

---

## 13. Per-section visual specification

**Baseline:** transaction-detail (Stage 4 ✓ 2026-05-11), hub (Stage 4 ✓ 2026-05-12), work queue (Stage 4 ✓ 2026-05-12). When a surface mirrors one of those, note "Follows {page} pattern."

| Section | Polish-page structure (target for Stage 2) | Production component(s) | Current state vs target | Stage 4 changes required |
|---|---|---|---|---|
| **PageHeader** | Canonical `PageHeader` with `title={isDirector ? "All Files" : "My Files"}` + "+ New sale" `agent-btn-primary agent-btn-sm`. h1 uses `--agent-text-h2` (22px) per hub/work-queue norm. **Drops the bloom decorations** — they're unique-snowflake to this page and don't appear elsewhere in the agent app. | Inline glass header at `page.tsx:94–166` | h1 uses `--agent-text-h1` (large, ~30px). Custom rgba bg with `backdrop-filter blur(28px)`, two absolute bloom divs (coral + gold gradients), 0.5px white border-bottom. | **Replace inline header with `<PageHeader title=... ><Link>+ New sale</Link></PageHeader>`.** Drop bloom decorations. Drop oversize h1. Match dashboard which already uses PageHeader. Stage 2 question: keep "+ New sale" as the only action, or follow dashboard's "+ New sale + AgentFlagButton" pattern? |
| **Hub filter banner** | `agent-glass-strong` strip with `borderRadius: 10`, coral-tinted overlay via inline rgba. Filter label inline, count in muted. Right side: `agent-link agent-link-muted` "× Clear filter" with `agent-icon-btn-sm` for the × icon. | `page.tsx:171–212` inline | Inline bg `rgba(coral-base, 0.07)` + border `rgba(coral-base, 0.18)`. "× Clear filter" bespoke styled pill with `bg-white/55 border rgba(0,0,0,0.08)`. | Convert clear button → `agent-link agent-link-muted` (no pill background). Outer surface stays inline coral-tinted (it's a filter indicator, intentionally distinct from glass cards). |
| **Zero-files empty state** | `agent-glass-strong` card, `padding: "48px 24px"`, `textAlign: "center"`. HouseLine icon 32px muted. Heading 15px / 600 / primary. Body 13px / muted with **voice-fixed copy** (see §7.1). "+ New sale" CTA as `agent-btn-primary agent-btn-md`. Follows hub/work-queue zero-files pattern. | `page.tsx:214–257` | `glass-card` (not `agent-glass-strong`). Voice violation in body. | `glass-card` → `agent-glass-strong`. Voice fix. |
| **Status tabs** | `agent-segment-pill agent-segment-pill-sm` for each tab. Active state via `.on` modifier. Count badge inside as `.agent-segment-pill-note` or inline secondary tag. Container loses Tailwind `glass-subtle p-1` — pills are self-styled. Horizontal scroll preserved on mobile. | `page.tsx:262–301` | Bespoke Tailwind: `bg-white/60 text-slate-900/90 shadow-sm` active; `text-slate-900/50 hover:text-slate-900/80 hover:bg-white/20` rest. Count badge with `bg-blue-50/80 text-blue-600`. | Convert each `<Link>` to `agent-segment-pill agent-segment-pill-sm` (with conditional ` on` class). Count badge → inline secondary pill or `.agent-segment-pill-note`. |
| **Search input** | `agent-input agent-input-sm` with `fontSize: 13` inline override (work-queue precedent). Embedded magnifying-glass icon stays. Clear `×` → `agent-icon-btn agent-icon-btn-sm`. | TransactionListWithSearch.tsx:302 | `glass-input` Tailwind. | Same conversion pattern as work-queue filter bar. |
| **Filter chips (3)** | Each chip → `agent-segment-pill agent-segment-pill-sm` trigger. Active state with `.on` modifier. Clear `×` inside active chip → `agent-icon-btn agent-icon-btn-sm`. Voice fix on ManagedByChip labels ("Self-progressed" → "Managed by you"). | TransactionListWithSearch.tsx:34, 92, 143 | Bespoke `chipBase`/`chipDefault`/`chipActive` Tailwind. | Convert all three chip triggers → `agent-segment-pill agent-segment-pill-sm`. Inline `×` clear → `agent-icon-btn`. Voice fixes. |
| **Filter chip dropdowns** | Each dropdown rendered via `createPortal` to `document.body` (escape ancestor `overflow: hidden`). Container styled with `bg-white rounded-xl shadow-lg border` (matches work-queue snooze dropdown pattern). Class `agent-dropdown-in` for entrance animation. Items → `agent-dropdown-item`. | TransactionListWithSearch.tsx (3 chip dropdowns) | Inline-positioned `absolute` divs with `agent-hover-row` items but no `agent-dropdown-in`. | Portal-render. Wire `agent-dropdown-in` + `agent-dropdown-item`. Fix RISK_LABEL " risk" grammar bug. |
| **Clear all link** | `agent-link agent-link-muted` 12px. | TransactionListWithSearch.tsx:334 | `text-xs text-slate-900/35 hover:text-slate-900/65 transition-colors` Tailwind. | Convert to canonical. |
| **Client-filtered empty** | `agent-glass-strong` card, `padding: "32px 20px"`, textAlign center. 13px muted text. Voice-fixed "No files match." (Rule 3). "Clear filters" → `agent-link agent-link-muted`. | TransactionListWithSearch.tsx:346 | `glass-card px-5 py-8 text-center`. `text-sm text-slate-900/40`. `agent-link-primary` on link. | Same conversion pattern as work-queue filtered-empty. |
| **Filtered empty (server status / hub)** | `EmptyState` component wrapped in `agent-glass-strong`. EmptyState icon kept (blue notebook). Action "View all files" / "View all" → `agent-link` (or keep agent-link-primary if Stage 2 prefers brand emphasis on empty-state recovery). | `page.tsx:304–333` + `components/ui/EmptyState.tsx` | `glass-card` wrapper. EmptyState text uses Tailwind `text-sm text-slate-900/80`. | `glass-card` → `agent-glass-strong`. EmptyState internals: minor token conversions on text colours. |
| **TransactionTable outer** | `agent-glass-strong` + `borderRadius: 20` + `overflow: hidden` (no need for `clipPath: inset(0 round 20px)`). Follows work-queue SplitFileCard outer pattern. | TransactionTable.tsx:104 | `glass-card` + `clipPath` workaround. | Replace `clipPath` with proper `overflow: hidden` on the canonical class. |
| **TransactionTable header row** | Grid `hidden md:grid` preserved. Background tinted via canonical neutral hover-row tone (`rgba(var(--agent-shadow-rgb), 0.04)` or similar) instead of `bg-white/10`. Each sortable header → `agent-link agent-link-muted` style for the label + hover-reveal sort chevron preserved. Border-bottom → `var(--agent-border-subtle)`. | TransactionTable.tsx:106–134 | `border-b border-white/20 bg-white/10`. Sort buttons inline Tailwind. | Token-driven background + border. Convert sort buttons to canonical link styling. |
| **TransactionRowView desktop row** | `hidden md:grid items-center` preserved. Hover → `agent-hover-row` (replaces `hover:bg-white/20 active:bg-white/30 transition-colors`). Risk stripe (4px left bar) preserved. Property cell typography token-driven (`fontSize: 14, fontWeight: 600, color: var(--agent-text-primary)`). Address-line ellipsis preserved. Vendor/Buyer line `var(--agent-text-muted)`. Next-action chevron text → `var(--agent-coral)` (was `text-orange-600`). | TransactionRowView.tsx:209–298 | Hover via Tailwind. Many Tailwind `text-slate-900/X` text colour utility classes. | Convert hover. Token-driven text colours throughout. |
| **TransactionRowView mobile card** | `flex md:hidden` preserved. Hover → `agent-hover-row`. Same typography token conversion. StatusBadge + RiskBadgeWithPopover preserved unchanged. | TransactionRowView.tsx:157–206 | Same Tailwind patterns. | Same conversions. |
| **StatusBadge** | No changes — already canonical (uses `STATUS_COLORS` Tailwind solid pattern, validated on transaction-detail Stage 4). | `components/ui/StatusBadge.tsx` | Already correct. | Verify only. |
| **RiskBadgeWithPopover trigger** | Pill keeps `RISK_CONFIG[level].bg/border/color` colour mapping. Surface treatment matches StatusBadge pattern. | RiskBadgeWithPopover.tsx:36–49 | Already close to target. | Minor padding/typography audit. |
| **RiskBadgeWithPopover popover** | `createPortal` to body. `agent-dropdown-in` entrance. Inner card `bg-white rounded-xl shadow-xl border` preserved (this is a popover, not a primary surface — neutral white with stronger shadow is appropriate). | RiskBadgeWithPopover.tsx:51–onwards | Inline-positioned `absolute bottom-full` — clips above row top. | Portal-render. Wire `agent-dropdown-in`. |
| **ExchangeTargetCell** | Minor visible-text colour token conversion. Date-picker logic untouched. | ExchangeTargetCell.tsx | Coral inline `rgba(255,107,74,0.85)` for the prompt. | Switch to `var(--agent-coral)` token. |
| **Last-active "Stale" badge** | Inline 9px badge with `bg-red-50 text-red-500 border-red-100` Tailwind. **Voice fix**: "Stale" → "Quiet" (per work-queue precedent). Visual treatment preserved. | TransactionRowView.tsx:179 + :276 | Text "Stale" — Rule 2 violation. | Change text. Class stays. |
| **Loading skeleton** | New `app/agent/transactions/loading.tsx`: PageHeader skeleton shape + status-tab strip skeleton + 5–8 row skeletons. Card rows `agent-glass-strong`. Reference work-queue's loading.tsx structure. | **None exists** | — | Create file. |

---

## 14. Amendments

| Date | Discovery | Added to which section |
|---|---|---|
| 2026-05-12 | **Stage 2 polish page built.** `app/agent/polish/transaction-list/page.tsx`. State toggles: view (populated / zero-files / filter-empty / client-empty), hub filter on/off, director / negotiator (Owner column), reduced motion. Demonstrates every canonical class conversion catalogued in §13. **Bloom-decoration decision locked: Option A — dropped entirely.** PageHeader now identical to hub / transaction-detail / work-queue / dashboard. **`loading.tsx` added** to production at `app/agent/transactions/loading.tsx` (Stage 2 add per Ellis — work-queue loading.tsx as reference). Skeleton mirrors the polish page layout: PageHeader shape + status tab strip + filter bar + 6 row skeletons inside agent-glass-strong table. **Voice fixes applied to polish page** for all 7 §7.1 flagged strings (zero-files body, "on-hold" hyphenation, ManagedByChip labels, RISK_LABEL grammar bug, client-filtered empty, "Quiet" badge). All 4 dropdown surfaces (3 chips + risk popover) use `createPortal` + `agent-dropdown-in` per work-queue B1+B2 pattern. tsc clean. | §13 (all rows), polish page, loading.tsx |

---

## 15. Canonical contributions

Track new canonical classes and tokens added during transaction-list Stage 2 (defined + documented) and Stage 4 (applied). See INVENTORY_TEMPLATE.md §15 for the full discipline.

**Expected library maturity for this page:** transaction list is Page 4 in the queue. By now the canonical library should cover most needs. Anticipated additions: **zero**. Every Stage 4 conversion in §13 maps to an existing canonical class — `agent-glass-strong`, `agent-segment-pill`, `agent-link`, `agent-link-muted`, `agent-input`, `agent-dropdown-in`, `agent-dropdown-item`, `agent-hover-row`, `agent-icon-btn`, `agent-btn-primary`. If Stage 2 surfaces an unexpected pattern, log it here.

**New canonical classes added during transaction-list Stage 2:**

| Class name | file:line in `agent-system.css` | Doc entry in `ANIMATION_STANDARDS.md` | Reason (1 sentence) |
|---|---|---|---|
| _(none — prediction held: zero new classes needed)_ | | | |

**New canonical tokens added during transaction-list Stage 2:**

| Token name | Defined in | Reason |
|---|---|---|
| _(none — prediction held: zero new tokens needed)_ | | |

**Library maturity confirmation:** every Stage 4 conversion catalogued in §13 was satisfied by existing canonical primitives (`agent-glass-strong`, `agent-segment-pill agent-segment-pill-sm`, `agent-link`, `agent-link-muted`, `agent-input agent-input-sm`, `agent-dropdown-in`, `agent-dropdown-item`, `agent-hover-row`, `agent-icon-btn agent-icon-btn-sm`, `agent-btn-primary`, `agent-btn-sm`, `PageHeader`, `agent-skeleton`). Page 4 of the queue confirms the system-maturity trajectory: by now the canonical library covers an entire complex list+filter+table+dropdown surface without extension. The §15 discipline is paying off.
