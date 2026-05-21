# Inventory: Work Queue

**Route:** `/agent/work-queue`
**Stage 1 status:** Draft — awaiting Ellis review
**Amendments:** See §14

> **No polish page exists yet.** Unlike transaction-detail and hub, there is no `app/agent/polish/work-queue/` reference file. Stage 2 builds the polish page from scratch, using this inventory as the structural contract and transaction-detail Stage 4 as the quality bar. §13 below describes the target structure that Stage 2 will implement.

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/work-queue` |
| File | `app/agent/work-queue/page.tsx` |
| Component type | Mixed — server component page; `AgentRemindersList`, `FileAlertsStrip`, `ReminderCard` are all client components |
| Who sees it | Director, Negotiator |
| How they reach it | Sidebar nav ("Reminders" link); hub Attention card "All reminders" link; StatPill scroll-anchors from the PageHeader |
| Reachable without a transaction? | Yes — shows the zero-files empty state. StatPill bar only renders when at least one stat is non-zero. |

---

## 2. Components rendered

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `PageHeader` | `components/layout/PageHeader.tsx` | No changes — already matches | Updated globally in hub Stage 4: `--agent-text-h2` / fontWeight 600 / `--agent-text-muted` subtitle. Verify subtitle voice passes Stage 3. |
| `StatPill` | `components/layout/StatPill.tsx` | Match polish page | Inline `<a>` tag with CSS token styles. No hover state. Stage 4 adds hover (background lighten). Three colour keys: `danger`, `warning`, `muted`. |
| `FileAlertsStrip` | `components/reminders/FileAlertsStrip.tsx` | Match polish page | Conditionally rendered when file-level alerts exist. New pattern — no transaction-detail equivalent. Several class gaps. |
| `AgentRemindersList` | `components/reminders/AgentRemindersList.tsx` | Match polish page | Main content client component. Contains all urgency-group logic, filter bar, and split-file cards. Major class audit required. See sub-components below. |
| ↳ `FilterChip` | (inline in AgentRemindersList.tsx:57) | Match polish page | Bespoke Tailwind component. Work-queue-only — no transaction-detail counterpart. Convert to `agent-segment-pill`. |
| ↳ `SideSnoozeMenu` | (inline in AgentRemindersList.tsx:86) | Match polish page | "Snooze all" per group. **Visually inherits from `RemindersSection.SideSnoozeMenu` (`components/reminders/RemindersSection.tsx:117`); separately implemented because the prop API differs — RemindersSection passes both `logIds` and `taskIds` to its handler, AgentRemindersList passes only `taskIds`. Drift risk acknowledged — see `docs/active/TODO.md` "RemindersSection / AgentRemindersList drift audit".** Already has `agent-btn agent-btn-sm agent-btn-ghost` on trigger; dropdown items use `hover:bg-slate-50` Tailwind — convert to `agent-dropdown-item`. |
| ↳ `RowSnoozeMenu` | (inline in AgentRemindersList.tsx:143) | Match polish page | Per-row snooze. **Visually inherits from `RemindersSection.RowSnoozeMenu` (`components/reminders/RemindersSection.tsx:87`); separately implemented because RemindersSection's prop signature includes `logId` for its action handler while AgentRemindersList's does not. Drift risk acknowledged.** Trigger uses inline styles (not `agent-btn`). Dropdown container has `agent-dropdown-in` ✓. Items use `hover:bg-slate-50` — convert to `agent-dropdown-item`. |
| ↳ `SplitFileCard` | (inline in AgentRemindersList.tsx:409) | Match polish page | File card container. **NEW PATTERN** — work queue aggregates reminders across transactions grouped by file, so the card carries address identity at the top; transaction-detail's RemindersSection lives inside a single transaction page and has no equivalent address-bar layer. Functionally distinct, so no parallel implementation to consolidate. `glass-card` → `agent-glass-strong`. Address header inline styles → canonical (see §13). |
| ↳ `SideColumn` | (inline in AgentRemindersList.tsx:199) | Match polish page | Seller/Buyer column inside SplitFileCard. **Visually inherits from `RemindersSection.ColumnSection` (`components/reminders/RemindersSection.tsx:162`); separately implemented because the parent (SplitFileCard) wraps it differently and the loading-state surface (cross-transaction vs single-transaction) differs. Drift risk acknowledged.** Chase button inline-styled (solid fill) → `agent-btn agent-btn-sm agent-btn-primary`. `agent-row-exit` already wired ✓. |
| ↳ `EmptyColumn` | (inline in AgentRemindersList.tsx:375) | No changes | Colour-coded placeholder shown when one side has no reminders. **Visually inherits from `RemindersSection.EmptyColumn` (`components/reminders/RemindersSection.tsx:147`); separately implemented (file-local). Drift risk acknowledged.** Agent token-adjacent already. |
| `ReminderCard` | `components/reminders/ReminderCard.tsx` | Reuse from transaction-detail | Used only in snoozed view (`statusFilter === "snoozed"`). Action buttons use `reminder-action-btn / reminder-confirm-btn / reminder-snooze-btn` — defined in `globals.css:630–661`, not bespoke Tailwind. Exit animation uses custom `max-height / opacity` transition rather than `agent-row-exit` — note as gap. |
| `ChaseDrawer` | `components/chase/ChaseDrawer.tsx` | Out of scope | Canonical implementation. Already verified in transaction-detail Stage 4. Not modified in this pass. |
| `loading.tsx` | `app/agent/work-queue/loading.tsx` | Match polish page | Skeleton mimics urgency group structure (group header chip + card rows). Structural alignment with final layout needed after Stage 2 finalises group structure. |

**Depth note:** `GROUP_CONFIG` is duplicated verbatim between `AgentRemindersList.tsx:16–21` and `RemindersSection.tsx:47–52`. This is a code smell — file in `docs/active/TODO.md` — do not fix in this pass.

Similarly, `addBusinessDays` and `isSunday` helper functions are duplicated across `page.tsx`, `AgentRemindersList.tsx`, and `RemindersSection.tsx`. File in `docs/active/TODO.md` — do not fix.

---

## 3. Data dependencies

| Data | Source | Shape | Notes |
|---|---|---|---|
| `session` | `requireSession()` | `{ id, agencyId, role, name }` | Redirect to login if missing |
| `vis` | `resolveAgentVisibility(userId, agencyId)` | visibility scope object | Scopes all three queries below |
| `items` | `getWorkQueueItems(vis)` | `WorkQueueItem[]` — files with active alerts (missing solicitor, overdue exchange, stale) | Empty array = FileAlertsStrip not rendered |
| `reminderLogs` | `getAgentReminderLogs(vis)` | `AgentReminderLog[]` — all reminder logs for this agency with chase tasks, contacts, transaction data | Empty = empty state (combined with `activeFileCount`) |
| `activeFileCount` | `prisma.propertyTransaction.count({ where: { ...txWhereWorkQueue(vis), status: { in: ["active", "on_hold"] } } })` | number | Used to distinguish "no files yet" from "no reminders due" — only referenced in the zero-files empty state condition |
| Derived: `statSegments` | Computed from `reminderLogs` in server component | `{ label, anchor, colorKey }[]` | Only segments with count > 0 are included. Maps to StatPill props. |

**Null / missing data:**
- `reminderLogs.length === 0 && activeFileCount === 0` → zero-files empty state (Bell icon + ghost preview). New agency, no sales added yet.
- `reminderLogs.length === 0 && activeFileCount > 0` → "All caught up" empty state via `AgentRemindersList` (logs.length === 0 branch).
- `items.length === 0` → `FileAlertsStrip` not rendered (conditional in page.tsx:73).
- `statSegments` empty → no StatPills rendered in PageHeader (header renders without pills).

---

## 4. States

### Standard states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Loading** | Server fetch in progress | `loading.tsx` skeleton: PageHeader shape + three urgency group skeletons (Escalated 2 rows, Overdue 3 rows, Due today 2 rows). Agent-skeleton pulse on all placeholder shapes. |
| **Zero files** | `reminderLogs.length === 0 && activeFileCount === 0` | Bell icon (32px, muted), two lines of copy (voice violation — see §7), below: ghost urgency group preview at 0.3 opacity, pointer-events none. |
| **All caught up** | `reminderLogs.length === 0 && activeFileCount > 0` (handled inside AgentRemindersList) | CheckCircle icon (agent-success), "All caught up" heading, muted copy. |
| **Normal (active)** | `reminderLogs.length > 0` | PageHeader + StatPills + optional FileAlertsStrip + filter bar + urgency groups. |
| **Filtered empty** | Active filter applied, no matching reminders | `glass-card` with single-line muted message (varies by filter type). |
| **Snoozed view** | `statusFilter === "snoozed"` | Filter bar unchanged; urgency groups replaced by flat `ReminderCard` list in snoozed mode. |
| **Error** | Server throws / Prisma connection fails | `error.tsx` boundary — not styled for this pass. |

### Page-specific states

| State | Trigger | What the user sees |
|---|---|---|
| **Escalated reminders present** | Any `reminderLog` with task `priority === "escalated"` | Escalated urgency group appears first, red header colour, red left border on cards. StatPill "N overdue" (escalated are counted as overdue in stat calculation). |
| **Filter bar mounted (engine run)** | `AgentRemindersList` mounts | `runReminderEngineAction` fires silently on mount (useEffect, line 499) then refreshes. No visible loading state for engine run — it's a background operation. |
| **Urgency group collapsed** | `collapsed[groupKey] === true` | Group header visible; file cards hidden (currently no animation — see §10.5 gap). Default state: all groups expanded (`collapsed` initialised to all `true` — wait, actually: `useState<Record<string, boolean>>({ escalated: true, overdue: true, due_today: true, upcoming: true })` — all start collapsed). |
| **Search / filter active** | `search !== ""` or `sideFilter !== "all"` | File cards filtered; non-matching cards hidden. No filter indicator or clear button. |
| **Optimistic snooze count** | After snoozing a reminder | Snoozed count in "Snoozed (N)" pill increments immediately via `optimisticSnoozeAdd` before server revalidation. |

**Note on default collapsed state:** All urgency groups start collapsed (`collapsed` initialised to all `true` at line 494). On first load, users see group headers but no cards. They must click "Show" to expand each group. This is a UX decision to validate with Ellis during Stage 2 — it may be intentional (avoids overwhelming the page) or a bug. Flag for Stage 2 review.

---

## 5. Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| StatPill (N overdue) | PageHeader | Anchor scroll to `#section-overdue` on page | Never disabled | — |
| StatPill (N due today) | PageHeader | Anchor scroll to `#section-due_today` | Never disabled | — |
| StatPill (N coming up) | PageHeader | Anchor scroll to `#section-upcoming` | Never disabled | — |
| FileAlertsStrip "Show ↓" / "Hide ↑" | FileAlertsStrip header | Toggles collapsed state | Never | — |
| Alert row (address link) | FileAlertsStrip expanded body | Navigate to `/agent/transactions/[id]` | Never | — |
| Alert row action ("Add vendor solicitor →" etc.) | FileAlertsStrip row | Navigate to transaction with `?focus=` param | Never | — |
| Search input | Filter bar | Filters file cards by address or reminder name | Never | — |
| Side filter pills (All / Seller / Buyer) | Filter bar | Sets `sideFilter` state | Never | — |
| Status filter pills (Active / Snoozed) | Filter bar | Sets `statusFilter` state | Never | — |
| Urgency group Show / Hide | Group header (right) | Toggles `collapsed[groupKey]` | Never | — |
| Address link in SplitFileCard | Card address header | Navigate to `/agent/transactions/[id]` | Never | — |
| RowSnoozeMenu trigger (🕐 icon) | SideColumn row (per reminder) | Opens snooze dropdown | Never | — |
| Snooze option (24h / 48h / 72h / 7 days) | RowSnoozeMenu dropdown | Calls `handleSnooze(taskId, hours)` — hides reminder row + fires `snoozeTaskAction` | `loadingHours !== null` | Not implemented in RowSnoozeMenu (no disabled state on individual options) |
| "✓ Done" button | SideColumn row | Calls `handleComplete(taskId)` — hides row + fires `completeTaskAction` | `loading === task.id` | No visual disabled state implemented (just `disabled={loading===task.id}`) |
| Chase button ("Chase" / "Chase all (N)") | SideColumn footer | Opens `ChaseDrawer` | Never | — |
| SideSnoozeMenu trigger ("Snooze all") | SideColumn footer | Opens snooze-all dropdown | `disabled={loading !== null}` | Native `disabled` attr — opacity 0.4 via agent-btn-ghost |
| Snooze-all option | SideSnoozeMenu | Calls `handleSnooze(taskId, hours)` for all task IDs | `loading !== null` on parent | — |
| ReminderCard "Wake now" (snoozed mode header) | ReminderCard snoozed banner | `wakeupReminderAction` | `isLoading === log.id \|\| isPending` | Opacity 0.40 |

> **Stage 1 inventory error — corrected 2026-05-12 (Phase A finding):** earlier rows for ReminderCard "Confirm" / "Snooze" / "Chase" / "⋯" overflow / "Show details" labelled (snoozed view) actually describe active-mode (`mode="active"`) behaviour. Work queue renders `ReminderCard` only with `mode="snoozed"` (`AgentRemindersList.tsx:790`), which has just the banner + body + "Wake now" — no action row. Those entries belong on transaction-detail's surface, not work queue. Removed from this table.

---

## 6. Conditional renders

```
{items.length > 0 && <FileAlertsStrip items={items} />}
// Shows: when any file has active alerts (missing solicitor, overdue exchange, stale)
// Hides: no file alerts

{reminderLogs.length === 0 && activeFileCount === 0 ? (
  <>
    <div className="glass-card"> {/* zero-files empty state */} </div>
    <div style={{ opacity: 0.3, pointerEvents: "none" }}> {/* ghost groups */} </div>
  </>
) : (
  <AgentRemindersList logs={reminderLogs} />
)}
// Zero-files shows: new agency, no transactions created yet
// AgentRemindersList shows: any other state (active reminders OR all caught up)

{/* Inside AgentRemindersList: */}
{logs.length === 0 && (
  <div className="glass-card"> {/* "All caught up" */} </div>
)}
// Shows: has transactions but no reminders currently due

{statusFilter === "active" && !hasActiveResults && (
  <div className="glass-card"> {/* filtered empty state */} </div>
)}
// Shows: filter applied, no reminders match

{statusFilter === "active" && (["escalated","overdue","due_today","upcoming"]).map(groupKey => {
  if (grouped[groupKey].length === 0) return null;
  // ... urgency group
})}
// Each group: shows only when it has at least one matching reminder

{!isCollapsed && (
  <div className="space-y-2">
    {fileGroups.map(SplitFileCard)}
  </div>
)}
// Shows: urgency group is not collapsed (default: all collapsed)

{statusFilter === "snoozed" && (
  // snoozed view with ReminderCard components
)}
// Shows: user clicked "Snoozed" pill

{openTasks.length > 0 && (
  <div> {/* SideColumn footer: Chase + Snooze buttons */} </div>
)}
// Shows: column has at least one pending chase task

{sellerLogs.length > 0 ? <SideColumn ... /> : <EmptyColumn side="seller" />}
{buyerLogs.length > 0 ? <SideColumn ... /> : <EmptyColumn side="buyer" />}
// Both columns always render; either as SideColumn (has reminders) or EmptyColumn (placeholder)

{drawerOpen && <ChaseDrawer ... />}
// Shows: user clicked Chase button in SideColumn footer
```

---

## 7. Copy inventory

**Verbatim rule:** Every string exactly as it renders, including dynamic variants. Flagged with `← FLAG for voice pass`.

```
# PageHeader
"Reminders"                             [page title]
"What needs chasing, today and ahead."  [subtitle]

# StatPill (dynamic)
"{N} overdue"                           [StatPill — escalated + overdue count combined]
"{N} due today"                         [StatPill]
"{N} coming up"                         [StatPill — due within 3 business days]

# FileAlertsStrip header
"{N} file alert"                        [singular]
"{N} file alerts"                       [plural]
"{N} overdue exchange"                  [count badge]
"{N} missing solicitor"                 [count badge]
"{N} stale"                             [count badge]
"Show ↓"                                [toggle]
"Hide ↑"                                [toggle]

# FileAlertsStrip alert rows (dynamic)
"{propertyAddress}"                     [address link]
"{agentUser.name}"                      [assigned negotiator, optional]
"Add vendor solicitor →"                [action link]
"Add purchaser solicitor →"             [action link]
"Add solicitors →"                      [action link — both missing]
"Update exchange date →"                [action link]
"Overdue exchange"                      [alert badge]
"Missing solicitor"                     [alert badge]
"Stale"                                 [alert badge]

# Zero-files empty state (page.tsx:78–83)
"Your reminders will appear here"       [heading]
"Once you create a sale, we'll surface chases and follow-ups as files progress."
                                        [body copy] ← FLAG for voice pass — Rule 1 (system self-reference)

# Ghost group preview (zero-files state)
"Overdue"                               [ghost group label]
"Due today"                             [ghost group label]
"14 Maple Close, Birmingham"            [ghost address — hardcoded mock]
"Mortgage offer — chaser due"           [ghost reminder — hardcoded mock]
"3 days overdue"                        [ghost urgency tag]
"8 The Crescent, Bristol"              [ghost address]
"Search results — follow-up"            [ghost reminder]
"1 day overdue"                         [ghost tag]
"22 Victoria Road, Manchester"          [ghost address]
"Contract pack — review"               [ghost reminder]
"Due today"                             [ghost tag]

# "All caught up" empty state (AgentRemindersList.tsx:597–603)
"All caught up"                         [heading]
"No reminders due right now. We'll surface them here as files progress."
                                        [body copy] ← FLAG for voice pass — Rule 1 (system self-reference)

# Filter bar
"Search address or reminder…"          [search placeholder]
"All"                                   [side filter chip]
"Seller"                                [side filter chip]
"Buyer"                                 [side filter chip]
"Active"                                [status filter chip]
"Snoozed"                               [status filter chip — no count]
"Snoozed ({N})"                         [status filter chip — with snoozed count]

# Filtered empty states (AgentRemindersList.tsx:651–663)
"No reminders for Seller right now."    [seller filter, no results]
"No reminders for Buyer right now."     [buyer filter, no results]
"No reminders match the current filter."
                                        [search with no results] ← FLAG for voice pass — Rule 3 (borderline passive)
"No active reminders."                  [all filters, no results]
"No snoozed reminders."                 [snoozed view, empty]
"No snoozed reminders matching filter." [snoozed view, filtered empty]

# Urgency group headers
"Escalated"                             [group label]
"Overdue"                               [group label]
"Due today"                             [group label]
"Coming up"                             [group label]
"{N}"                                   [count badge next to label]
"Show"                                  [collapse toggle — when collapsed]
"Hide"                                  [collapse toggle — when expanded]

# SplitFileCard address header
"{propertyAddress} →"                   [address link]
"{N} reminder"                          [count, singular]
"{N} reminders"                         [count, plural]

# SideColumn header
"Seller"                                [column label]
"Buyer"                                 [column label]
"{N} item"                              [row count, singular]
"{N} items"                             [row count, plural]

# SideColumn reminder rows
"{reminderName}"                        [milestone name, Chase: prefix stripped]
"Escalated"                             [urgency label — escalated task]
"{N}d overdue"                          [urgency label — overdue]
"Due today"                             [urgency label — due today]

# SideColumn action buttons
"✓ Done"                                [complete button]
"🕐"                                    [snooze trigger — row snooze]

# Snooze dropdown options (RowSnoozeMenu and SideSnoozeMenu)
"24 h"
"48 h"
"72 h"
"7 days"

# SideColumn footer
"Chase"                                 [chase button — single milestone]
"Chase all ({N})"                       [chase button — multiple]
"🕐 Snooze all"                         [snooze all trigger]

# EmptyColumn
"Seller is all up to date"              [italic placeholder]
"Buyer is all up to date"               [italic placeholder]

# ReminderCard — snoozed mode header
"Wakes {date}"                          [snooze-wake date]
"Wake now"                              [wake up action]
"…"                                     [loading state]

# ReminderCard — snoozed mode body
"{propertyAddress} →"                   [address link, when showAddressLink]
"{contactName}"                         [contact name, optional]
"{reminderName}"                        [reminder name, Chase: prefix stripped]
"Waiting on Seller"                     [party pill — VM code]
"Waiting on Buyer"                      [party pill — PM code]

# ReminderCard — active mode status bar (not shown in snoozed view, but used if active)
"Escalated"                             [header left — escalated]
"Escalated · {N}d overdue"             [header left — escalated + overdue]
"Escalated · due today"                 [header left — escalated + due today]
"Overdue {N}d"                          [header left — overdue]
"Due today"                             [header left — due today]
"Active from {date}"                    [header left — upcoming]
"{N} chase sent · last {relative} via {method}"  [chase summary, right]

# ReminderCard — active mode body details
"Show details"                          [expand toggle]
"Hide details"                          [collapse toggle]
"Chased manually"                       [kebab menu option]
"↑ Escalate"                            [kebab menu option]

# ReminderCard — expanded details panel
"Last contact: via {method}, {relative}"
"No contact logged on this file yet."
"Not yet chased"
"Chased {N}× already"
"{N} other reminder active on this file"
"{N} other reminders active on this file"
"Reminder rule: Chase after {milestone} ({N}d grace)"
```

### 7.1 Voice review (Stage 3 — 2026-05-12)

Walked the polish page top to bottom against `VOICE_GUIDELINES.md` (three rules + tone calibration + translation table). Pre-flagged offenders verified in place. New violations surfaced. ✓ no change rows kept visible per Ellis's instruction.

**P** = polish page (annotated `{/* OLD: ... */}` and rewritten). **Prod** = production-only string (Stage 4 applies the rewrite from this row).

| Location | Current copy | Proposed copy | Reason |
|---|---|---|---|
| PageHeader title | "Reminders" | ✓ no change | Translation table: ReminderLog → Reminder, direct |
| PageHeader subtitle | "What needs chasing, today and ahead." | ✓ no change | Active, present, specific |
| StatPill | "{N} overdue" / "{N} due today" / "{N} coming up" | ✓ no change | Factual counts |
| FileAlertsStrip header count | "{N} file alert" / "{N} file alerts" | ✓ no change | Factual |
| FileAlertsStrip header — overdue exchange / missing solicitor badges | "{N} overdue exchange" / "{N} missing solicitor" | ✓ no change | Adjective+noun state labels, plain English |
| FileAlertsStrip header — stale badge **[NEW, surfaced during Stage 4 §2 by Ellis]** | "{N} stale" | "{N} not progressing" | Rule 2 (dev shorthand): "stale" is a database/dev term meaning "hasn't been updated". Agents don't think in those terms. The per-row label in `lib/services/work-queue.ts:30` already reads "No progress in 14+ days" — the summary badge now mirrors that spirit. Active voice. Applied at `components/reminders/FileAlertsStrip.tsx:61`. Stage 3 review missed this — corrected mid-Stage-4. |
| FileAlertsStrip toggle | "Show" / "Hide" | ✓ no change | Imperative |
| FileAlertsStrip action links | "Add purchaser solicitor →" / "Add vendor solicitor →" / "Add solicitors →" / "Update exchange date →" | ✓ no change | Imperative, specific |
| FileAlertsStrip row badges | "Overdue exchange" / "Missing solicitor" / "Stale" | ✓ no change | Factual state labels |
| Zero-files empty heading | "Your reminders will appear here" | ✓ no change | Already passes |
| Zero-files empty body **[P, pre-flagged 1]** | "Once you create a sale, we'll surface chases and follow-ups as files progress." | "Chases and follow-ups appear here as your files move forward." | Rule 1 (system self-reference). **Verified applied on polish page.** Production fix at `app/agent/work-queue/page.tsx:82` deferred to Stage 4. |
| Ghost group labels | "Overdue" / "Due today" | ✓ no change | Group label |
| All-caught-up heading | "All caught up" | ✓ no change | Already passes |
| All-caught-up body **[P, pre-flagged 2]** | "No reminders due right now. We'll surface them here as files progress." | "No reminders due right now. They'll appear here as files move forward." | Rule 1 (system self-reference). **Verified applied on polish page** — Stage 2 fix used "show up here"; Stage 3 refinement to "appear" for consistency with the zero-files canonical verb from `VOICE_GUIDELINES.md`. Production fix at `AgentRemindersList.tsx:600` deferred to Stage 4. |
| Filter bar placeholder | "Search address or reminder…" | ✓ no change | Direct |
| Filter bar pills | "All" / "Seller" / "Buyer" / "Active" / "Snoozed" / "Snoozed ({N})" | ✓ no change | Short, factual |
| Filter-empty (seller) **[Prod]** | "No reminders for Seller right now." | ✓ no change | Active, present |
| Filter-empty (buyer) **[Prod]** | "No reminders for Buyer right now." | ✓ no change | Active, present |
| Filter-empty (search) **[Prod, pre-flagged 3]** | "No reminders match the current filter." | "No reminders match." | Rule 3 (active/specific). "The current filter" is a passive pointer to a system state the user just set — they know what filter is on. Shorter, same meaning. Production-only — applied at Stage 4 to `AgentRemindersList.tsx:657`. |
| Filter-empty (active, no results) **[Prod]** | "No active reminders." | ✓ no change | Direct |
| Snoozed-empty **[Prod]** | "No snoozed reminders." | ✓ no change | Direct |
| Snoozed-empty filtered **[Prod, pre-flagged 4]** | "No snoozed reminders matching filter." | "No matching snoozed reminders." | Rule 3 (smoother active phrasing; same meaning). Production-only — applied at Stage 4 to `AgentRemindersList.tsx:718`. |
| Urgency group labels | "Escalated" / "Overdue" / "Due today" / "Coming up" | ✓ no change | State labels |
| Urgency group count badge | "{N}" | ✓ no change | Factual |
| Urgency group toggle | "Show" / "Hide" | ✓ no change | Imperative |
| SplitFileCard address | (dynamic property address) | ✓ no change | Data |
| SplitFileCard count | "{N} reminder" / "{N} reminders" | ✓ no change | Factual |
| SideColumn label | "Seller" / "Buyer" | ✓ no change | Industry standard |
| SideColumn count **[P, NEW]** | "{N} item" / "{N} items" | "{N} reminder" / "{N} reminders" | Rule 3 (specific over generic). "Item" gives no information; "reminder" matches the page's primary noun. **Applied on polish page.** Production fix at `AgentRemindersList.tsx:267–269` deferred to Stage 4. |
| Reminder row name | (`reminderRule.name` with `Chase:` prefix stripped) | ✓ no change in this pass | Stripping verified at `lib/services/hub.ts:481` and inline in both `RemindersSection.tsx:73` / `AgentRemindersList.tsx:275` via `stripChase()` regex. Rule-name copy sampled from `prisma/seed.ts:331+` ("Seller MOS received", "Draft contract pack issued", "Management pack requested" etc.) — past-participle state labels in acceptable industry voice. **Not in scope for this commit.** See note below on rule-name copy. |
| Reminder row urgency label | "Escalated" / "{N}d overdue" / "Due today" / "From {date}" | ✓ no change | Factual |
| Row action — Done button text | "Done" (with ✓ icon) | ✓ no change | Imperative |
| Row action — Done button title **[P, NEW]** | `title="Confirm milestone done"` | `title="Mark step done"` | Rule 2 (schema jargon — translation table: milestone → step). Tooltip is user-facing UI even though hover-only. **Applied on polish page.** Production fix at `AgentRemindersList.tsx:313` deferred to Stage 4. |
| Row action — Snooze title | `title="Snooze"` (polish) / `title="Snooze this reminder"` (production) | ✓ no change | Imperative |
| Snooze dropdown options | "24 h" / "48 h" / "72 h" / "7 days" | ✓ no change | Standard time abbreviations |
| Column footer — Chase button | "Chase" / "Chase all ({N})" | ✓ no change | Imperative, specific |
| Column footer — Snooze all | "🕐 Snooze all" | ✓ no change | Imperative |
| EmptyColumn | "Seller is all up to date" / "Buyer is all up to date" | ✓ no change | Conversational present state; passes Rule 3 |
| Snoozed banner — wake date | "Wakes {date}" | ✓ no change | Present, factual |
| Snoozed banner — wake action | "Wake now" | ✓ no change | Imperative |
| ReminderCard active status bar **[Prod]** | "Escalated" / "Escalated · {N}d overdue" / "Escalated · due today" / "Overdue {N}d" / "Due today" / "Active from {date}" | ✓ no change | State labels |
| ReminderCard chase summary **[Prod]** | "{N} chase sent · last {relative} via {method}" | ✓ no change | Factual past-tense summary |
| ReminderCard expand toggle **[Prod]** | "Show details" / "Hide details" | ✓ no change | Imperative |
| ReminderCard kebab — manual chase **[Prod]** | "Chased manually" | ✓ no change | Past-tense action label |
| ReminderCard kebab — escalate **[Prod]** | "↑ Escalate" | ✓ no change | Imperative; arrow conveys upward action |
| ReminderCard expanded details **[Prod]** | "Last contact: via {method}, {relative}" / "No contact logged on this file yet." / "Not yet chased" / "Chased {N}× already" / "{N} other reminder(s) active on this file" / "Reminder rule: Chase after {milestone} ({N}d grace)" | ✓ no change overall; **one note**: "Reminder rule: Chase after {milestone} ..." contains the word "milestone" — Rule 2 violation. Flag for Stage 4 production-only fix on `ReminderCard.tsx` expanded-details panel: "milestone" → "step" per translation table. Not in polish page (only the snoozed view renders here). | Mostly factual; one schema-jargon instance for Stage 4 to address |
| Loading skeleton | (no copy — `PageHeader` reuses "Reminders" + subtitle) | ✓ no change | Same as PageHeader row |

**Pre-flagged offenders summary:** 4/4 verified.

1. ✓ Zero-files body — applied on polish page, matches `VOICE_GUIDELINES.md` canonical "After" verbatim.
2. ✓ All-caught-up body — applied on polish page; Stage 3 refined the verb "show up" → "appear" for consistency with the zero-files canonical.
3. ✓ Filter-empty (search) — proposed rewrite "No reminders match." captured for Stage 4 (production-only string, not on polish page).
4. ✓ Filter-empty (snoozed filtered) — proposed rewrite "No matching snoozed reminders." captured for Stage 4 (production-only).

**Newly surfaced violations:** 3.

1. **[P]** Done button `title` attr — "Confirm milestone done" → "Mark step done" (Rule 2 schema jargon).
2. **[P]** SideColumn count noun — "item / items" → "reminder / reminders" (Rule 3 specific over generic).
3. **[Prod, out of polish-page scope]** `ReminderCard` expanded-details panel: "Reminder rule: Chase after {milestone} ..." — Rule 2 schema jargon. Flag for Stage 4 production fix.

**Reminder-rule names (carve-out, out of scope):** sampled 10 from `prisma/seed.ts:331–345` after stripping the `Chase:` prefix. Examples: "Seller MOS received", "Draft contract pack issued", "Management pack requested", "Initial enquiries received by seller's solicitor". Read as acceptable industry-voice past-participle state labels — "received", "issued", "requested" describe the desired milestone outcome that the chase is reminding the agent to push for. Not voice violations; not logged to `POST_LAUNCH_FIXES.md`. A future rule-copy pass could make them more imperative ("Push seller to instruct solicitor" vs "Seller instructed solicitor"), but the current copy passes the three rules.

---

## 8. Desktop view

| Field | Value |
|---|---|
| Breakpoint | Desktop ≥ 1024px (AgentShell sidebar fully expanded) |
| Layout | Single column, fluid width. No right sidebar. AgentShell sidebar (240px, fixed) on left. Content area is full width. |
| Navigation | AgentShell renders full sidebar, permanently visible. |
| Page-specific desktop elements | Sticky filter bar (position: sticky, top: 0). StatPill row in PageHeader. |
| Desktop-only elements | None — layout is single-column at all widths inside AgentShell |

```
Desktop layout (≥1024px):
┌─ AgentShell sidebar (240px, fixed) ──┬─ main content (fluid) ───────────────────────┐
│  logo                                 │  PageHeader: "Reminders"  [StatPills]         │
│  navigation links (Reminders active) │  ─────────────────────────────────────────── │
│  user strip                           │  [FileAlertsStrip — amber, conditional]        │
│                                       │                                               │
│                                       │  ┌─ sticky filter bar ──────────────────────┐│
│                                       │  │ [search input              ]              ││
│                                       │  │ [All] [Seller] [Buyer]  [Active][Snoozed]││
│                                       │  └───────────────────────────────────────────┘│
│                                       │                                               │
│                                       │  ┌─ Escalated group header (red) ──── Hide ─┐│
│                                       │  │ ┌─ SplitFileCard ─────────────────────┐  ││
│                                       │  │ │ Address header                       │  ││
│                                       │  │ │ ┌── Seller col ──┬── Buyer col ───┐  │  ││
│                                       │  │ │ │ row row row    │ row row        │  │  ││
│                                       │  │ │ │ [Chase all] [🕐]│ [Chase] [🕐]  │  │  ││
│                                       │  │ │ └────────────────┴────────────────┘  │  ││
│                                       │  │ └──────────────────────────────────────┘  ││
│                                       │  └───────────────────────────────────────────┘│
│                                       │  (Overdue, Due today, Coming up — same struct) │
└───────────────────────────────────────┴───────────────────────────────────────────────┘
```

**Two-column card layout:** Each SplitFileCard always renders both Seller and Buyer columns side by side (`display: flex, gap: 10`). The narrower column is never hidden — it shows `EmptyColumn` with italic placeholder if that side has no reminders.

---

## 9. Mobile view

| Field | Value |
|---|---|
| Breakpoint | Mobile < 1024px (AgentShell sidebar collapses to top bar with hamburger) |
| Layout | Single column, full width. |
| Navigation | AgentShell renders collapsed topbar. |
| Elements that reorder | None — content is already single-column |
| Elements that become drawers/sheets | ChaseDrawer — full-screen slide-in on mobile (same mechanism as desktop) |
| Elements that collapse | AgentShell sidebar collapses to topbar. |
| Mobile-specific elements | None |
| Hidden on mobile | None |

```
Mobile layout (375px):
┌─────────────────────────────────┐
│ [☰] Reminders          [user]   │  ← AgentShell topbar
├─────────────────────────────────┤
│ "Reminders"                     │
│ "What needs chasing, today…"   │
│ [3 overdue] [2 due today]       │  ← StatPills wrap or scroll
├─────────────────────────────────┤
│ [FileAlertsStrip — conditional] │
├─────────────────────────────────┤
│ ┌─ sticky filter bar ─────────┐ │
│ │ [search address or remind…] │ │
│ │ [All][Seller][Buyer]        │ │
│ │ [Active][Snoozed (N)]       │ │
│ └─────────────────────────────┘ │
│ ┌─ Escalated ───────── Hide ─┐  │
│ │ ┌─ SplitFileCard ────────┐ │  │
│ │ │ Address →     N remind │ │  │
│ │ │ ┌─ Seller ──────────┐  │ │  │
│ │ │ │ row               │  │ │  │  ← at 375px Seller+Buyer side by side ≈ 158px each
│ │ │ │ [Chase] [🕐]      │  │ │  │    too narrow — needs mobile stack
│ │ │ └───────────────────┘  │ │  │
│ │ │ ┌─ Buyer ────────────┐  │ │  │
│ │ │ │ row                │  │ │  │
│ │ │ └───────────────────┘  │ │  │
│ │ └────────────────────────┘ │  │
│ └────────────────────────────┘  │
└─────────────────────────────────┘
```

**Mobile gaps to document for Stage 2:**

1. **SplitFileCard two-column layout** — at 375px, `display: flex, gap: 10` renders each SideColumn at ≈158px. That is too narrow for the column content (milestone names, action buttons). Stage 2 must design a stacked layout for mobile: Seller column above Buyer column below, full width. This is a NEW mobile treatment not covered by current code. Document in §13.

2. **Filter bar pill groups** — two separate pill groups on one flex row. At 375px, both groups (3 + 2 chips) need to wrap or scroll. Currently uses `flex-wrap` which can cause the two groups to stack awkwardly. Stage 2 should specify whether they stack vertically (two rows) or scroll horizontally (single row, overflow-x auto). See PAGE_LIST.md explicit note.

3. **StatPill row** — three pills in PageHeader `agent-page-header-actions`. At 375px, all three may wrap. Acceptable, but verify no overflow.

4. **Sticky filter bar** — `top: 0` sticky. On mobile, this positions below the AgentShell topbar. Verify z-index clears the topbar correctly.

---

## 10. Animations / transitions already in place

| Element | Animation | Source |
|---|---|---|
| Reminder row on Done / Snooze / Wake now | `agent-row-exit` — opacity + height collapse 150ms | **Stage 1 claim was wrong — confused with `RemindersSection.tsx:248`.** Now correctly wired in Stage 4 B1 follow-up: `exitingIds` state at `AgentRemindersList.tsx:524`, two-step pattern in `handleComplete` / `handleSnooze` / `handleSnoozeAll` / `handleWakeup` at lines 601–639, `agent-row-exit` class applied at line 309 + snoozed-card wrapper at line 791. |
| Snooze dropdown container open | `agent-dropdown-in` — 120ms ease-out drop-in | **Stage 1 line cites were wrong** — `agent-dropdown-in` was NOT wired pre-Stage-4. Now correctly wired (via portal): `AgentRemindersList.tsx:113` (SideSnoozeMenu) and `AgentRemindersList.tsx:167` (RowSnoozeMenu). Both render via `createPortal` to `document.body` to escape `agent-acc-in`'s `overflow: hidden`. |
| SideColumn milestone row flash on loading | `agent-row-flash` — 700ms ease-out green wash | `AgentRemindersList.tsx:294` (`loading === task.id`) |
| ReminderCard exit (snoozed view) | Custom: `maxHeight 0, opacity 0` over 280ms/220ms — NOT `agent-row-exit` | `ReminderCard.tsx:527–532` — gap: should use `agent-row-exit` |
| ReminderCard snooze dropdown | `agent-dropdown-in` ✓ | `ReminderCard.tsx:137` (SnoozeDropdown) and `:222` (KebabMenu) — via `createPortal` |
| FileAlertsStrip body expand/collapse | None — `{!collapsed && <div>}` conditional mount/unmount | `FileAlertsStrip.tsx:75` — gap: needs `agent-acc` / `agent-acc-in` |
| Urgency group body show/hide | None — `{!isCollapsed && <div>}` conditional mount/unmount | `AgentRemindersList.tsx:689` — gap: needs `agent-acc` / `agent-acc-in` |

---

## 10.5. Global animation and interaction inheritance

Reference: `docs/polish-pass/ANIMATION_STANDARDS.md`.

**Animation classes (§1–6):**

| Class | Applies? | Where it fires | Status |
|---|---|---|---|
| `.agent-acc` / `.agent-acc-in` | YES | FileAlertsStrip expand/collapse; urgency group show/hide | **Needs wiring in Stage 4.** Currently conditional `{!collapsed && <div>}` — no animated height transition. |
| `.agent-reveal-in` / `.agent-reveal-out` | No | No inline edit forms or validation messages on this page | N/A |
| `.agent-dropdown-in` | YES | RowSnoozeMenu and SideSnoozeMenu dropdown containers | **Stage 1 "already wired" claim was wrong.** Pre-Stage-4 production had neither dropdown carrying this class. Now correctly wired (via portal) at `AgentRemindersList.tsx:113` (SideSnoozeMenu) + `:167` (RowSnoozeMenu). Also wired in `ReminderCard.tsx:137, 222` (transaction-detail use). |
| `.agent-row-flash` | YES | SideColumn rows when `loading === task.id` | **Already wired.** `AgentRemindersList.tsx:294`. |
| `.agent-row-exit` | YES | SideColumn rows on Done/Snooze | **Already wired.** `AgentRemindersList.tsx:248–249`. Gap: `ReminderCard.tsx` uses custom transition — needs `agent-row-exit` in Stage 4. |
| `.agent-btn` press-down | PARTIAL | `SideSnoozeMenu` trigger already uses `agent-btn agent-btn-sm agent-btn-ghost` ✓. `RowSnoozeMenu` trigger uses inline styles — **needs `agent-btn`**. `SideColumn` chase button uses inline solid fill — **needs `agent-btn agent-btn-sm agent-btn-primary`**. | Audit in Stage 2 |

**Interactive-state classes (§6–12):**

| Class | Applies? | Where it fires | Status |
|---|---|---|---|
| `.agent-segment-pill` | YES | FilterChip: All/Seller/Buyer and Active/Snoozed | **Needs wiring in Stage 4.** Currently bespoke `FilterChip` with Tailwind classes (`px-3 py-1.5 rounded-lg text-xs font-medium` etc.) — `AgentRemindersList.tsx:57–68`. |
| `.agent-link` / `.agent-link-muted` | YES (needed) | Urgency group Show/Hide toggle; FileAlertsStrip Show/Hide toggle; address link in SplitFileCard | **Needs wiring.** Currently `text-xs text-slate-900/40 hover:text-slate-900/60 transition-colors` Tailwind. |
| `.agent-btn-ghost-bordered` | No | No bordered ghost CTAs currently on this page | N/A |
| `.agent-acc-hdr` | **NO — E1 exception** | Urgency group headers | **Intentionally NOT applied per `ANIMATION_STANDARDS.md §E1`.** Semantic colour coding (escalated red, overdue orange, due today amber, coming up white) is the primary UI signal. The E1 exception is permanent and documented. Do not apply `.agent-acc-hdr` in Stage 4. |
| `.agent-icon-btn` | No | No circular icon/close buttons on this page | N/A |
| `.agent-dropdown-item` | YES (needed) | Snooze dropdown items in RowSnoozeMenu and SideSnoozeMenu | **Needs wiring.** Currently `w-full text-left px-3 py-2 text-xs text-slate-900/70 hover:bg-slate-50 transition-colors` Tailwind — `AgentRemindersList.tsx:125–132, 182–189`. |
| `.agent-hover-row` | YES (needed) | FileAlertsStrip alert rows | **Needs wiring.** Currently `hover:bg-white/20 transition-colors` Tailwind — `FileAlertsStrip.tsx:96`. |
| `.agent-hover-link` | No | No colour-shift-only text hover controls | N/A |

**Stage 4 items flagged from this section (for §12 cross-reference):**
1. Wire `agent-acc` / `agent-acc-in` on FileAlertsStrip body and urgency group bodies
2. Convert `FilterChip` → `agent-segment-pill`
3. Convert Show/Hide toggles → `agent-link-muted`
4. Convert snooze dropdown items → `agent-dropdown-item`
5. Convert FileAlertsStrip alert rows → `agent-hover-row`
6. Convert `SideColumn` chase button → `agent-btn agent-btn-sm agent-btn-primary`
7. Convert `RowSnoozeMenu` trigger → `agent-btn agent-btn-sm`
8. Convert `ReminderCard` exit animation → `agent-row-exit`

---

## 11. Known edge cases

- **Silent engine run on mount:** `AgentRemindersList` calls `runReminderEngineAction` on every mount (line 499). If the action throws, the `catch(console.error)` silently swallows it. Stage 4 does not change this logic — only wrapper styling.
- **Optimistic snooze count:** The "Snoozed (N)" pill increments optimistically before server revalidation. If the snooze action fails, the count is stale until next navigation/refresh. Do not touch this logic in Stage 4.
- **Urgency group default-collapsed state:** All groups start collapsed. On first load, agents see four group header chips but no cards until they click "Show". This may be intentional or a bug — flag for Ellis review during Stage 2. Either way, Stage 4 must preserve whichever behaviour is decided; `agent-acc` animation must work for both expand and collapse directions.
- **Group classification duplicated:** `classifyActive` in `AgentRemindersList.tsx` and `RemindersSection.tsx` are near-identical functions. A change to classification logic in one does not propagate to the other. Out of scope for this pass — filed in `docs/active/TODO.md`.
- **Chase contacts filter:** In `SideColumn`, contacts are filtered to seller-side or buyer-side based on `VM`/`PM` milestone codes. If no matching contacts exist, falls back to all contacts (`effectiveContacts`). Stage 4 does not touch this logic.
- **`otherLogs` fallback:** Reminders without `VM` or `PM` milestone codes fall into `effectiveSellerLogs` as a fallback (`SplitFileCard.tsx:442`). Stage 4 does not touch this logic.

---

## 12. Out of scope for redesign

- **All server actions** (`completeTaskAction`, `snoozeTaskAction`, `wakeupReminderAction`, `escalateTaskAction`, `runReminderEngineAction`, `advanceChaseTaskAction`, `recordManualChaseAction`) — server-side logic, untouched
- **`getWorkQueueItems` / `getAgentReminderLogs` / `txWhereWorkQueue`** — data queries, untouched
- **`ChaseDrawer` internals** — already canonical from transaction-detail Stage 4; out of scope for work queue pass
- **`ReminderCard` details-panel logic** (`expanded`, `hasMoreDetails`, `lastContactText`) — logic untouched; only class audit on wrapper and action buttons
- **`runReminderEngineAction` silent call on mount** — behaviour untouched
- **Ghost group preview copy** — hardcoded mock addresses are illustrative; do not change the mock data
- **`GROUP_CONFIG` duplication** — code smell noted; filed in `docs/active/TODO.md`; not fixed here
- **`addBusinessDays` / `isSunday` duplication** — same; filed in `docs/active/TODO.md`
- **`classifyActive` duplication between files** — same

---

## 13. Per-section visual specification

**Baseline reminder:** Transaction-detail (`/agent/transactions/[id]`) is the quality bar — Stage 4 signed off 2026-05-12. Open transaction-detail alongside the polish page during Stage 2 build. Where a work-queue section mirrors a transaction-detail section, note "Follows transaction-detail pattern."

**No existing polish page.** The "Polish-page structure" column below describes the *target* that Stage 2 will build. Stage 4 then matches production to Stage 2.

---

| Section name | Polish-page structure (target for Stage 2) | Production component(s) | Current state vs target | Stage 4 changes required |
|---|---|---|---|---|
| **PageHeader** | `agent-page-header` with `agent-page-header-text` (h1 + subtitle) + `agent-page-header-actions` (StatPills). Follows transaction-detail PageHeader pattern exactly. | `PageHeader` + `StatPill` | PageHeader already matches (hub Stage 4 global update). StatPill: inline `<a>` with theme-token-fed `rgba(..., 0.08)` bg + `rgba(..., 0.15)` border — pills read as too pale/glass-y on cream/coastal backgrounds; no hover effect. | **StatPill brightness fix:** bump background alpha 0.08 → 0.16 and border alpha 0.15 → 0.40 (matches StatusBadge visibility level — `text-X-700 bg-X-50 border-X-200` pattern but theme-aware via existing `--agent-danger-rgb` / `--agent-warning-rgb` tokens). Muted pill stays neutral grey. Also add hover (`filter: brightness(0.92)` via existing `agent-link` transition). Polish page reference: `app/agent/polish/work-queue/page.tsx` → `StatPill`. |
| **FileAlertsStrip** | `agent-glass-strong` card, `overflow: hidden`. Header: `agent-card-hdr-warning` ✓ defined Stage 2 (`agent-system.css` after `.agent-card-title-emphasis`; doc §S5 in `ANIMATION_STANDARDS.md`). Header right: `agent-link-muted` Show/Hide toggle. Body: `agent-acc` / `agent-acc-in`. Alert rows: `agent-hover-row`. Alert action links: `agent-link-muted`. Badge chips: keep existing amber/red/sky token colours. **NEW PATTERN** — no transaction-detail equivalent. Justification: FileAlertsStrip is a work-queue-specific feature surfacing file-level data quality alerts (not reminders). Its collapsed-by-default design is intentional: it is secondary context, not the primary action surface. | `FileAlertsStrip` | `glass-card overflow-hidden` (not `agent-glass-strong`). Header: `flex items-center justify-between px-4 py-2.5` with `style={{ background: "rgba(251, 191, 36, 0.08)" }}` inline (not `agent-card-hdr-warning`). Toggle: Tailwind hover. Rows: `hover:bg-white/20 transition-colors`. Action links: complex Tailwind class string. Body: no `agent-acc`. | **Stage 4 work:** convert `glass-card` → `agent-glass-strong`; header → `agent-card-hdr-warning`; toggle → `agent-link-muted`; body → `agent-acc` / `agent-acc-in`; rows → `agent-hover-row`; action links → `agent-link-muted`. No inline style overrides. |
| **Zero-files empty state** | `agent-glass-strong` card, `padding: "48px 24px"`, `textAlign: "center"`. Bell icon 32px, `var(--agent-text-muted)`, `opacity: 0.45`. Heading: 15px / 600 / `--agent-text-primary`. Body: 13px / `--agent-text-muted` / fixed voice copy. **Ghost groups below: structure-only skeleton.** Keep "Overdue" / "Due today" group headers and per-group row count, but replace hardcoded mock addresses + reminder names + urgency tags with `.agent-skeleton` pulse shapes (one wide line for the address slot, one narrower line for the reminder-name slot, one rounded pill for the tag slot). Conveys the structure agents will see without faking specific data. | `page.tsx:76–121` | `glass-card` (not `agent-glass-strong`). Voice violation in body copy (line 82). Ghost groups currently render hardcoded mock data: "14 Maple Close, Birmingham / Mortgage offer — chaser due / 3 days overdue" etc. Reads as fake content, not a structural preview. | Convert `glass-card` → `agent-glass-strong`. Fix voice copy (see §7). **Replace mock-data ghost rows with `.agent-skeleton` lines** — same shape, same row count per group, no text content. Polish page reference: `app/agent/polish/work-queue/page.tsx` → `ZeroFilesEmpty`. |
| **"All caught up" empty state** | `agent-glass-strong` card, `padding: "40px 32px"`, `textAlign: "center"`. CheckCircle icon (fill, `--agent-success`). Heading: 14px / 600 / `--agent-text-primary`. Body: 12px / `--agent-text-muted` / fixed voice copy. | `AgentRemindersList.tsx:596–603` | `glass-card` (not `agent-glass-strong`). Voice violation in body copy (line 600). | Convert `glass-card` → `agent-glass-strong`. Fix voice copy. |
| **Filter bar (sticky)** | Sticky pill, `top: 0, zIndex: 20`. Glass background: `rgba(var(--agent-bg-base-rgb),0.93) + blur(16px)`. Border: `0.5px solid rgba(var(--agent-coral-base-rgb),0.18)`. Border-radius: `var(--agent-radius-lg)`. **Row 1:** `agent-input agent-input-sm` search field with **`fontSize: 13` inline override** (canonical `agent-input-sm` forces `max(16px, body-sm)` for iOS-zoom prevention; on a desktop-first work queue search field, 16px placeholder reads as oversized — 13px keeps it proportionate to the surrounding pills). **Row 2:** Two pill groups (`agent-segment-pill agent-segment-pill-sm` buttons), `justify-between`. Mobile: two rows (group 1 above group 2) at < 640px. Follows transaction-detail Activity tab filter pattern (segment pills). | `AgentRemindersList.tsx:611–649` (`FilterChip` + sticky div) | Sticky container already close to target (uses correct CSS tokens on background/border). Search: Tailwind `px-3 py-1.5 text-base` → 16px placeholder. FilterChip: bespoke Tailwind. | Convert search `<input>` → `agent-input agent-input-sm` with `style={{ fontSize: 13 }}`. Convert `FilterChip` → `agent-segment-pill agent-segment-pill-sm`. Mobile: add `@media (max-width: 640px)` rule to stack pill groups vertically. |
| **Urgency group header** | Per E1 exception: semantic colour retained. `px-3 py-2 rounded-xl ${cfg.headerCls}` structure kept. Group label: `text-xs font-semibold uppercase tracking-wide` in `cfg.labelCls` ✓. Count badge: `text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badgeCls}` ✓. **Show/Hide toggle:** `agent-link-muted`. Section `id` anchor (`section-escalated` etc.) verified present ✓. **E1 exception: do not apply `.agent-acc-hdr`.** | `AgentRemindersList.tsx:677–688` | Header structure and colours correct. Show/Hide toggle: `text-xs text-slate-900/40 hover:text-slate-900/60 transition-colors` Tailwind (not `agent-link-muted`). Body below: `{!isCollapsed && <div>}` conditional (no `agent-acc` animation). | Convert Show/Hide toggle → `agent-link-muted`. Body: wrap in `agent-acc` / `agent-acc-in` for animated expand/collapse. |
| **SplitFileCard — container** | `agent-glass-strong` card, `borderRadius: 20`, `borderLeft: 4px solid ${leftBorder}` (urgency-keyed colour). Follows transaction-detail glass-card visual pattern. **NEW PATTERN** for the split-file layout structure — justification: work queue aggregates reminders across multiple transactions grouped by file, so the card must carry address identity at the top. There is no transaction-detail equivalent for this cross-transaction card structure. | `AgentRemindersList.tsx:447–449` | `glass-card` (not `agent-glass-strong`). Border-left present ✓. | Convert `glass-card` → `agent-glass-strong`. |
| **SplitFileCard — address header** | `padding: "10px 20px"`, `background: rgba(255,255,255,0.28)`, uses `agent-card-hdr` for the flex layout. Address: `agent-link` 13px / 600 / `--agent-text-primary` on the anchor text. Trailing `→` arrow: extracted to a sibling `<span aria-hidden>` outside the anchor, `color: --agent-text-muted`. Count badge: 11px / `--agent-text-muted` (right). | `AgentRemindersList.tsx:451–471` | Address link: inline styles (not `agent-link`). `→` inside the anchor text — would underline under `agent-link` hover. Background: inline ✓. | **Decision locked Stage 2:** address text → `agent-link`; arrow extracted to sibling `<span aria-hidden>` outside the `<a>`. No new canonical variant needed — markup pattern only. Polish page reference: `app/agent/polish/work-queue/page.tsx` → `SplitFileCard`. |
| **SplitFileCard — two-column body (desktop)** | `padding: "12px 14px 14px"`, `display: flex, gap: 10`. Both columns always render (SideColumn or EmptyColumn). Follows `RemindersSection.ColumnSection` pattern from `components/reminders/RemindersSection.tsx:463`. | `AgentRemindersList.tsx:475–482` | Already matches target structure. | No changes on desktop. Add `@media (max-width: 640px)` to stack columns vertically (see §9 mobile gap 1). |
| **SideColumn — header** | Colour-coded: dot 6px circle + "Seller"/"Buyer" uppercase 10px / 700 + item count right. Border-bottom in matching colour. Intentionally NOT canonical — colour coding is functional identity marker for this column (seller = orange, buyer = blue). | `AgentRemindersList.tsx:258–270` | Already matches target. | No changes. |
| **SideColumn — milestone rows** | `padding: "7px 12px"`, `borderTop: 0.5px solid rgba(15,23,42,0.06)` on rows after first. Reminder name: 12px / 500 / `rgba(15,23,42,0.80)`. Urgency label: 10px / 600 / urgency colour. `agent-row-exit` already wired ✓. `agent-row-flash` already wired ✓. **`RowSnoozeMenu` trigger and "✓ Done" button: both `agent-btn agent-btn-sm agent-btn-secondary`** (neutral white-glass with `--agent-glass-bg-hover` lifted-glass hover — pairs visually since both are peer row actions). Follows `RemindersSection.ColumnSection` row pattern. | `AgentRemindersList.tsx:273–326` | Both buttons inline-styled with `background: rgba(255,255,255,0.60)` and no hover defined — flat, no feedback on hover. | Convert snooze trigger → `agent-btn agent-btn-sm agent-btn-secondary`. Convert "Done" → `agent-btn agent-btn-sm agent-btn-secondary`. Snooze dropdown items → `agent-dropdown-item`. Polish page reference: `app/agent/polish/work-queue/page.tsx` → `SideColumn`. |
| **SideColumn — footer (Chase + Snooze)** | `padding: "8px 12px"`, `borderTop: 0.5px solid rgba(15,23,42,0.06)`. Chase button: `agent-btn agent-btn-sm agent-btn-primary flex-1`. "Snooze all" trigger: `agent-btn agent-btn-sm agent-btn-ghost` (already partially correct). Snooze-all dropdown items → `agent-dropdown-item`. | `AgentRemindersList.tsx:329–352` | Chase button: inline-styled with solid `isSeller ? "#ea580c" : "#3b82f6"` fill — ignores theme colours. `SideSnoozeMenu` trigger: `agent-btn agent-btn-sm agent-btn-ghost` ✓ (from line 132 of RemindersSection — but in AgentRemindersList: check line 108). Snooze dropdown items: `hover:bg-slate-50` Tailwind. | Convert chase button → `agent-btn agent-btn-sm agent-btn-primary`. Snooze-all items → `agent-dropdown-item`. |
| **EmptyColumn** | Colour-coded column placeholder. Matching border/background. Italic placeholder text. No changes needed. | `AgentRemindersList.tsx:375–407` | Matches target. Token-adjacent. | No changes. |
| **Snoozed view (ReminderCard list)** | Flat list of `ReminderCard` components in snoozed mode. Each card: `agent-glass-strong` with `borderLeft: 4px solid var(--agent-snoozed-border)`. Snoozed banner: `background: var(--agent-snoozed-bg)`, `color: var(--agent-snoozed)`, `borderBottom: 0.5px solid var(--agent-snoozed-border)`. "Wakes {date}" left. "Wake now" right → `agent-link agent-link-muted` with inline `color: var(--agent-snoozed)`. Exit animation: `agent-row-exit` two-step. | `ReminderCard.tsx:346–389` | `glass-card` (not `agent-glass-strong`). Custom exit transition (not `agent-row-exit`). "Wake now": `hover:text-purple-800 transition-colors` Tailwind. Purple hex values (`purple-50`, `purple-200`, `purple-600`, `purple-800`) are theme-fixed Tailwind and escape the design system. | **Decision locked Stage 2:** introduced `--agent-snoozed-*` token family (theme-locked across all six themes, like warning/danger/success/info). Defined in `themes.css` after the `--agent-info-*` block in each theme. Documented in `ANIMATION_STANDARDS.md` "Semantic tokens (added Stage 2, Work Queue pass)". **Stage 4 work:** convert `glass-card` → `agent-glass-strong`; all purple Tailwind values → `--agent-snoozed-*` tokens; "Wake now" → `agent-link agent-link-muted` with `--agent-snoozed` colour; exit transition → `agent-row-exit` two-step. |
| **Filter-empty states** | `agent-glass-strong` card, `px-5 py-8 text-center`. Single line: 14px (or 13px) / `--agent-text-muted`. Fixed voice copy (see §7). | `AgentRemindersList.tsx:652–720` | `glass-card px-5 py-8 text-center`. Text: Tailwind `text-sm text-slate-900/40`. | Convert `glass-card` → `agent-glass-strong`. Text → `--agent-text-muted` token. Fix "No reminders match the current filter." voice. |
| **Loading skeleton** | `WorkQueueLoading`: PageHeader skeleton shape + three `ReminderGroupSkeleton` (Escalated/Overdue/Due today). Group skeleton: header chip (36px, white/40) with `agent-skeleton` label + badge placeholders. Card row skeletons: `glass-card` with left urgency border + address bar + two content lines + three button skeletons. Overall structure matches final list structure. | `app/agent/work-queue/loading.tsx` | Close to target — uses `agent-skeleton` pulse ✓. `glass-card` for card rows (not `agent-glass-strong`). | Convert card rows → `agent-glass-strong`. Verify header chip height matches final urgency group header height after Stage 2 finalises structure. |

---

## 14. Amendments

| Date | Discovery | Added to which section |
|---|---|---|
| 2026-05-12 | **Stage 1 review — Point 1 resolution:** Section 2 originally tagged only `ReminderCard` and `ChaseDrawer` as "Reuse from transaction-detail". §13 rows used the phrase "Follows RemindersSection.ColumnSection pattern" for inline sub-components without acknowledging this is visual inheritance, not actual import-and-use. Updated each inline sub-component row in §2 to either (a) cite the source file:line of the visually-inherited counterpart with explicit "drift risk acknowledged" notes, or (b) explain why it is genuinely a new pattern (SplitFileCard cross-transaction grouping). Added structural drift-audit entry to `docs/active/TODO.md`. | §2 + `docs/active/TODO.md` |
| 2026-05-12 | **Stage 1 review — Point 2 resolution:** FileAlertsStrip §13 row originally said "Header: `agent-card-hdr` (amber background tint via inline override)". Inline overrides of canonical classes violate the no-drift rule. Resolved by introducing `agent-card-hdr-warning` as a new canonical class (precedent: `agent-hover-row-warning` at `agent-system.css:1084`) — to be defined in Stage 2 and documented in `ANIMATION_STANDARDS.md` changelog. §13 row updated to split work between Stage 2 (define class) and Stage 4 (apply class). No inline. | §13 (FileAlertsStrip row) |
| 2026-05-12 | **Stage 1 review — Point 3 resolution:** SplitFileCard address-header §13 row originally contained an "or inline with correct token colours if the → arrow conflicts with the underline hover" escape clause. Rewritten to remove the inline fallback: if `agent-link` conflicts with the trailing `→` arrow visual, Stage 2 must either adjust the arrow placement (e.g. extract to a non-underlined span outside the anchor) or define `agent-link-with-arrow` as a new canonical variant in `agent-system.css`. No inline. | §13 (SplitFileCard address header row) |
| 2026-05-12 | **Stage 1 review — Other notes (purple snoozed palette):** Per Ellis's flag, the snoozed-state purple tokens (`purple-50`, `purple-200`, `purple-600`, `purple-800`) used in `ReminderCard.tsx` snoozed mode are theme-fixed Tailwind values — they do not adapt across the six theme blocks in `themes.css`. §13 snoozed-view row updated to flag a Stage 2 decision: either introduce `--agent-snoozed-*` token family (text, bg, border) for cross-theme adaptation, or document the purple as an intentional theme-fixed semantic colour (E1 precedent). Decision belongs in Stage 2, not Stage 4. | §13 (Snoozed view row) |
| 2026-05-12 | **Stage 2 decision — `agent-card-hdr-warning` defined.** Added to `agent-system.css` after `.agent-card-title-emphasis` as a variant of `.agent-card-hdr` with `--agent-warning-bg` background. Same flex/padding/border-bottom as base. Documented in `ANIMATION_STANDARDS.md` §S5 + changelog. Resolves Point 2. | §13 (FileAlertsStrip), §15 |
| 2026-05-12 | **Stage 2 decision — address link + arrow.** Selected pattern: `agent-link` on the anchor text; trailing `→` arrow extracted to a sibling `<span aria-hidden>` outside the anchor. No new canonical variant needed — purely a markup pattern. Polish page demonstrates the structure on `SplitFileCard`. Resolves Point 3. | §13 (SplitFileCard address-header row) |
| 2026-05-12 | **Stage 2 decision — snoozed token family.** Selected option (a): introduced `--agent-snoozed-*` token family across all six theme blocks in `themes.css` at identical purple values (theme-locked, like warning/danger/success/info). Rejected option (b) E1 precedent because E1 governs multi-colour urgency hierarchy *within* a theme, not the colour of a single state *across* themes. Snoozed is structurally identical to the four existing semantic states. Documented in `ANIMATION_STANDARDS.md` "Semantic tokens (added Stage 2, Work Queue pass)". Resolves Other notes. | §13 (Snoozed view row), §15 |
| 2026-05-12 | **Stage 2 polish page built.** `app/agent/polish/work-queue/page.tsx`. State toggles for view (active/snoozed), empty (none/zero-files/all-clear), file-alerts on/off, reduced-motion. Demonstrates every canonical class conversion catalogued in §13. tsc clean. | §13 (all rows) |
| 2026-05-12 | **Stage 2 review feedback — four polish refinements applied to the polish page.** (1) StatPill background/border alpha bumped 0.08/0.15 → 0.16/0.40 — pills now read at the StatusBadge visibility level instead of glassy/pale. (2) Done and Snooze row buttons converted from `agent-btn agent-btn-sm` (no hover) to `agent-btn agent-btn-sm agent-btn-secondary` (neutral white-glass lifted hover). (3) Search input placeholder font size overridden to `fontSize: 13` inline — `agent-input-sm`'s `max(16px, body-sm)` reads as oversized on desktop work-queue search. (4) Zero-files ghost group rows: hardcoded mock data (addresses, reminder names, tags) replaced with `.agent-skeleton` pulse shapes; group headers + per-group row count preserved to convey structure. §13 rows updated for PageHeader (StatPill), Zero-files empty state (ghost groups), SideColumn (row buttons), and Filter bar (search font-size) to lock in the refined Stage 4 targets. | §13 (PageHeader, Zero-files, SideColumn, Filter bar rows) |
| 2026-05-12 | **Stage 4 post-cutover B1+B2 follow-up.** (B1) `agent-row-exit` now wired on the four exit paths — Done / row snooze / side snooze / Wake now. `exitingIds: Set<string>` state added at `AgentRemindersList.tsx:524`, two-step pattern (setExiting → 150ms → hide + act) applied in `handleComplete` / `handleSnooze` / `handleSnoozeAll` / `handleWakeup` at lines 601–639. Done button `disabled` extended to `loading === task.id \|\| isExiting` (prevents spam-clicks during exit window). `SideSnoozeMenu` API refactored from `{taskIds, onSnooze}` to `{logIds, taskIds, onSnoozeAll}` matching `RemindersSection.tsx:117` precedent — batches column-wide exit for all rows simultaneously. Snoozed-view `ReminderCard` wrapped with conditional `agent-row-exit` className so Wake-now collapses cleanly. (B2) `wq-split-body` class added to SplitFileCard two-column body at `AgentRemindersList.tsx:502`; matching `@media (max-width: 640px)` rule added to `globals.css` (after `.wq-filter-pills` block). At 375px the two SideColumns now stack vertically with `gap: 8px`. **Initial-state UX decision (per Ellis):** urgency-group `collapsed` default changed from `{all: true}` → `{escalated: false, overdue: false, due_today: true, upcoming: true}` — act-now categories expanded, scan-when-time-permits categories collapsed. **Three §10 / §10.5 / §5 inventory corrections logged in the rows themselves** — Stage 1 claims about `agent-row-exit` already-wired status and `agent-dropdown-in` line cites were wrong (confused with `RemindersSection.tsx`); the four `ReminderCard` action-row entries in §5 labelled "snoozed view" actually described active-mode behaviour and don't render in work queue's snoozed-only consumption. | §5 (ReminderCard rows removed), §10 (Reminder row + Snooze dropdown rows corrected), §10.5 (`agent-dropdown-in` row corrected), AgentRemindersList.tsx, globals.css |
| 2026-05-12 | **Stage 3 voice pass complete.** Walked polish page top to bottom against `VOICE_GUIDELINES.md` three rules + tone calibration + translation table. Verified all 4 pre-flagged offenders. Surfaced 3 new violations: (1) Done button `title="Confirm milestone done"` → `title="Mark step done"` (Rule 2 schema jargon), applied to polish page; (2) SideColumn count noun "item/items" → "reminder/reminders" (Rule 3 specific over generic), applied to polish page; (3) `ReminderCard` expanded-details "Reminder rule: Chase after {milestone}…" contains schema jargon "milestone" — production-only, flagged for Stage 4. Refined all-caught-up copy from Stage 2's "show up" → "appear" for verb consistency with the zero-files canonical from `VOICE_GUIDELINES.md`. Sampled reminder-rule names from `prisma/seed.ts:331+` after `Chase:` stripping — acceptable industry copy, not violations. Added §7.1 side-by-side voice-review table. | §7.1 (new), polish page (3 rewrites) |

---

## 15. Canonical contributions

Track new canonical classes and tokens added during work queue Stage 2 (defined + documented) and Stage 4 (applied). See INVENTORY_TEMPLATE.md §15 for the full discipline.

**New canonical classes added during work queue Stage 2:**

| Class name | file:line in `agent-system.css` | Doc entry in `ANIMATION_STANDARDS.md` | Reason (1 sentence) |
|---|---|---|---|
| `.agent-card-hdr-warning` | After `.agent-card-title-emphasis` block (≈ line 705) | §S5 "Warning card header" + changelog 2026-05-12 | Card headers signalling a warning state without inline background overrides — paired with FileAlertsStrip. |

**New canonical tokens added during work queue Stage 2:**

| Token name | Defined in | Reason |
|---|---|---|
| `--agent-snoozed` | All six theme blocks in `themes.css` after the `--agent-info-border` block (theme-locked at `#7E22CE`) | Primary text colour for snoozed-state surfaces (snoozed banner, "Wake now" link). |
| `--agent-snoozed-bg` | Same blocks (theme-locked at `rgba(126, 34, 206, 0.08)`) | Surface background tint for snoozed banners. |
| `--agent-snoozed-border` | Same blocks (theme-locked at `rgba(126, 34, 206, 0.30)`) | Border tint for snoozed cards (left border + banner border-bottom). |
| `--agent-snoozed-rgb` | Same blocks (theme-locked at `126, 34, 206`) | rgba composition channel for inline tint variations if needed. |

**Library maturity note:** work queue Stage 2 added one new class + one new four-token family. Both are paired (warning header + snoozed semantic state) and resolve Stage 1 review Points 2 + Other-notes. SplitFileCard address-header decision was resolved as a markup pattern (no new class). FilterChip → `agent-segment-pill` and all dropdown items → `agent-dropdown-item` reuse existing canonical classes — no growth needed there.

**Stage 2 polish page:** `app/agent/polish/work-queue/page.tsx` — the visual contract Stage 4 will match against.
