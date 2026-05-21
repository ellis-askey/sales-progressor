# Inventory: To-Do

**Route:** `/agent/to-do`
**Date:** 2026-05-17
**Stage 1 status:** Draft — pending Ellis sign-off
**Amendments:** (see Section 14 — added if mid-flight discoveries occur in Stage 2)

---

## 1. Page identity

| Field | Value |
|---|---|
| Route | `/agent/to-do` |
| File | `app/agent/to-do/page.tsx` |
| Component type | Mixed — server component (data fetch) wrapping client component (`AgentTodoList`) |
| Who sees it | Director, Negotiator — no role distinction; both see identical page |
| How they reach it | Sidebar nav "To-Do" link |
| Reachable without a transaction? | Yes — tasks can exist without a linked transaction ("Quick notes") |

---

## 2. Components rendered

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `AgentShell` | `components/layout/AgentShell.tsx` | No changes — already matches polish | Wraps the page; sidebar, topbar, toaster |
| `PageHeader` | `components/layout/PageHeader.tsx` | No changes — already matches polish | Title "To-Do", subtitle, up to 3 StatPills |
| `StatPill` | `components/layout/StatPill.tsx` | No changes — already matches polish | Up to 3 pills: N to-dos / N with progressor / N overdue |
| `AgentTodoList` | `components/agent/AgentTodoList.tsx` | Match polish page | Client component — owns all list rendering, state, and interactions |
| `AddManualTaskForm` | `components/todos/AddManualTaskForm.tsx` | Match polish page | Toggle-to-expand form; ownership selector; mocked in Stage 2 (inline mock) |
| `Section` (inner) | `components/agent/AgentTodoList.tsx` (inline) | Match polish page — part of AgentTodoList | "My to-dos" and "With your progressor" section structure |
| `TaskGroup` (inner) | `components/agent/AgentTodoList.tsx` (inline) | Match polish page — part of AgentTodoList | `glass-card` per transaction group with address header and task rows |
| `TaskRow` (inner) | `components/agent/AgentTodoList.tsx` (inline) | Match polish page — part of AgentTodoList | Completion circle toggle + content + due/created date |

**Note on `AgentRequestsPanel`:** PAGE_LIST.md records that `components/agent/AgentRequestsPanel.tsx` was preserved specifically for future `/agent/to-do` redesign wire-in when the dashboard was merged into transaction-list. It is **not imported on this page** — `AgentTodoList` does all work. Do not import it during this polish pass.

**Stage 2 mock note:** `AddManualTaskForm` is a client component with live `fetch` calls to `/api/manual-tasks`. The polish page should inline a visual mock of both the collapsed state (button) and the expanded state (form) rather than importing the live component.

---

## 3. Data dependencies

| Data | Source | Shape | Notes |
|---|---|---|---|
| `tasks` | `listAllTasksForAgent(userId, agencyId)` → `prisma.manualTask.findMany({ where: { agencyId, createdById: userId } })` | `ManualTaskWithRelations[]` | All tasks (open + done) created by the logged-in user in their agency |
| `session.user.id` | `requireSession()` | `string` | Used as `createdById` filter — agent sees only their own tasks |
| `session.user.agencyId` | `requireSession()` | `string` | Multi-tenancy filter — never exposed to client |

**`ManualTaskWithRelations` shape (relevant fields):**
```
id, title, notes, progressorNote, progressorNoteAt,
status ("open" | "done"), dueDate, createdAt,
isAgentRequest (boolean — true → progressor section),
transactionId (nullable — null → "Quick note"),
transaction: { propertyAddress } | null,
assignedTo, createdBy
```

**Null / empty handling:**
- `tasks = []` → whole-page empty state (AddManualTaskForm + glass-card empty card + ghost preview). See Section 4.
- `tasks.length > 0` but all are `isAgentRequest` → "My to-dos" section renders with its own section-level empty state.
- `tasks.length > 0` but none are `isAgentRequest` → "With your progressor" section not rendered at all.
- `task.transactionId = null` → group header shows "Quick note" span (not a link).
- `task.transaction?.propertyAddress = null` (with non-null transactionId — edge case) → link shows "Unknown address".
- `task.dueDate = null` → no due status shown; created date shown instead.
- `task.progressorNote = null` → progressor note block not rendered.

---

## 4. States

### Standard states

| State | Trigger condition | What the user sees |
|---|---|---|
| **Loading** | Server component fetch in progress | `loading.tsx` skeleton: PageHeader + two stat-pill skeletons + add-form skeleton + "My to-dos" section (2 glass-card groups) + "With your progressor" section (1 glass-card group) |
| **Populated** | `tasks.length > 0` | AddManualTaskForm (collapsed) + "My to-dos" section + conditionally "With your progressor" section |
| **Whole-page empty** | `tasks.length === 0` | AddManualTaskForm + glass-card empty card + ghost section preview. See copy below. |
| **Error** | Server throws / Prisma connection fails | Root `app/error.tsx` boundary (no page-specific `error.tsx`) |
| **Permission denied** | `requireSession()` fails | Redirect to login |

### Page-specific states

| State | Trigger condition | What the user sees |
|---|---|---|
| **"My to-dos" section empty** | `tasks.length > 0` AND all own tasks are done (`ownOpen.length === 0`) | Section renders with header. Body: glass-card with "All clear." + "Use the button above to add a to-do or send a request." |
| **"With your progressor" section hidden** | `progTasks.length === 0` (no agent-request tasks exist, open or done) | Section not rendered at all — no heading, no card, no empty state |
| **"With your progressor" section empty** | `progTasks.length > 0` AND all progressor tasks are done (`progOpen.length === 0`) | Section renders with header. Body: glass-card with "No pending requests." + "Anything you send to your progressor will appear here." |
| **"My to-dos" has overdue sub-group** | `ownOverdue.length > 0` | "Overdue" sub-label (amber or red, see below) above overdue task groups, before upcoming groups |
| **"With your progressor" has overdue sub-group** | `progOverdue.length > 0` | Same "Overdue" sub-label pattern within the progressor section |
| **Red overdue state** | Any task in overdue group has `dueDate` ≥ 4 days ago | Sub-label and overdue pill on page header render red (`#dc2626` → `var(--agent-danger)`) instead of amber |
| **Done section visible** | User clicks "Show N resolved" | Done task groups appear below open groups, dimmed (opacity 0.7). Toggle flips to "Hide resolved". |
| **Task loading** | User clicks completion circle | Circle shows spinner. Button `disabled`. No toast — silent state transition. |

**KEY UNCERTAINTY RESOLVED — "With your progressor" empty states:**

Three distinct scenarios; no shared logic between them:

1. **`tasks.length === 0`** — whole-page empty state. Both sections absent. Single glass-card card with icon + "Nothing here yet." + "Jot down your next steps, or send a request to your progressor." + ghost preview below.

2. **`tasks.length > 0`, `progTasks.length === 0`** — "With your progressor" section is NOT RENDERED at all. The condition is `{progTasks.length > 0 && <Section ... />}`. No empty-state card is shown for the progressor section.

3. **`tasks.length > 0`, `progTasks.length > 0`, `progOpen.length === 0`** — "With your progressor" section renders (because progTasks exist — all done), with its own section-level empty state: "No pending requests." + "Anything you send to your progressor will appear here."

"My to-dos" section ALWAYS renders when `tasks.length > 0`, with its own section empty state when all own tasks are done.

---

## 5. Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| "Add to-do" button | Top of list, always visible | Expands `AddManualTaskForm` inline | Never disabled | — |
| Title input | Add form (expanded) | Sets task title | — | Required for submit |
| Notes textarea | Add form (expanded) | Optional task notes | — | — |
| "Mine" / "Sales Progressor" ownership toggle | Add form, when `showOwnership=true` | Sets `isAgentRequest` | Never | — |
| Date input | Add form (expanded) | Sets due date; `min=today` | Never | Native date picker; past dates blocked client-side with error "Due date cannot be in the past." |
| "Cancel" link | Add form (expanded) | Resets and collapses form | Never | — |
| "Add" submit button | Add form (expanded) | `POST /api/manual-tasks`, adds task to local state | `saving || !title.trim()` | `disabled` attr; visually dimmed |
| Completion circle | Each task row | `PATCH /api/manual-tasks/${id}`, toggles open ↔ done | While `loading=true` | Shows spinner; `cursor: wait` |
| Address link | TaskGroup header (when transactionId set) | Navigate to `/agent/transactions/${transactionId}` | Never | — |
| "Show N resolved" toggle | Below open tasks in each section | Reveals done groups | Never | — |
| "Hide resolved" toggle | Same position, when done visible | Hides done groups | Never | — |

---

## 6. Conditional renders

```
tasks.length === 0
  → full-page empty card + ghost preview
  → AgentTodoList returns early with AddManualTaskForm + empty UI

tasks.length > 0
  → AgentTodoList renders Section components

progTasks.length > 0
  → "With your progressor" Section rendered
  → else: not rendered (no heading, no empty state)

overdueGroups.length > 0 (within a Section)
  → "Overdue" sub-label appears above overdue TaskGroups
  → else: no sub-label

sectionHasRedOverdue (within a Section)
  → overdue sub-label colour: #dc2626 (→ var(--agent-danger))
  → else: var(--agent-warning)

hasOpen === false (own tasks all done, within Section)
  → section-level glass-card empty state:
      progressor=false → "All clear." + "Use the button above..."
      progressor=true  → "No pending requests." + "Anything you send..."
  → else: render openGroups or null

openGroups.length > 0 (within a Section)
  → renders open TaskGroups
  → if hasOpen but openGroups.length === 0 (only overdue exist): null branch

doneCount > 0 (within a Section)
  → "Show N resolved" / "Hide resolved" toggle visible
  → showDone → done TaskGroups rendered below (dimmed, opacity 0.7)

group.transactionId !== null (within TaskGroup)
  → group header: <Link> with address
  → else: <span>"Quick note"</span>

task.notes !== null (within TaskRow)
  → notes paragraph rendered

task.progressorNote !== null (within TaskRow)
  → amber note block rendered (label "Progressor · date" + note text)

task.dueDate !== null && !isDone (within TaskRow)
  → due status shown (label + colour from getDueStatus())
  → progressor && dueStatus.reassure → "Our team is on it" reassurance

progressor && dueStatus.reassure
  → "Our team is on it" (shown for progressor tasks due today / yesterday / 1–3 days overdue)

showOwnership (AddManualTaskForm prop)
  → ownership "Mine" / "Sales Progressor" toggle rendered
  → always true on the to-do page (AgentTodoList passes showOwnership)

transactionAddress (AddManualTaskForm prop)
  → address line rendered inside form
  → not set on this page (form is standalone, not transaction-scoped)
```

---

## 7. Copy inventory

**Verbatim rule:** every string exactly as rendered.

```
# Page header
"To-Do"                                         [page title]
"Your notes, plus anything you've flagged to your progressor."  [subtitle]
"[N] to-do" / "[N] to-dos"                     [StatPill — singular / plural — anchor: #section-mine]
"[N] with progressor"                           [StatPill — anchor: #section-progressor]
"[N] overdue"                                   [StatPill — anchor: #section-mine, color: danger]

# Whole-page empty state (tasks.length === 0)
"Nothing here yet."                             [empty state headline]
"Jot down your next steps, or send a request to your progressor."
                                                [empty state body — "your progressor": approved term per translation table]

# Ghost preview (opacity 0.3, within whole-page empty state — STAGE 4 TARGET: replace with abstract skeleton bars)
"My to-dos"                                     [ghost section title — fake content to be removed]
"2"                                             [ghost count badge — fake]
"14 Maple Close, Birmingham"                    [ghost address — FAKE CONTENT, violates abstract-skeleton precedent]
"Chase vendor solicitor for draft contracts"    [ghost task text — FAKE CONTENT, violates abstract-skeleton precedent]
"Today"                                         [ghost date — FAKE CONTENT]
"Request mortgage offer from broker"            [ghost task text — FAKE CONTENT]
"Tomorrow"                                      [ghost date — FAKE CONTENT]

# AddManualTaskForm — collapsed state
"Add to-do"                                     [button text — agent-btn-ghost-bordered]

# AddManualTaskForm — expanded state
"What needs to be done?"                        [title input placeholder]
"Notes (optional)"                              [notes textarea placeholder]
"Who's responsible?"                            [ownership section label]
"Mine"                                          [ownership toggle option A]
"Sales Progressor"                              [ownership toggle option B] ← FLAG for voice pass (Rule 2: internal role name; translation table: sales_progressor → "Progressor / Our team"; suggest "Your progressor")
"Due date cannot be in the past."               [validation error — date picker]
"Cancel"                                        [form dismiss link — agent-link-muted]
"Saving…"                                       [submit button loading state]
"Add"                                           [submit button — agent-btn-primary]

# Section headers
"My to-dos"                                     [section title, id="section-mine"]
"With your progressor"                          [section title, id="section-progressor"]
"[N]"                                           [count badge — blue for own, amber for progressor]

# Overdue sub-label (within a section, when overdue tasks exist)
"Overdue"                                       [sub-label — amber when 1–3 days; red when ≥4 days]

# TaskGroup card
"[property address]"                            [group header link text — dynamic]
"Unknown address"                               [group header fallback — edge case (transactionId set but address null)]
"Quick note"                                    [group header span — when transactionId is null]

# TaskRow content
"[task title]"                                  [task text — dynamic; done state: line-through + muted]
"[task notes]"                                  [optional notes paragraph — dynamic]

# TaskRow — progressor note block (when progressorNote is set)
"Progressor"                                    [note label — no date available]
"Progressor · [day Mon]"                        [note label — with date e.g. "Progressor · 3 Jan"]
"[progressor note text]"                        [dynamic]

# TaskRow — due status labels (right column, when dueDate set and task open)
"Due [day Mon]"                                 [future date — e.g. "Due 5 Jun"]
"Due tomorrow"                                  [1 day away]
"Due today"                                     [due today — amber]
"Due yesterday"                                 [1 day overdue — amber]
"Overdue"                                       [2–3 days overdue — amber]
"Overdue · [N] days"                            [4+ days overdue — red; e.g. "Overdue · 5 days"]
"Our team is on it"                             [reassurance — progressor tasks only, due today / yesterday / 1–3 days overdue]

# TaskRow — fallback date (when no due date, or task is done)
"[day Mon]"                                     [created date — e.g. "3 Jan"]

# TaskRow — aria labels
"Mark as open"                                  [completion button aria-label when isDone=true]
"Mark as done"                                  [completion button aria-label when isDone=false]

# Done toggle button
"Show [N] resolved"                             [collapsed state — e.g. "Show 3 resolved"]
"Hide resolved"                                 [expanded state]

# Section-level empty state — "My to-dos" (ownOpen.length === 0)
"All clear."                                    [headline]
"Use the button above to add a to-do or send a request."
                                                [subtitle] ← FLAG for voice pass (Rule 1: "the button above" is a UI self-reference)

# Section-level empty state — "With your progressor" (progOpen.length === 0)
"No pending requests."                          [headline]
"Anything you send to your progressor will appear here."
                                                [subtitle]
```

**Voice flags summary (Stage 3 pre-population — confirmed exhaustive after second pass):**
1. **"Sales Progressor"** (ownership toggle) — Rule 2 violation. Internal role name. Suggest: "Your progressor".
2. **"Use the button above"** (My to-dos empty subtitle) — Rule 1 borderline. UI self-reference. Suggest: "Add a task or send your progressor a request." (drops the directional reference).
3. **"Show N resolved" / "Hide resolved"** — Rule 2 adjacent. "Resolved" has help-desk register; the schema field is `status: "done"`. Suggest: "Show N completed" / "Hide completed" (or "Show N done" / "Hide done"). ← FLAG for voice pass
4. **`aria-label="Mark as open"`** (completion circle, done→open direction) — Rule 2 violation. "Open" is the raw status field value exposed in a screen-reader label. Suggest: `aria-label="Reopen"` or `"Mark as to do"`. ← FLAG for voice pass

**No toasts on this page:** `handleToggle` and `handleAdd` are both silent on success and failure. No toast copy to check. Silent failure on network error is a UX gap (not a voice issue) — flag in `docs/POST_LAUNCH_FIXES.md` separately.

---

## 8. Desktop view

| Field | Value |
|---|---|
| Breakpoint | Desktop at ≥ 768px (`md:`) |
| Layout | Single-column, `maxWidth: 680`, left-aligned within AgentShell main area |
| Navigation | AgentShell full sidebar, visible permanently |
| Page-specific desktop elements | None — no sidebar panel; no tabs |
| Desktop-only elements | `px-8` (vs `px-4` mobile); `py-4` (vs `py-2` mobile) |

```
Desktop layout (≥768px):
┌─ AgentShell sidebar (240px, fixed) ─┬─ main content (max-width 680px) ──────────┐
│  logo                               │  PageHeader                                │
│  navigation links                   │    "To-Do" + subtitle + StatPills          │
│  user strip                         │  ─────────────────────────────────────────  │
│                                     │  [Add to-do] button                        │
│                                     │                                             │
│                                     │  My to-dos                            [N]  │
│                                     │  [Overdue sub-label if present]            │
│                                     │  ┌─ glass-card: 22 High Street ──────────┐ │
│                                     │  │ ○ Task title             Due tomorrow │ │
│                                     │  │ ○ Task title             3 Jan        │ │
│                                     │  └──────────────────────────────────────┘ │
│                                     │  [Show N resolved ▼]                      │
│                                     │                                             │
│                                     │  With your progressor               [N]   │
│                                     │  ┌─ glass-card: 8 Oak Avenue ───────────┐  │
│                                     │  │ ○ Request text           Due today   │  │
│                                     │  │   Our team is on it                  │  │
│                                     │  └──────────────────────────────────────┘  │
└─────────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 9. Mobile view

| Field | Value |
|---|---|
| Breakpoint | Mobile at < 768px |
| Layout | Single column, full width. `px-4 py-2` padding. `maxWidth: 680` has no effect (viewport is narrower). |
| Navigation | AgentShell sidebar collapses to hamburger/topbar pattern (standard AgentShell mobile) |
| Elements that reorder | None — there is no sidebar panel to reorder. Content is already single-column. |
| Elements that become drawers/sheets | None |
| Elements that collapse | Done section is collapsed by default (toggle required). AddManualTaskForm is collapsed by default. |
| Mobile-specific elements | None — no mobile-only elements |
| Hidden on mobile | None — no `hidden md:block` patterns in the to-do list components |

```
Mobile layout (375px):
┌─────────────────────────────────────┐
│ [☰] To-Do              [bell][user] │  ← AgentShell topbar (sticky)
├─────────────────────────────────────┤
│ To-Do                               │  ← PageHeader (full width)
│ "Your notes, plus..."               │
│ [3 to-dos] [2 with progressor]      │
├─────────────────────────────────────┤
│ [+ Add to-do                      ] │  ← AddManualTaskForm (collapsed)
│                                     │
│ My to-dos                     [3]   │
│ ┌─ glass-card ──────────────────┐   │
│ │ 22 High Street…               │   │  ← address (may truncate)
│ │ ○ Chase solicitor  Tomorrow   │   │
│ │ ○ Mortgage offer  3 Jan       │   │
│ └───────────────────────────────┘   │
│ [▼ Show 2 resolved]                 │
│                                     │
│ With your progressor          [1]   │
│ ┌─ glass-card ──────────────────┐   │
│ │ 8 Oak Avenue                  │   │
│ │ ○ Send enquiry     Due today  │   │
│ │                 Our team is on│   │
│ │                 it            │   │  ← wraps at narrow widths
│ └───────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Mobile-specific notes:**
- TaskRow due label is right-aligned with `flexShrink: 0` — at 375px the content/date split holds without truncation for typical task titles.
- Long task titles (`task.title`) wrap within the `flex: 1` area. No truncation — intentional (tasks need to be fully readable).
- The "Our team is on it" reassurance line wraps beneath the due label at narrow widths — cosmetically acceptable (no overflow).
- Address link in TaskGroup header: `fontSize: 13, fontWeight: 600` — truncates implicitly via parent width.
- AddManualTaskForm date input triggers native mobile date picker — correct behaviour.

---

## 10. Animations / transitions already in place

| Element | Animation | Source |
|---|---|---|
| Completion circle | `background: transparent → var(--agent-success)` + SVG tick appears (CSS transition 150ms on background) | Inline style on `TaskRow` button |
| Completion circle spinner | `agent-spin` keyframe (existing) while loading | Inline style on inner div during `loading=true` |
| "Add to-do" button | `.agent-btn` press-down (`scale(0.98)`) + ghost hover — both from class | `agent-system.css` |
| "Add" submit button | `.agent-btn-primary` hover + press-down | `agent-system.css` |
| "Cancel" link | `.agent-link-muted` hover underline | `agent-system.css` |
| AddManualTaskForm expand | None — `setOpen(true)` with no animation | — |
| "Show resolved" expand | None — `{showDone && <div>...}` with no animation | — |
| Ownership toggle | CSS `transition-colors` (Tailwind) on button active state | Inline Tailwind on form toggle buttons |

**Missing animations (Stage 4 targets, per ANIMATION_STANDARDS.md):**
- AddManualTaskForm open: needs `.agent-reveal-in` on the `<form>` element
- Done section expand: needs `.agent-acc` + `.agent-acc-in` on the done groups container

---

## 10.5. Global animation and interaction inheritance

Reference: `docs/polish-pass/ANIMATION_STANDARDS.md`

**Animation classes (§1–5):**

| Class | Applies? | Where it fires | Status |
|---|---|---|---|
| `.agent-acc` / `.agent-acc-in` | **Yes** | Done section ("Show resolved" expands done task groups) | **Needs wiring in Stage 4** — currently `{showDone && <div>}` with no animation |
| `.agent-reveal-in` / `.agent-reveal-out` | **Yes** | AddManualTaskForm expand/collapse | **Needs wiring in Stage 4** — currently `setOpen(true/false)` with no animation |
| `.agent-dropdown-in` | No | No dropdowns on this page | N/A |
| `.agent-row-flash` | No | Task toggle is a persistent state change, not a momentary confirm — no flash appropriate | N/A |
| `.agent-row-exit` | No | Tasks marked done stay visible (strikethrough style). No deletion on this page. | N/A |
| `.agent-btn` (press-down + hover) | **Yes — partial** | Correctly on "Add to-do" (ghost-bordered), "Add" (primary), "Cancel" (link-muted). **Gap:** "Show N resolved" toggle is a plain `<button>` with inline styles — no `.agent-btn` class. | Needs conversion in Stage 4 (see §12 below) |

**Interactive-state classes (§6–11):**

| Class | Applies? | Where it fires | Status |
|---|---|---|---|
| `.agent-segment-pill` | **Yes** | Ownership toggle ("Mine" / "Sales Progressor" buttons) | **Needs wiring in Stage 4** — currently inline Tailwind classes with manual `bg-white shadow-sm` on selected state |
| `.agent-link` / `.agent-link-muted` | **Yes — partial** | "Cancel" uses `.agent-link-muted` correctly. **Gap:** "Show N resolved" / "Hide resolved" toggle is a plain `<button>` — should be `.agent-link-muted` | "Show resolved" needs conversion in Stage 4 |
| `.agent-btn-ghost-bordered` | Yes | "Add to-do" collapsed button — already correct | Already present |
| `.agent-acc-hdr` | No | No accordion headers on this page — sections use plain div headers with h2 title | Not applicable; section headers are section labels not expand/collapse triggers |
| `.agent-icon-btn` | No | Task completion circle is a bespoke toggle (18px circle, filled on complete). Not a circular icon/close button per §11 definition. | Not applicable — leave as-is |
| `.agent-hover-link` | No | No colour-shift-only hover patterns | N/A |

**Caret spin pattern:** The "Show N resolved" / "Hide resolved" toggle currently uses ASCII ▼/▲ in a 16×16 box. Per caret-spin pattern established for completions and comms (2026-05-17), convert to single `CaretDown` from `@phosphor-icons/react` with `transition-transform duration-200 rotate-180` when expanded.

---

## 11. Known edge cases

- **Optimistic-free task toggle:** `handleToggle` is async — it awaits the PATCH before updating state. No optimistic update. If the network is slow, the spinner shows until the server responds. The done state is only applied after server confirmation. This is correct and intentional. Stage 4 must not introduce optimistic logic here.
- **Task ordering:** `sortTasks()` orders by `dueDate asc` then `createdAt asc`. Null due dates sort to the end. This means "no due date" tasks appear after all dated tasks — by design. Do not change this ordering.
- **Section count badge includes both overdue AND upcoming:** `openCount = overdueGroups.reduce(...) + openGroups.reduce(...)`. Both overdue and upcoming open tasks contribute to the badge count. Done tasks do not contribute.
- **Overdue sub-group rendered before upcoming:** Hard-coded order — `overdueGroups` renders first with the "Overdue" sub-label, then `openGroups` below. This order must be preserved in Stage 4.
- **"With your progressor" section only present when ANY progressor tasks exist (open or done):** The condition is `progTasks.length > 0` (not `progOpen.length > 0`). A user with all-done progressor tasks still sees the section header and the section-level empty state. See Section 4.
- **Ghost fake content violation:** The whole-page empty ghost uses "14 Maple Close, Birmingham" and real-looking task titles. Per completions + comms precedent, ghost must be abstract `.agent-skeleton` bars only. This is a known defect. See Section 13.
- **Date input auto-fill on form open:** `handleOpen()` pre-fills the date input to today (before 15:00) or tomorrow (after 15:00). This auto-fill is intentional and must be preserved in Stage 4.
- **`agentUser` not in `ManualTaskWithRelations`:** The type does not include the agentUser (agency director). The to-do page has no owner/director display. Contrast: CompletionFileRow includes `assignedUserName`.

---

## 12. Out of scope for redesign

- **`/api/manual-tasks` route handler** — PATCH, POST logic not touched
- **Task sorting logic** (`sortTasks()`) — not touched
- **Group formation logic** (`groupByTransaction()`) — not touched
- **Due status logic** (`getDueStatus()`) — not touched; colour tokens corrected but threshold logic unchanged
- **Date pre-fill logic** (`handleOpen()`) — not touched
- **`assignedTo` field** — present in `ManualTaskWithRelations` but not rendered on the to-do page. Do not surface it.
- **`AgentRequestsPanel`** — not imported, not to be imported during this pass

---

## 13. Per-section visual specification

**Baseline:** `/agent/transactions/[id]` (transaction-detail), Stage 4 signed off 2026-05-12.

| Section name | Polish-page structure | Production component(s) | Current state vs polish | Stage 4 changes required |
|---|---|---|---|---|
| **PageHeader** | `PageHeader` with title "To-Do", subtitle, up to 3 StatPills | `PageHeader` + `StatPill` | Already correct — matches canonical PageHeader implementation | None |
| **Add form — collapsed** | `agent-btn agent-btn-sm agent-btn-ghost-bordered` with `+` icon + "Add to-do" | `AddManualTaskForm` (collapsed) | Already correct | None |
| **Add form — expanded** | `glass-card p-4 space-y-3` with title input, notes textarea, ownership toggle (`.agent-segment-pill`), date input, Cancel + Add buttons. `.agent-reveal-in` on mount. | `AddManualTaskForm` (expanded) | 1. No `.agent-reveal-in` on form appear. 2. Ownership toggle is inline Tailwind (not `.agent-segment-pill`). 3. "Sales Progressor" label needs voice fix → "Your progressor". | 1. Add `.agent-reveal-in` on form element. 2. Convert ownership toggle to `.agent-segment-pill`. 3. Voice fix: "Sales Progressor" → "Your progressor". |
| **Section header — "My to-dos"** | Plain flex row: `<h2>` 13px/700 + count badge. No glass wrapper. `id="section-mine"`. | `Section` (inline in AgentTodoList) | In production: `<h2>` inline styled at fontSize 13, fontWeight 700, color var(--agent-text-primary). Count badge: inline-styled spans with hardcoded `#2563eb` (own tasks). | Token gap: own-task count badge uses hardcoded `#2563eb` → flag for token audit but not a blocker. Section header structure otherwise correct. |
| **Section header — "With your progressor"** | Same flex row + amber icon SVG before title | `Section` with `progressor=true` | In production: icon is inline SVG with `stroke: var(--agent-warning)`. Count badge uses `var(--agent-warning)` tokens (correct). | Verify amber SVG icon renders correctly on all 6 themes. Token usage for progressor count badge is already correct. |
| **Overdue sub-label** | 10px/700/uppercase plain `<p>`, amber OR red colour | `Section` (overdue branch) | Production uses hardcoded `#dc2626` for red state. | Token pass: `#dc2626` → `var(--agent-danger)`. |
| **TaskGroup card** | `glass-card overflow-hidden`. Address header: `padding: "10px 16px"`, `borderBottom: "0.5px solid var(--agent-border-subtle)"`. Rows below. | `TaskGroup` (inline) | 1. Header border uses `rgba(255,255,255,0.35)` (hardcoded). 2. Task row dividers use `rgba(255,255,255,0.25)` (hardcoded). 3. Group card wraps a linked address or "Quick note" span. | Token pass: `rgba(255,255,255,0.35)` and `rgba(255,255,255,0.25)` → `var(--agent-border-subtle)`. |
| **TaskRow — open state** | Flex row: 18px circle toggle (blue border, transparent fill) + task title (13px/500/primary) + due label right. Completion circle uses `border: 1.5px solid rgba(37,99,235,0.40)`. | `TaskRow` (inline) | Circle border uses hardcoded `rgba(37,99,235,0.40)` (own tasks). Progressor tasks use `var(--agent-warning)`. | Token gap: own-task circle border uses hardcoded blue. Flag for audit; not a blocking defect. |
| **TaskRow — done state** | Circle filled `var(--agent-success)` + white tick. Title 13px/400/muted/line-through. Date: created date (muted). | `TaskRow` when `isDone=true` | Already uses `var(--agent-success)`. Strikethrough and muted text are correct. | None |
| **TaskRow — progressor note block** | `marginTop: 6, padding: "6px 10px", borderRadius: 6`. Background: `var(--agent-warning-bg)`. `borderLeft: "2px solid var(--agent-warning-border)"`. Label: 10px/700/uppercase `var(--agent-warning)`. Body: 12px `#b45309`. | `TaskRow` | 1. Background uses `rgba(180,87,9,0.06)` (hardcoded). 2. Border uses `rgba(180,87,9,0.28)` (hardcoded). 3. Body text uses `#b45309` (hardcoded). | Token pass: background → `var(--agent-warning-bg)`, border → `var(--agent-warning-border)`, body text → `var(--agent-warning)`. |
| **TaskRow — "Our team is on it" reassurance** | 10px/muted text below due label. Progressor tasks only, when `dueStatus.reassure=true`. | `TaskRow` | Correct. `var(--agent-text-muted)` already used. | None |
| **Section empty state (glass-card)** | `glass-card padding: "28px 20px" textAlign: "center"`. Two lines of text, muted. No icon. | `Section` (no-open branch) | Already correct structure. Copy: see Section 7 flag on "Use the button above". | Voice fix: "Use the button above to add a to-do or send a request." → Stage 3 decision. Structure is correct. |
| **"Show N resolved" toggle** | `.agent-link-muted` with `CaretDown` icon (spins on expand, matching caret-spin pattern established 2026-05-17). | `Section` done toggle | Currently a plain `<button>` with inline styles + ASCII ▼/▲ in a bordered box. Not `.agent-link`, no caret-spin pattern. | 1. Convert to `.agent-link-muted` with `fontSize: 12`. 2. Replace ASCII ▼/▲ + box with `CaretDown` icon + `transition-transform duration-200 rotate-180` when open. |
| **Done task groups** | `agent-acc` + `agent-acc-in` wrapping done groups. Reveals with 200ms height animation. `opacity: 0.7` on each TaskGroup card. | `Section` done section | Currently `{showDone && <div>...}` — no height animation. Opacity 0.7 is correct. | 1. Wrap done groups container in `agent-acc` / `agent-acc-in`. 2. Toggle `.open` class on `showDone`. |
| **Whole-page empty ghost** | Abstract `.agent-skeleton` bars in section shape. `opacity: 0.35`. `pointerEvents: "none"`. NO fake addresses, NO fake task text. Two skeleton groups: first group open (3 task rows), second group collapsed header. Per completions + comms precedent. | `AgentTodoList` early return (when `tasks.length === 0`) | Ghost currently has fake content: "14 Maple Close, Birmingham", "Chase vendor solicitor for draft contracts", "Request mortgage offer from broker". Violates abstract-skeleton standard. Opacity 0.3 (should be 0.35). | Replace fake-content ghost with abstract skeleton bars. Match structure: section-label bar + count-pill bar; then glass-card with address-bar + 2 task-rows (circle + text + date bars); then second collapsed group (just address-bar). Set opacity to 0.35. |
| **Loading skeleton** | PageHeader + 2 stat-pill skeletons + add-form button skeleton + "My to-dos" section (2 glass-card groups) + "With your progressor" section (1 glass-card group) | `app/agent/to-do/loading.tsx` | Loading uses `rgba(255,255,255,0.35)` and `rgba(255,255,255,0.25)` as inline hardcoded values. Add-form skeleton renders two-box layout (doesn't match the single collapsed-button state). | Token pass: `rgba(255,255,255,0.35)` → `var(--agent-border-subtle)`. Add-form skeleton should be a single skeleton pill (matching the `agent-btn-ghost-bordered` collapsed state). |

---

## 14. Amendments

| Date | Discovery | Added to which section |
|---|---|---|
| 2026-05-17 | Stage 3 voice pass: progressor no-open body ("Anything you flag for your progressor will appear here.") and own-tasks all-clear body ("Add a task or send your progressor a request.") to be omitted entirely rather than rendered. Structural change at Stage 4 — conditional render of body `<p>` elements in `AgentTodoList.tsx`. Mirrors null-fallback omission pattern from comms A4 / completions A5. | Section 7, Section 13 |

---

## 15. Canonical contributions

**Library maturity expectation:** This is page 9. No new canonical classes should be needed. Verify below.

**New canonical classes added during this page's Stage 2 or Stage 4:**

| Class name | file:line in `agent-system.css` | Doc entry in `ANIMATION_STANDARDS.md` | Reason |
|---|---|---|---|
| None expected | — | — | All patterns covered: `.agent-reveal-in` (add form), `.agent-acc` (done section), `.agent-segment-pill` (ownership toggle), `.agent-link-muted` (show-resolved button), `.agent-btn-ghost-bordered` (Add to-do), caret-spin (CaretDown + rotate-180). |

**New canonical tokens added:**

| Token name | Defined in | Reason |
|---|---|---|
| None expected | — | `var(--agent-warning-bg)`, `var(--agent-warning-border)`, `var(--agent-warning)`, `var(--agent-danger)`, `var(--agent-border-subtle)`, `var(--agent-success)` are all defined across all 6 themes. Own-task blue (`#2563eb`) is a token gap but adding `--agent-info` is out of scope for this pass — flag in `docs/active/TODO.md`. |

**Token gap flag:** The own-task count badge and completion-circle border use hardcoded `#2563eb` / `rgba(37,99,235,...)`. No `--agent-info` or blue semantic token exists in `themes.css`. These values are theme-fixed (not theme-aware). This is a pre-existing issue — not introduced by this polish pass. Add to `docs/active/TODO.md`: "Define `--agent-info` semantic token for own-task UI elements (count badge, task circle border) — currently hardcoded `#2563eb` in `AgentTodoList.tsx`." Do not block Stage 2 on this.
