# Phase 3 · Surface 3 · Agent Reminders / Work Queue · Behavioural Baseline

**Route:** [`/agent/work-queue`](../../../app/agent/work-queue/page.tsx)
**Page title:** "Reminders" (route slug differs from heading — BUILD_PLAN.md updated 2026-06-30).
**Status:** baseline pinned per [Law 17](../../../CLAUDE.md#law-17--behavioural-baseline-before-remediation).
**Drafted:** 2026-06-30.

---

## 1. Route + auth

- **Route:** `app/agent/work-queue/page.tsx` — single async server component.
- **Layout:** `AgentShell`.
- **Auth:** `requireSession()`.
- **Allowed roles:** `director`, `negotiator`, `sales_progressor`, `admin`, `viewer`.
- **Excluded:** `superadmin`.

---

## 2. Data fan-out

Three parallel queries:

| # | Fetcher | Returns | Used by |
|---|---|---|---|
| 1 | `getWorkQueueItems(vis)` | Files with file-level alerts (escalation, stalled, on hold ending soon) | `FileAlertsStrip` |
| 2 | `getAgentReminderLogs(vis)` | Reminder log rows scoped by visibility | header counts + `AgentRemindersList` |
| 3 | `prisma.propertyTransaction.count(...)` | Active+on-hold file count | empty-state branching |

Visibility derivation matches the hub: `resolveInternalVisibility(...)` for internal staff, `resolveAgentVisibility(...)` for agent staff.

---

## 3. Render branches

### 3a. True empty state — no reminders AND zero active files
- `PageHeader` with stat segments (none rendered because counts are zero)
- Centered "Your reminders will appear here" / "No files assigned yet" composer with Bell icon
- Ghost reminder-group preview (opacity 0.35, pointer-events none)

### 3b. Files exist but no reminders
- `PageHeader` (no stat pills)
- `FileAlertsStrip` if any items
- `AgentRemindersList` self-renders its own empty state

### 3c. Full work queue
- `PageHeader` with stat pills (overdue / due today / coming up)
- `FileAlertsStrip` (file-level alerts banner)
- `AgentRemindersList` rendering the grouped reminder rows

---

## 4. Role variations

| Role | hideChase | Notes |
|---|---|---|
| director | false | Full functionality |
| negotiator | false | Same as director |
| sales_progressor | false | Subtitle becomes "What needs chasing across your assigned files." |
| admin | true | Chase buttons hidden (`hideChase` prop on `AgentRemindersList`) |
| viewer | false | Treated like progressor for subtitle |

---

## 5. Visual primitives in use (component inventory)

### Cards (`agent-glass-strong`)

| File | Count | Notes |
|---|---|---|
| `app/agent/work-queue/page.tsx` | 1 | True-empty-state centered card |
| `components/reminders/AgentRemindersList.tsx` | 4 | Filter bar (sticky), empty-after-filter card, no-snoozed empty, group cards (overdue/due-today/upcoming) |
| `components/reminders/ReminderCard.tsx` | 1 | Outer chrome of each reminder row |
| `components/reminders/FileAlertsStrip.tsx` | 1 | Strip chrome |
| **Total** | **7** | Same `agent-glass*` chrome question as Surface 2 |

### Buttons (`agent-btn`)

| Location | Class | Action |
|---|---|---|
| `AgentRemindersList.tsx:171` | `agent-btn-sm agent-btn-ghost` | Snooze popover trigger (single row) |
| `AgentRemindersList.tsx:257` | `agent-btn-sm agent-btn-secondary` | Snooze popover trigger (bulk) |
| `AgentRemindersList.tsx:483` | `agent-btn-sm agent-btn-ghost-bordered` | "Mark as chased" — grandfathered variant |
| `AgentRemindersList.tsx:493` | `agent-btn-sm agent-btn-secondary` | Secondary action button |
| `AgentRemindersList.tsx:536` | `agent-btn-sm agent-btn-primary` | "Chase" → opens ChaseDrawer |

### Accordions (`agent-acc`)

| File | Pattern | Notes |
|---|---|---|
| `AgentRemindersList.tsx:977` | Group section open/close | Two-zone header (label + count). Same primitive-API gap as Surface 1 group accordions — grandfather |
| `FileAlertsStrip.tsx:77` | Strip body open/close | Same shape |

### Popovers (`createPortal`)

| File | Count | Purpose |
|---|---|---|
| `AgentRemindersList.tsx` | 2 | Snooze menu (row + bulk) |
| `ReminderCard.tsx` | 2 | Per-card snooze + escalate menus |
| **Total** | **4** | NOT modals/drawers. Positioned popovers (anchored to button). No canonical Popover primitive exists. Grandfather. |

### Skeletons (`agent-skeleton`)

`app/agent/work-queue/page.tsx` true-empty ghost preview (~6 instances). Same swap target as hub loading.tsx — wrap with `<Skeleton>` primitive.

### Externally-owned components on this surface

- `ChaseDrawer` (consumed; lives in `components/chase/`, scoped to its own surface arc)
- `PageHeader`, `StatPill` (canonical layout primitives — already DoD-compliant)
- `Bell`, other Phosphor icons

These are NOT in scope for Surface 3 remediation.

---

## 6. Mutations + side-effects

| Source | Action | Effect |
|---|---|---|
| ReminderCard snooze popover | `snoozeTaskAction(...)` | Reminder snoozed; row moves to Snoozed group |
| ReminderCard escalate popover | `escalateTaskAction(...)` | Escalates to internal staff |
| ReminderCard complete | `completeTaskAction(...)` | Marks reminder done |
| AgentRemindersList "Chase" button | opens `ChaseDrawer` → drawer fires `advanceChaseTaskAction` | Advances chase + sends email |
| AgentRemindersList "Mark as chased" | `advanceChaseTaskAction(...)` (no email) | Advances chase counter without sending |
| AgentRemindersList bulk snooze | `snoozeTaskAction(...)` per log | Snoozes all in group |
| AgentRemindersList wakeup | `wakeupReminderAction(...)` | Un-snoozes |
| AgentRemindersList run-engine (admin) | `runReminderEngineAction()` | Manually triggers reminder engine |

---

## 7. Voice violations on this surface

Identified during baseline scan:

| Line | Current | Problem |
|---|---|---|
| `AgentRemindersList.tsx:55` | `"Client chased automatically, then opted out. Now manual — please follow up."` | "automatically" + em-dash |
| `AgentRemindersList.tsx:61` | `"Can't chase automatically — the client contact has no email address. Manual chase needed."` | "automatically" + em-dash |
| `AgentRemindersList.tsx:63` | `"Can't chase automatically — the client contact has no portal access. Manual chase needed."` | "automatically" + em-dash |

These are duplicates of `RemindersSection.tsx` strings I fixed in Wave C of Surface 1. The duplication is intentional ([file comment §20-23](../../../components/reminders/AgentRemindersList.tsx)). Same swaps apply.

---

## 8. Outbound navigation

Internal nav only:
- `PageHeader` StatPill → anchor-link to `#section-overdue` / `#section-due_today` / `#section-upcoming`
- ReminderCard contains `<Link href="/agent/transactions/${txId}">` for the row title (per-card)

No external Links from this surface.

---

## 9. Loading + error states

- **Loading**: no `loading.tsx` exists. Suspense not used at the page level. Page renders synchronously after `Promise.all` resolves.
- **Error**: no error boundary at the work-queue level. Fetcher rejections bubble to Next's `error.tsx`.

---

## 10. Known oddities to preserve

- The "Snoozed" + "Completed" groups in `AgentRemindersList` open/close via a Show/Hide link **inside** the header (same headless-acc-body pattern grandfathered in Wave A4)
- The sticky filter bar at the top of `AgentRemindersList` (`agent-glass-strong` + sticky position) — deliberately matches `FileAlertsStrip` so the two surfaces feel like one strip when both visible
- `runReminderEngineAction()` button is admin-only; intentionally inline (no debounce, no confirmation) — flagged to NOT add a confirmation modal as side-effect
- The duplicated `fallbackChipText` helper between `AgentRemindersList` and `RemindersSection` is intentional per source comment
- Stat-pill counts use `classifyForStats` (a local function) that delegates to `classifyReminder` then post-filters by 3-business-day window — do not "simplify"

---

## 11. Scope lock for Surface 3 remediation

- **In scope**: `app/agent/work-queue/page.tsx`, `components/reminders/AgentRemindersList.tsx`, `components/reminders/FileAlertsStrip.tsx`, `components/reminders/ReminderCard.tsx`
- **Out of scope**: `ChaseDrawer` (its own surface), `AutomatedEmailsCard*` (file-detail surface, already covered Surface 1 Wave A4), all server services in `lib/services/`, `PageHeader`/`StatPill` (canonical layout primitives), `Bell` icon

This Surface 3 baseline is pinned 2026-06-30.
