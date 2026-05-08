# All Files Page — Discovery Report

**Route:** `app/agent/transactions/page.tsx`  
**User-facing name:** "All Files" (directors) / "My Files" (negotiators)  
**Date:** 2026-05-08

---

## 1. Page structure — top to bottom

Route component: `app/agent/transactions/page.tsx` — async Server Component (339 lines).

### Page metadata

`export const metadata: Metadata = { title: "All Files · Sales Progressor" }` (`page.tsx:13–15`). Static — does not change for negotiators.

### Header section

Glassmorphism header with backdrop blur and two decorative blooms (coral top-right, warm gold bottom-left).

**H1:** Role-conditional at `page.tsx:144`:
```tsx
{isDirector ? "All Files" : "My Files"}
```
`isDirector = session.user.role === "director"` (`page.tsx:62`). Any non-director role sees "My Files."

**Header button:** `+ New sale` — coral primary, links to `/agent/transactions/new`. Present for all roles, no role-gating.

### Body — two top-level states

**State A — zero transactions for this agency/agent scope:**  
`allTransactions.length === 0` (`page.tsx:207`). Renders a standalone glass-card empty state with HouseLine icon. No status tabs, no search bar.

**State B — at least one transaction:**  
Three components in sequence:
1. Hub filter pill (conditional — only when `hubFilter !== null`, `page.tsx:164`)
2. Status tabs (conditional — only when `!hubFilter`, `page.tsx:254`)
3. `TransactionListWithSearch` or a filtered-empty EmptyState card

### Server-side data fetches

At `page.tsx:70–73`, runs two queries in parallel:
- `listTransactions(agencyId, agentId, opts)` — full transaction objects with health data
- `countTransactionsByStatus(agencyId, agentId, opts)` — count integers by status (used for tab badges only)

Hub filter additionally runs `getHubFilteredIds(vis, hubFilter)` at `page.tsx:78` to get a set of IDs for cross-filtering. This is a third DB round-trip.

---

## 2. Status tabs

Rendered at `page.tsx:256–295`. Only visible when `!hubFilter`.

Five tabs, in order:

| Value | Label | Count source |
|---|---|---|
| `all` | All | `allTransactions.length` |
| `active` | Active | `counts.active` |
| `on_hold` | On Hold | `counts.on_hold` |
| `completed` | Completed | `counts.completed` |
| `withdrawn` | Withdrawn | `counts.withdrawn` |

**Default tab:** `active`. When the `filter` param is absent, null, or not a recognised value, `statusFilter` resolves to `"active"` (`page.tsx:66–68`).

**URL pattern:** Active tab → `/agent/transactions` (no param). Other tabs → `/agent/transactions?filter=on_hold`. `scroll={false}` on each Link (`page.tsx:273`).

**Count styling:** Active tab — count badge in `bg-blue-50/80 text-blue-600`. Inactive tabs — count badge in `bg-white/30 text-slate-900/50`.

**Tab container:** `glass-subtle p-1`, overflow-x auto for narrow screens. Desktop: `w-fit`; mobile: `w-full`.

**When hub filter is active:** All five tabs hidden. `page.tsx:254`: `{!hubFilter && (...)}`.

**Note:** Tab counts (`countTransactionsByStatus`) are for the full agent visibility scope regardless of any hub filter. Since tabs are hidden when a hub filter is active, this inconsistency is never exposed to the user.

---

## 3. The file list

### Data source

`listTransactions(agencyId, agentId, opts)` at `lib/services/transactions.ts:7–99`.

**Query:** `prisma.propertyTransaction.findMany({ where: whereClause, orderBy: { createdAt: "desc" }, include: { ... } })` (`transactions.ts:24–54`).

**No pagination.** `findMany` has no `take`, `skip`, or cursor argument. All transactions matching the WHERE clause are returned in one query.

**Server-side order:** `createdAt: "desc"` — newest-created files first. This order is immediately discarded by client-side sorting in `TransactionTable`.

### Includes

Each transaction row includes: `assignedUser`, `agentUser` (with role), `contacts` (id/name/roleType), last completed `milestoneCompletion`, pending `chaseTasks` (up to 5, ordered by dueDate ASC), counts, and computed health data.

### Health data computation

Computed in `listTransactions` at `transactions.ts:56–98`. Health is a derived object containing:
- `pendingOverdueTasks` — chase tasks with `dueDate < now`
- `escalatedTasks` — overdue tasks with `priority = "escalated"`
- `lastActivityAt` — from `tx.lastActivityAt` (DB field)
- `nextActionLabel` — name of first pending chase task's reminder rule, or `null` if none
- `daysStuckOnMilestone` — days since last milestone completion
- `onTrack` — computed from `completedCount` vs `expectedPercent` (time-based heuristic)

### Client-side filtering

After server load, `page.tsx:76–83` applies either hub-filter or status-filter client-side:
- Hub filter: `filteredTransactions = allTransactions.filter((tx) => idSet.has(tx.id))`
- Status filter: `filteredTransactions = allTransactions.filter((tx) => tx.status === statusFilter)`

Both operate on the already-fetched `allTransactions` array. No additional DB call.

### Client-side sort (TransactionTable)

`TransactionTable` re-sorts on render. Default state: `sortKey = "exchange"`, `sortDir = "asc"` (`TransactionTable.tsx:176–177`).

**Exchange sort logic** (`TransactionTable.tsx:125–131`):
```ts
const da = a.expectedExchangeDate ? new Date(a.expectedExchangeDate).getTime() : null;
const db = b.expectedExchangeDate ? new Date(b.expectedExchangeDate).getTime() : null;
if (da === null && db === null) return a.propertyAddress.localeCompare(b.propertyAddress);
if (da === null) return 1;   // null → bottom
if (db === null) return -1;  // null → bottom
return applySortDir(da - db, dir);
```

Files without an exchange date sort to the **bottom** in both ASC and DESC. Between two null-exchange files, they sort alphabetically by address. Direction toggle on the exchange column does not move null-date files off the bottom.

### Sortable columns

`TransactionTable.tsx:203–212`:

| Column | SortKey | Notes |
|---|---|---|
| Property | `property` | Address, `localeCompare` |
| Assigned To | — | **Not sortable** |
| Exchange Target | `exchange` | Nulls always bottom |
| Status | `status` | Fixed `STATUS_ORDER` array order |
| Risk | `risk` | `riskScore()` DESC (highest risk first for `asc` direction) |
| Last active | `lastActive` | `lastActivityAt` ASC = stalest first |
| Owner | — | **Not sortable** |

**Risk sort note:** `TransactionTable.tsx:141`: `applySortDir(riskScore(b) - riskScore(a), dir)` — highest risk first when `dir = "asc"`. Counter-intuitive direction label.

---

## 4. Search and filtering controls (TransactionListWithSearch)

Source: `components/transactions/TransactionListWithSearch.tsx`. Client component.

### Search input

**Placeholder:** `"Search by address…"` (with ellipsis) (`TransactionListWithSearch.tsx:307`).

**Match field:** `propertyAddress` only (`TransactionListWithSearch.tsx:284`):
```ts
if (q) result = result.filter((t) => t.propertyAddress.toLowerCase().includes(q));
```
Contact names, negotiator names, milestone names, and all other fields are not searched.

**Behaviour:** Instant on every keystroke (`onChange`). No debounce. `× ` clear button appears when query is non-empty (`TransactionListWithSearch.tsx:309–316`).

### Owner chip (AssignedToChip)

**Label:** "Owner" when inactive; "Owner: [first name]" when active (`TransactionListWithSearch.tsx:53`).

**Condition:** `showUserFilter = uniqueUsers.length > 1` (`TransactionListWithSearch.tsx:227`).

**uniqueUsers** is built from `t.agentUser` (the agency owner of the file), not `t.assignedUser` (the negotiator). Duplicate IDs are de-duped. Result sorted alphabetically by name (`TransactionListWithSearch.tsx:215–225`).

**Owner column visibility:** `showOwner = isDirector && selectedUserId === null` (`TransactionListWithSearch.tsx:362`). Owner column hides when the Owner chip has a selection active (because the filter already narrows to one agent — showing the column would be redundant).

### Risk chip (RiskChip)

**Condition:** Always rendered. `TransactionListWithSearch.tsx:289`:
```ts
const showChipRow = showUserFilter || showManagedByFilter || true; // Risk chip always shown
```
The `|| true` forces `showChipRow` true unconditionally.

**Risk options in dropdown** (`TransactionListWithSearch.tsx:89`):
```ts
const RISK_LABEL: Record<RiskLevel, string> = { low: "On track", medium: "Watch", high: "At risk" };
```
Dropdown items display as "On track risk", "Watch risk", "At risk risk" (`TransactionListWithSearch.tsx:132`: `{RISK_LABEL[level]} risk`).

**Chip label when active:** `"Risk: On track"`, `"Risk: Watch, At risk"` etc. (comma-joined).

**Important:** The risk labels visible to users are **"On track", "Watch", "At risk"** — NOT "Low", "Medium", "High". The draft article incorrectly stated the options as "Low, Medium, High."

### ManagedBy chip (ManagedByChip)

**Condition:** `TransactionListWithSearch.tsx:229–234`:
```ts
const showManagedByFilter = useMemo(
  () =>
    transactions.some((t) => t.serviceType === "self_managed") &&
    transactions.some((t) => t.serviceType === "outsourced"),
  [transactions]
);
```
Both service types must be present in the visible transaction list.

**Labels:** "All" / "Self-progressed" / "With progressor" (`TransactionListWithSearch.tsx:152–154`).

**Clear behaviour:** × button on active chip resets to `"all"` without closing dropdown. "Clear all" text link clears all chip filters and the search query simultaneously.

### Client-side filtered empty state

`TransactionListWithSearch.tsx:345–360`:
- Search query present: `No files match "${query}"` (verbatim, quotes included)
- Other filter active: `No files match the active filters.`
- Below both: **Clear filters** link (only shown when `anyFilterActive`, line 352)

`anyFilterActive = selectedUserId !== null || selectedRiskLevels.size > 0 || managedByFilter !== "all"` (line 245–246). Search query alone does not set `anyFilterActive` — so a search-only zero result shows the message but no Clear filters button.

---

## 5. The hub-filter pill

Rendered at `page.tsx:164–205`. Only when `hubFilter !== null`.

**FILTER_LABELS** (`page.tsx:27–31`):
```ts
const FILTER_LABELS: Record<HubFilter, string> = {
  "exchanging-this-week": "Exchanging this week",
  "completing-this-week": "Completing this week",
  "closing-this-month":   "Closing this month",
};
```

**Pill copy** (`page.tsx:176–183`):
```
Showing [lowercased label] ([count])
```
Label is bold (`fontWeight: 600`, `color: var(--agent-text-primary)`). Count is muted. Example: "Showing **exchanging this week** (3)".

**Pill appearance:** `background: rgba(var(--agent-coral-base-rgb), 0.07)`, `border: 0.5px solid rgba(var(--agent-coral-base-rgb), 0.18)`, `borderRadius: 10`. Coral-tinted.

**Clear filter link:** `page.tsx:185–203`. Lucide `X` icon, size 11. Label: "Clear filter". Background: `rgba(255,255,255,0.55)`. Links to `/agent/transactions` (no params).

---

## 6. Anatomy of a single file row

Source: `components/transactions/TransactionTable.tsx`. Two render modes: desktop grid, mobile card (same data, different layout).

### Desktop grid columns (in order, `TransactionTable.tsx:190–196`)

```
4px | minmax(0,1fr) | 160px | 160px | 110px | 120px | 100px [| 130px if showOwner]
```

| Element | Detail |
|---|---|
| **Risk stripe** | 4px solid left stripe. Colours (`TransactionTable.tsx:249`): `bg-red-500` (high), `bg-amber-400` (medium), `bg-emerald-500` (low or no health data) |
| **Property** | `splitAddress()` splits on commas: last two parts = location; everything before = line (`TransactionTable.tsx:38–44`). Line is bold 14px, truncated. Location is muted 12px below. Below that: `VendorBuyerLine`. Below that (desktop only): `→ {health.nextActionLabel}` in orange-600 13px bold, if a pending chase task exists (`TransactionTable.tsx:352–356`) |
| **VendorBuyerLine** | `"Vendor: J.D. · Buyer: S.M."` — `firstNameLastInitial()` strips to first name + last initial with dot (`TransactionTable.tsx:46–50`). Fallback: "not set" in muted. If neither contact exists: "Names not set" in orange/40 (`TransactionTable.tsx:93`) |
| **Assigned to** | Three-state fallback (`TransactionTable.tsx:360–376`): (1) `assignedUser.name` with blue avatar initials; (2) if outsourced and no assignedUser: "Awaiting assignment" in orange; (3) else `agentUser.name` in muted, or "Unassigned" italic |
| **Service type tag** | Small pill inside Assigned To cell: "With progressor" (indigo-50/70) or "Self-progressed" (slate-100/60). Only if `tx.serviceType` is non-null |
| **Exchange target** | `ExchangeTargetCell` component from `components/transactions/ExchangeTargetCell.tsx` — not read in this pass |
| **Status** | `StatusBadge` component (`components/ui/StatusBadge.tsx`) |
| **Risk** | `RiskBadgeWithPopover` if `tx.health` exists; dash (`—`) if no health |
| **Last active** | Computed by `fmtLastActive()` (`TransactionTable.tsx:66–87`) — see §6a |
| **Owner** | Director-only (when `showOwner = true`). `tx.agentUser.name` + `ROLE_LABEL[role]` below. Dash if `tx.agentUser` is null (`TransactionTable.tsx:418–433`) |

### §6a — Last active tones and Stale badge

`fmtLastActive()` at `TransactionTable.tsx:66–87`:

| Condition | Primary text | Tone | Stale badge |
|---|---|---|---|
| `date === null` | "Just added" | `"muted"` | No |
| `days === 0` | "Today, HH:MM" | `"normal"` | No |
| `days === 1` | "Yesterday" | `"normal"` | No |
| `days < 7` | "N days ago" | `"normal"` | No |
| `days < 14` (7–13) | "N days ago" | `"amber"` | No |
| `days < 30` (14–29) | "N days ago" | `"red"` | No |
| `days >= 30` | "N days ago" | `"red"` | **Yes** |

Secondary text: exact date in `dd Mon` format, shown below primary. No secondary for today/yesterday.

Stale badge text (verbatim, `TransactionTable.tsx:300–304`): `Stale` — 9px, font-semibold, `bg-red-50 text-red-500 border border-red-100`.

---

## 7. Empty states (verbatim)

### 7a — No transactions at all (`allTransactions.length === 0`)

Source: `page.tsx:207–250`.

**Container:** `glass-card`, `padding: "48px 24px"`, `textAlign: "center"`.

**Icon:** `HouseLine` (Phosphor, `weight="regular"`, 32×32, `color: var(--agent-text-muted)`, `opacity: 0.45`, `margin: "0 auto 16px"`, `display: "block"`).

**Heading (verbatim):**
> Create your first sale

Font size 15, weight 600, colour `var(--agent-text-primary)`, margin `"0 0 6px"`.

**Body (verbatim):**
> Once you submit a sale, you'll see it here. Track milestones, manage chases, and progress to exchange.

Font size 13, colour `var(--agent-text-muted)`, maxWidth 340, lineHeight 1.5, margin `"0 auto 24px"`.

**Action:** `+ New sale` button (coral primary) → `/agent/transactions/new`.

---

### 7b — Status tab empty (files exist, none in this status)

Source: `page.tsx:312–325`.

**Title (dynamic):** `No ${statusFilter.replace("_", " ")} files`  
Examples: "No on hold files", "No completed files", "No withdrawn files", "No all files" (for `all` tab when zero across all statuses — edge case).

**Description (verbatim):** `Try a different filter.`

**Action:** "View all" link → `/agent/transactions`.

**Container:** `glass-card`.

---

### 7c — Hub filter empty

Source: `page.tsx:33–49` (FILTER_EMPTY constant) and `page.tsx:299–312`.

**exchanging-this-week:**
- Title: `No files exchanging this week`
- Description: `Files appear here when their expected exchange date is within the next 7 days.`

**completing-this-week:**
- Title: `No files completing this week`
- Description: `Files appear here when their completion date is within the next 7 days.`

**closing-this-month:**
- Title: `No files closing this month`
- Description: `Files appear here when their expected exchange date falls within the current calendar month.`

All three: Action = "View all files" link → `/agent/transactions`. Container: `EmptyState` component inside `glass-card`.

---

### 7d — Client-side filter / search empty

Source: `TransactionListWithSearch.tsx:345–360`.

**Container:** `glass-card px-5 py-8 text-center`.

**Message when search query present:**
> No files match "{query}"

(Curly/straight quotes as rendered by the browser — actual character in source is `"` on both sides.)

**Message when other filter active (no query):**
> No files match the active filters.

**Action (only when `anyFilterActive = true`):** "Clear filters" link-button (`agent-link-primary` style). Note: text-search alone does NOT set `anyFilterActive` — so a search-only zero-result state shows the message but no Clear filters button.

---

## 8. Director vs negotiator differences

### Visibility scoping

`page.tsx:59–61`:
```ts
const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
const opts = vis.seeAll ? { allAgentFiles: true, firmName: vis.firmName } : undefined;
const agentId = vis.seeAll ? undefined : session.user.id;
```

When `vis.seeAll = true`: `listTransactions(agencyId, undefined, { allAgentFiles: true })` → WHERE clause `{ agencyId, agentUserId: { not: null } }` — all agency files with an agent assigned (`transactions.ts:15–17`).

When `vis.seeAll = false`: `listTransactions(agencyId, session.user.id, undefined)` → WHERE clause `{ agencyId, agentUserId: session.user.id }` — only files belonging to this negotiator (`transactions.ts:19–20`).

**canViewAllFiles negotiators:** `resolveAgentVisibility` sets `seeAll = true` for negotiators with this flag. They see all agency files. However, `isDirector = session.user.role === "director"` (`page.tsx:62`) — so a `canViewAllFiles` negotiator sees all files but the page heading is still **"My Files"** and the Owner column is still hidden. The draft article's claim that "the heading still says 'My Files'" is **confirmed correct** for this case.

### UI differences by role

| Element | Director | Negotiator (no canViewAllFiles) | Negotiator (canViewAllFiles) |
|---|---|---|---|
| Page H1 | "All Files" | "My Files" | "My Files" |
| Files visible | All agency files | Own files only | All agency files |
| Owner column | Shown (when no Owner chip selection active) | Hidden | Hidden |
| Owner chip | Shown if multiple agents in view | Not shown (single-agent view) | Shown if multiple agents in view |
| ManagedBy chip | Shown if mix present | Only if negotiator can see mixed types | Shown if mix present |

---

## 9. Live component extraction assessment

| Element | Extractable? | Notes |
|---|---|---|
| Status tabs | **Easy** | Pure JSX + Link components; counts can be hardcoded |
| Hub filter pill | **Easy** | Static coral pill; label + count hardcoded |
| TransactionTable (whole list) | **Hard** | Requires realistic TransactionRow[] data; sort state; conditional columns |
| Single transaction row | **Medium** | Mock data + disable link navigation; `splitAddress`, `fmtLastActive`, VendorBuyerLine all pure functions — testable |
| Risk chip | **Medium** | Chip state + dropdown, but self-contained; no external deps |
| Empty states | **Easy** | Pure JSX; no props |

**Assessment:** No help-example component is needed for the All Files article. The page is a sortable data table — it cannot be usefully represented by a static example. A screenshot or illustration is more informative than a stub.

---

## 10. Worth flagging

1. **Risk chip labels are "On track / Watch / At risk" — not "Low / Medium / High."** The chip dropdown shows `{RISK_LABEL[level]} risk` — "On track risk", "Watch risk", "At risk risk". The draft article incorrectly stated "filter to Low, Medium, or High risk files." This must be corrected before the final article.

2. **Risk chip always rendered via `|| true` hack.** `TransactionListWithSearch.tsx:289`: `const showChipRow = showUserFilter || showManagedByFilter || true`. The comment confirms intent ("Risk chip always shown") but the mechanism is a deliberate short-circuit rather than a first-class flag. Harmless but unusual.

3. **No pagination — entire pipeline loads in one query.** `listTransactions` returns all matching rows with no `take`/`skip`. For agencies with 200+ active files this is a growing response payload and increasingly expensive client-side sort. No current mechanism to paginate. Worth flagging for the article to note that all files load at once (useful context for users) and for future engineering work.

4. **Search is address-only with no in-app indication.** Search placeholder is "Search by address…" — fairly clear — but the article should reinforce that contact names, negotiator names, and milestones are not searched, since users may expect a more global search.

5. **Two-phase sort: server `createdAt` DESC discarded immediately by client `exchange` ASC.** The server orders by newest-created. `TransactionTable` immediately re-sorts by exchange date ASC. The server ordering never surfaces to the user. Article should describe only the client-visible exchange sort. Do not describe the server order.

6. **Owner chip is based on `agentUser` not `assignedUser`.** `agentUser` is the agency staff member who "owns" the file (the negotiator listed as the file owner). `assignedUser` is the Sales Progressor internal staff member assigned to an outsourced file. A director filtering by Owner is filtering by agency owner, not by internal assignee. This distinction matters for outsourced files.

7. **`showOwner` hides Owner column when Owner chip is active.** `showOwner = isDirector && selectedUserId === null` — when the director has filtered to a specific agent via the Owner chip, the Owner column disappears (it would be redundant). The table reflows when the chip is cleared. This is intentional but not obvious to a user who might wonder where the column went.

8. **VendorBuyerLine shows `agentUser.name` fallback "not set" differently.** If a transaction has no contacts at all: "Names not set" in `rgba(180,87,9,0.40)`. If contacts exist but one role is missing: the missing side shows "not set" in `text-slate-900/25`. Two distinct visual treatments for a similar missing-data state.

9. **ManagedBy chip only appears for agencies with both service types.** An agency using only self-managed files will never see this chip. An agency onboarding to the outsourced tier will see it appear once their first outsourced file is created. Article should not mention this chip unless the article explicitly addresses mixed-service agencies.

10. **Hub filter count and pill count could diverge.** The pill count comes from `filteredTransactions.length` — filtered from `allTransactions` using IDs from `getHubFilteredIds`. If `listTransactions` visibility scoping excludes a transaction that `getHubFilteredIds` includes (e.g. a file assigned to a different agent that somehow passes the hub query), the counts diverge. Unlikely given both use `vis` for scoping — but not guaranteed by the code structure.

---

## 11. Hub filter cleanup verification

`getHubFilteredIds` at `lib/services/hub.ts:198–268`. Verified queries:

| Filter | Query conditions |
|---|---|
| `exchanging-this-week` | `status: "active"`, `expectedExchangeDate: { gte: now, lte: addDays(now, 7) }`, VM19/PM26 NOT in completions |
| `completing-this-week` | `status: "active"`, `completionDate: { gte: now, lte: addDays(now, 7) }`, VM20/PM27 NOT in completions |
| `closing-this-month` | `status: "active"`, `expectedExchangeDate: { gte: startOfMonth, lte: endOfMonth }`, VM19/PM26 NOT in completions |

These are the same queries used to compute the Hub pipeline strip counts (confirmed: `getHubFilteredIds` is called from both `hub.ts` pipeline aggregation and `app/agent/transactions/page.tsx:78`). The design intent that "Hub strip count = All Files pill count" is structurally enforced, with the caveat noted in §10 item 10.

**Hub filter approach confirmed correct:** The page fetches all transactions once, then cross-filters by ID set. No duplication of query logic in the page itself. IDs come from the canonical hub function.

---

## 12. Pre-existing assumptions verified against code

| Claim | Verdict | Source |
|---|---|---|
| "There is no pagination. All files load at once." | ✓ Confirmed | `transactions.ts:24` — `findMany` with no `take`/`skip` |
| "The page heading changes to My Files for negotiators." | ✓ Confirmed | `page.tsx:144` — `{isDirector ? "All Files" : "My Files"}` |
| "Files load sorted by Exchange Target, earliest first." | ⚠ Needs clarification | Server sorts `createdAt DESC`; client re-sorts `exchange ASC`. Article should say "displayed sorted by Exchange Target" not "load sorted." |
| "Files without exchange date sort to bottom." | ✓ Confirmed | `TransactionTable.tsx:129` — `if (da === null) return 1` |
| "Empty state copy quoted verbatim." | ✓ Confirmed | All four empty states verified against source code |
| "Owner chip appears only when visible list contains files assigned to more than one agent." | ✓ Confirmed | `TransactionListWithSearch.tsx:227` — `uniqueUsers.length > 1`; based on `agentUser` not `assignedUser` |
| "Risk chip filters to Low / Medium / High." | ✗ **WRONG in draft** | Actual labels: "On track", "Watch", "At risk" (`TransactionListWithSearch.tsx:89`) |
| "The Risk chip is always visible." | ✓ Confirmed | `TransactionListWithSearch.tsx:289` — `|| true` |
| "ManagedBy chip only when both service types present." | ✓ Confirmed | `TransactionListWithSearch.tsx:229–234` |
| "canViewAllFiles negotiators see 'My Files' heading." | ✓ Confirmed | `isDirector` is role-based only; canViewAllFiles changes scope not heading |

---

## Reporting

```
Discovery for: All Files
Report file: docs/help/_discovery/all-files.md
Word count: ~2,800
Code references: 50+
Worth-flagging items: 10

Sections covered:
  1. Page structure top-to-bottom
  2. Status tabs (exact labels, counts, URL patterns, when hidden)
  3. File list (data source, server order, client re-sort, no pagination confirmed)
  4. Search and filtering controls (search scope, all chip conditions, empty states)
  5. Hub-filter pill (exact copy, FILTER_LABELS, clear link)
  6. Anatomy of a single file row (all columns, last-active thresholds, Stale badge)
  7. Empty states — all six, verbatim
  8. Director vs negotiator differences (heading, visibility, columns, chips)
  9. Component extraction assessment
  10. Worth flagging — 10 items
  11. Hub filter cleanup verification
  12. Pre-existing assumptions verified

Claims in draft article verified against code:
  - "No pagination" — confirmed (transactions.ts:24, no take/skip)
  - "My Files for negotiators" — confirmed (page.tsx:144)
  - "Files load sorted by Exchange Target" — NEEDS CORRECTION: server sort is createdAt DESC; client re-sorts exchange ASC — article should say "displayed sorted"
  - "Files without exchange date sort to bottom" — confirmed (TransactionTable.tsx:129)
  - Empty state copy — all four confirmed verbatim
  - "Owner chip when multiple agents" — confirmed (TransactionListWithSearch.tsx:227)
  - "Risk chip shows Low/Medium/High" — WRONG IN DRAFT: actual labels are "On track", "Watch", "At risk"
  - "Risk chip always visible" — confirmed (TransactionListWithSearch.tsx:289, || true)
  - "ManagedBy chip condition" — confirmed (TransactionListWithSearch.tsx:229–234)
  - "canViewAllFiles shows My Files" — confirmed (role-based heading, not permission-based)

Awaiting article spec before writing the final article.
The draft (all-files-DRAFT.mdx) stays in docs/help/_discovery/ untouched.
```
