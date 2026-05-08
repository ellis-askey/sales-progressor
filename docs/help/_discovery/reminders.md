# Reminders Page — Discovery Report

**Route:** `app/agent/work-queue/page.tsx`
**User-facing name:** Reminders (page h1 = "Reminders"; route slug = `work-queue`)
**Date:** 2026-05-08

---

## 1. Page structure — top to bottom

Route component: `app/agent/work-queue/page.tsx` — async Server Component.

### Header section

- Glassmorphism header with backdrop blur
- **h1:** "Reminders" (inline)
- **Subtitle:** "What needs chasing, today and ahead."
- **Stat segments** — rendered as inline anchor links with dot separators, shown only when count > 0:
  - Overdue count → anchors to `#section-overdue`, rendered in danger colour
  - Due today count → anchors to `#section-due_today`, rendered in warning colour
  - Coming up count → anchors to `#section-upcoming`, rendered in muted text

### Body

Two mutually exclusive states:

**State A — nothing at all (zero reminders AND zero active files):**
Full empty state card (see §7).

**State B — otherwise:**
1. `FileAlertsStrip` component — file-level structural alerts (solicitor missing, exchange overdue, stale files). Shown above the reminder list.
2. `AgentRemindersList` component — the main grouped reminder list.

### Data fetches (server side)

- `getAgentReminderLogs(vis)` from `lib/services/reminders.ts` — powers the main list
- `resolveAgentVisibility(session)` from `lib/services/agent.ts` — sets the scoping (seeAll vs userId)
- Active file count (used only to decide which empty state to show)

---

## 2. The reminder list

### Data source

`getAgentReminderLogs(vis)` — `lib/services/reminders.ts` (lines 94–149).

**Query shape:**
- `agencyId` always scoped to session user's agency
- Visibility scope applied: if `seeAll = false`, adds `WHERE agentUserId = vis.userId`
- Transaction filter: `status IN ("active", "on_hold")`, `serviceType != "outsourced"`
- Reminder log filter: `status = "active"` only
- Chase task filter: includes only pending tasks (`status = "pending"`)
- Selection: full `reminderRule` (name, description, graceDays, escalateAfterChases, anchorMilestone), full transaction with all contacts, up to 1 pending `chaseTask` with communications

**Auto-task creation side effect (lines 134–145):** Any active reminder with `nextDueDate <= now` and no pending task gets a pending task created during this fetch. This is a write during a "read" call.

**Server-side ordering:** `nextDueDate ASC`

**Client-side grouping and re-sorting in `AgentRemindersList`:**

Primary grouping → by transaction ID (file groups). Within each file group, reminders are split into urgency buckets:

| Bucket | Condition |
|---|---|
| Escalated | At least one pending task with `priority = "escalated"` |
| Overdue | `nextDueDate < today`, not escalated |
| Due today | `nextDueDate = today` |
| Coming up | `nextDueDate` within 3 business days, not overdue/today |

Secondary sort within each urgency bucket:
- Escalated, Overdue, Coming up: `nextDueDate ASC`
- Due today: alphabetical by reminder rule name

### Grouping display

- Single-reminder files → `ReminderCard`
- Multi-reminder files → `SplitFileCard` (Seller column + Buyer column, partitioned by VM*/PM* milestone codes)

### Pagination / page size

None. All reminders loaded in one fetch, no cursor/offset, no infinite scroll, no hard cap.

### Search and filter controls (client-side, `AgentRemindersList`)

Sticky filter bar with three controls:
1. **Text search** — matches on property address or reminder rule name
2. **Side filter** — All | Seller (VM* codes) | Buyer (PM* codes)
3. **Status filter** — Active | Snoozed (Snoozed shows a count badge)

All three filters apply client-side to the already-fetched data. No additional server round-trips.

---

## 3. Anatomy of a single reminder row

Two display modes:

### A. Active reminder card (`ReminderCard`, mode="active")

**Status bar (top strip):**
- Background and text colour conditional on urgency:
  - Escalated → red-50/60 bg, red-700 text
  - Overdue → orange-50/60 bg, orange-600 text
  - Due today → amber-50/60 bg, amber-600 text
  - Other → white/20 bg, slate-900/50 text
- Left text: urgency label ("Escalated", "Overdue Nd", "Due today", "Active from [date]")
  - Escalated variant also shows "+ N days overdue" or "+ due today" if applicable
- Right text (conditional): chase summary if `chaseCount > 0` — format: "N chase(s) sent · last [relative time] via [method]"

**Body:**
- Property address (optional link, shown when `showAddressLink = true`)
- Contact name (party-filtered from transaction contacts)
- Reminder rule name — **"Chase: " prefix stripped** from display
- Rule description (if present)
- "Waiting on Seller" / "Waiting on Buyer" pill (if `targetMilestoneCode` indicates party)

**Bottom action row:**
- Left: "Show details" / "Hide details" toggle (if expanded content available)
- Right (only if pending task exists):
  - **Confirm** button (CheckCircle icon) — marks reminder done
  - **Chase** button — opens `ChaseDrawer` modal
  - **Snooze** dropdown (Clock icon) — options: 24h, 48h, 72h, 7d, 14d
  - **Kebab menu** (⋯) — options:
    - "Chased manually" (records a chase without sending anything)
    - "↑ Escalate" (disabled/hidden if already escalated)

**Expanded details panel** (toggled by "Show details"):
- Last contact across whole file: method + relative time, or "No contact logged yet"
- Chase count: "Not yet chased" or "Chased Nx already"
- If reminder is not in a grouped `SplitFileCard`: "N other reminder(s) active on this file"
- Anchor milestone: "Reminder rule: Chase after [milestone name]" + optional grace days

### B. Snoozed reminder card (`ReminderCard`, mode="snoozed")

**Status bar:**
- Purple-50/60 bg, purple-600 text
- Left: "Wakes [date]"
- Right: "Wake now" button

**Body:** Same fields as active (address, contact, name, party pill)

**No action buttons** — snooze, confirm, chase are all absent/disabled while snoozed.

---

## 4. Actions on a reminder

All server actions from `app/actions/tasks.ts`.

### A. Confirm — `completeTaskAction(taskId, "/agent/work-queue")`

Triggered by: "Confirm" button click.

Database changes:
- Task `status → "done"`
- If `reminderRule.targetMilestoneCode` set: calls `completeMilestone()` → marks milestone complete if prerequisites pass; on failure, falls back to closing reminder log directly
- `autoCompleteRemindersForMilestone()` closes all reminder logs targeting that milestone
- Reminder engine re-evaluated for downstream reminders

Email/notification: Milestone completion email sent to portal contacts if milestone is confirmed (via `sendAdminMilestoneNotificationToPortal()` — this is the milestone completion path, not reminder-specific).

User sees: Card slides out (max-height 0, opacity 0, 280ms) with -8px margin-bottom. Page revalidates.

### B. Snooze — `snoozeTaskAction(taskId, snoozeHours, "/agent/work-queue")`

Triggered by: Snooze dropdown option selection.

Database changes:
- Task `status → "cancelled"`
- Reminder log `snoozedUntil = now + snoozeHours`
- Reminder log `nextDueDate = snoozedUntil`

No email fires.

User sees: Card disappears immediately (removed from `hiddenIds` set optimistically). Snoozed count badge increments. Card reappears in "Snoozed" tab.

### C. Wake snooze — `wakeupReminderAction(logId, "/agent/work-queue")`

Triggered by: "Wake now" button on snoozed card.

Database changes:
- Reminder log `snoozedUntil → null`
- Reminder log `nextDueDate → now`

User sees: Snoozed card disappears. On revalidation reappears in Active section (likely as "Coming up" or "Due today" depending on timing).

### D. Chase sent — `advanceChaseTaskAction(taskId, "/agent/work-queue")`

Triggered by: ChaseDrawer after successful email/WhatsApp send (called manually in AgentRemindersList line 308).

Database changes:
- Chase count incremented by 1 on task
- If `chaseCount >= rule.escalateAfterChases`: task auto-escalated

No additional email fires from this action itself (the chase email was already sent by ChaseDrawer).

User sees: Chase summary in status bar updates — "N chases sent · last just now via [method]".

### E. Escalate — `escalateTaskAction(taskId, "/agent/work-queue")`

Triggered by: Kebab menu → "↑ Escalate".

Database changes:
- Task `priority → "escalated"`

No email fires.

User sees: Status bar changes to red. Card moves to Escalated group on next revalidation. Escalate option disappears from kebab.

### F. Record manual chase — `recordManualChaseAction(taskId, "/agent/work-queue")`

Triggered by: Kebab menu → "Chased manually".

Database changes:
- Chase count incremented
- `OutboundMessage` created: `type = "outbound"`, `content = "Chased manually (recorded by agent)"`

No email fires.

User sees: Chase summary updates in status bar.

### G. Reminder engine run — `runReminderEngineAction("/agent/work-queue")`

Triggered by: `useEffect` on mount of `AgentRemindersList` (runs every page load automatically).

What it does: Bulk re-evaluation of all active transactions; creates pending tasks for any due reminder logs that don't have one. Page revalidates after run.

---

## 5. Hub preview vs full Reminders page

### Query comparison

**Hub:** `getHubAttentionItems(vis)` in `lib/services/hub.ts`
- Filters: `status = "active"`, `snoozedUntil IS NULL OR snoozedUntil <= now`, **`nextDueDate <= today`** (hard cap — only current/past due items)
- Selection: minimal (id, nextDueDate, reminderRule.name, transaction.{id, address}, 1 pending task)
- Max shown: 3 (sorted client-side: escalated → overdue → due_today by urgency, then nextDueDate)

**WorkQueue:** `getAgentReminderLogs(vis)` in `lib/services/reminders.ts`
- Filters: `status = "active"` — **no `nextDueDate <= today` cap** (shows future/upcoming items too)
- Selection: full reminderRule, full transaction with all contacts
- Max shown: unlimited
- Ordering: nextDueDate ASC server-side; then client re-sorts into urgency groups

**Difference:** Hub shows only current/overdue items (nextDueDate ≤ today). WorkQueue shows all active reminders including upcoming ones.

### Row component comparison

- Hub: `AttentionListView` (`components/hub/AttentionListView.tsx`) — simple linked rows, no actions
- WorkQueue: `AgentRemindersList` → `ReminderCard` / `SplitFileCard` — full interactive controls

These are entirely separate components. The WorkQueue list is not a superset of AttentionListView.

### How user moves between them

Hub attention section header → "Reminders" link (line 62, `AttentionListView.tsx`) → `/agent/work-queue`.

Hub "Need attention" stat in pipeline health card → `/agent/work-queue` (if count > 0).

---

## 6. Director vs negotiator differences

**Director:**
- `resolveAgentVisibility()` returns `seeAll = true`
- `getAgentReminderLogs` WHERE clause: no `agentUserId` restriction → sees all agency reminders

**Negotiator (no canViewAllFiles):**
- `resolveAgentVisibility()` returns `seeAll = false`
- `getAgentReminderLogs` WHERE clause adds: `agentUserId = vis.userId` → sees only their own assigned files' reminders

**Negotiator (with canViewAllFiles):**
- Treated same as director for scoping — `seeAll = true`

**UI:** Same layout for all roles. No role-specific UI elements, no scope label shown. The user sees only data they're permitted to see, but there's no indicator explaining why.

---

## 7. Empty state

**Condition:** `reminderLogs.length === 0 AND activeFileCount === 0`

**Container:** `glass-card`, `padding: 48px 24px`, `text-align: center`

**Icon:** Bell (Phosphor), `weight="regular"`, 32×32, `color: var(--agent-text-muted)`, `opacity: 0.45`, `margin: 0 auto 16px`

**Heading (verbatim):**
> Your reminders will appear here

Font size 15px, weight 600, colour `var(--agent-text-primary)`, margin `0 0 6px`.

**Body (verbatim):**
> Once you create a sale, we'll surface chases and follow-ups as files progress.

Font size 13px, colour `var(--agent-text-muted)`, max-width 340px, line-height 1.5, margin `0 auto`.

**Other empty states — see sections 7a and 7b below for verified detail:**
- Zero reminders but active files exist → `AgentRemindersList` renders an "All caught up" success card (section 7a)
- Filtered to zero results → three distinct messages depending on which filter is active (section 7b)

---

## 7a. Active files, zero reminders due

**Source:** `components/reminders/AgentRemindersList.tsx` lines 522–533.

**Condition:** `logs.length === 0` (passed from server — means no active reminder logs exist for this agency/user scope). This renders when the agency has active files but nothing is currently due, overdue, or upcoming within 3 business days.

**What renders:** A green success card inside the list container, not the Bell-icon empty state.

**Container:** `glass-card`, `padding: "40px 32px"`, `textAlign: "center"`

**Icon:** CheckCircle (Phosphor), `weight="fill"`, 32×32, `color: "var(--agent-success)"`, `margin: "0 auto 10px"`

**Heading (verbatim):**
> All caught up

Font size 14px, weight 600, colour `var(--agent-text-primary)`, margin 0.

**Body (verbatim):**
> No reminders due right now. We'll surface them here as files progress.

Font size 12px, colour `var(--agent-text-muted)`, margin `"4px 0 0"`.

**What is NOT shown:** Filter bar, urgency group headers, stat segments in the page header. The page header stat segments only appear when the relevant count > 0, so with zero reminders the header shows only the title and subtitle.

**Important:** There is also a silent edge case — reminders that exist but are classified as `null` by `classifyActive` (due more than 3 business days away) pass through `filteredActive` (`hasActiveResults = true`) but appear in no urgency group. In this case: the filter bar renders, all four urgency section headers render as empty and return `null`, and nothing else shows. No explicit message. A blank area below the filter bar. This state is reachable when a file has reminders scheduled well in advance and nothing is urgent yet.

---

## 7b. Filtered to zero results

**Source:** `components/reminders/AgentRemindersList.tsx` lines 580–591 (active tab) and lines 666–669 (snoozed tab).

**When it triggers:** User has applied search, side filter, or status filter; active file count > 0 and logs exist, but no items match.

**Filter bar:** Always visible — sticky at top regardless of results.

### Active tab (statusFilter = "active"), zero matches

Three distinct messages depending on what caused the zero result (lines 584–589):

**Side filter active (Seller or Buyer chip selected):**
> No reminders for Seller right now.

or

> No reminders for Buyer right now.

**Text search active, no side filter:**
> No reminders match the current filter.

**Neither filter active but still zero active results** (e.g. all items are snoozed):
> No active reminders.

Container for all three: `glass-card px-5 py-8 text-center`, `<p className="text-sm text-slate-900/40">`.

### Snoozed tab (statusFilter = "snoozed"), zero matches

**No text search active:**
> No snoozed reminders.

**Text search active:**
> No snoozed reminders matching filter.

Container: `glass-card px-5 py-6 text-center`, `<p className="text-sm text-slate-900/40">`.

---

## 8. Live component extraction assessment

| Element | Score | File | Reason |
|---|---|---|---|
| Header stat segments | **Easy** | Inline in page.tsx | Pure JSX, serialisable data, simple anchor hrefs |
| FileAlertsStrip | **Medium** | `components/agent/FileAlertsStrip.tsx` (verify path) | Alert config colours, expand/collapse, links to transaction params — extractable with mock data |
| AgentRemindersList (full list) | **Hard** | `components/reminders/AgentRemindersList.tsx` | Complex client state: hiddenIds, search, side filter, status filter, collapsed groups, optimistic snooze count, ChaseDrawer integration |
| ReminderCard (single row) | **Medium** | `components/reminders/ReminderCard.tsx` (verify path) | Conditional urgency colours, expand/collapse, disabled loading states, slide-out animation — mock-able with static data |
| SplitFileCard (two-column) | **Hard** | Inline in `components/reminders/AgentRemindersList.tsx` (lines 317–413) | Dual Seller/Buyer column render, milestone code routing, ChaseDrawer integration, per-task snooze handlers |
| Snooze dropdown | **Easy** | Inline or small component | Simple menu with fixed option list |
| Kebab menu | **Easy** | Inline or small component | Simple menu, action dispatch |
| Filter chips bar | **Easy** | Inline in AgentRemindersList | Simple button state toggle |
| Empty state | **Easy** | Inline in page.tsx | Pure JSX, no props needed |

---

## 9. Worth flagging

1. **Auto-task creation during data fetch.** `getAgentReminderLogs` creates pending tasks as a side effect of its SELECT call (lines 134–145 in reminders.ts). A "read" operation has write side effects. This means every page load may mutate the database if reminders are due. Race conditions possible if two users load the page simultaneously for the same agency.

2. **Reminder engine runs on every mount.** `runReminderEngineAction()` fires in `useEffect` unconditionally on every `AgentRemindersList` mount. For a director with 100+ files, this is a potentially expensive bulk re-evaluation triggered by any page load. No debounce, no cache, no flag to skip if engine ran recently.

3. **Hub and WorkQueue use different queries, not the same function.** The Hub shows only `nextDueDate <= today` items. WorkQueue shows all active reminders including upcoming ones. They diverge in a semantically meaningful way — a reminder "coming up in 3 days" appears on WorkQueue but not on the Hub preview. The article should clarify this distinction explicitly.

4. **"Chase: " prefix stripped in display but stored in the name.** The rule names in the database include a "Chase: " prefix (e.g., "Chase: Vendor solicitor — contract pack"). The UI strips it in display. If the user sees a different name on the Hub vs in a notification vs in the activity log, this could cause confusion.

5. **Snoozed items sorted by undefined order.** The snoozed tab preserves server fetch order (`nextDueDate ASC` from the original query, which was set to `snoozedUntil` at snooze time). This means items waking soonest appear first, which is the right behaviour — but it's an emergent consequence of how `nextDueDate` is updated on snooze, not an explicit sort.

6. **Multi-milestone ChaseDrawer discrepancy.** In `SplitFileCard` with multiple milestones, max `chaseCount` across all milestones determines the tone, but only the first milestone's `chaseTaskId` is passed to ChaseDrawer. If the file has separate Seller and Buyer reminders, the chase recorded after sending may only increment one task's count, leaving the other's count stale.

7. **"All caught up" empty state exists inside AgentRemindersList (separate from the page-level Bell empty state).** When `logs.length === 0` but `activeFileCount > 0`, the component renders a green CheckCircle success card ("All caught up" / "No reminders due right now..."). Distinct from the Bell-icon empty state on the page. The article should describe both. See section 7a.

8. **Visibility scope not surfaced in the UI.** A negotiator without canViewAllFiles sees only their own reminders, but the page title, header, and empty state give no indication of this scope. If a negotiator calls a director and asks "why does your Reminders page look different from mine?", there's nothing in the UI to explain.

9. **FileAlertsStrip "stale" alert has no action.** The strip shows up to 4 alert types. "Stale" (no progress in 14+ days) shows a badge but no action button — unlike the solicitor-missing and exchange-overdue alerts which link to the file. A user may not know what to do with a stale alert.

10. **No explicit "stalled files" link on the Hub.** The Hub discovery claimed "stalled files links to /agent/work-queue." The actual code: the Hub pipeline health card has a "Need attention" stat cell linking to `/agent/work-queue` (if overdue/escalated count > 0). Stalled files count appears in the "Coming up" strip as its own row — clicking it links to the All Files page filtered, not to WorkQueue. The "stalled files → WorkQueue" claim is inaccurate.

---

## 10. Pre-existing assumptions verified

**a. Hub "Reminders" link in attention header → `/agent/work-queue`**
✓ Confirmed. `AttentionListView.tsx` line 62: `<Link href="/agent/work-queue">Reminders</Link>`

**b. Hub "Stalled files" row links to `/agent/work-queue`**
✗ Incorrect. Stalled files stat links to All Files page (filtered), not WorkQueue. The Hub's "Need attention" stat cell (overdue/escalated reminders count) links to `/agent/work-queue` — but that is a different UI element from the stalled files indicator.

**c. `getHubFlags()` from TransactionFlag table exists**
✓ Confirmed. Exported from `lib/services/hub.ts` (line ~281). Returns `transactionFlags` filtered by severity.

**d. `getHubFlags()` does not appear on the Reminders page**
✓ Confirmed. `app/agent/work-queue/page.tsx` does not import or call `getHubFlags()`. Flags appear to be a hub-only feature.

**e. 3-item cap on Hub is the only difference; Reminders shows same ordering**
✗ Partially incorrect. The Hub cap (3 items) is one difference. The more significant difference: Hub filters `nextDueDate <= today` (only current/overdue). WorkQueue does not have this filter — it shows upcoming items too. The ordering within urgency groups is similar but not identical.

---

## 11. UI label check

**Route:** `/agent/work-queue`
**Live page h1:** "Reminders"
**Subtitle:** "What needs chasing, today and ahead."

No "Work Queue" label visible to users anywhere on the page. The internal codebase naming (file paths, function names, component names) uses `work-queue` and `WorkQueue`. The user-facing name is exclusively "Reminders." The article should use "Reminders" throughout. ✓

---

## Reporting

```
Discovery complete for: Reminders
Report file: docs/help/_discovery/reminders.md
Word count: ~2,600
Code references: 40+
Worth-flagging items: 10
```
