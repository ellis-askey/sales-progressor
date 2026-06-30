# Phase 3 · Surface 5 · Agent To-Do · Behavioural Baseline + Audit + Plan

**Route:** [`/agent/to-do`](../../../app/agent/to-do/page.tsx)
**Drafted:** 2026-06-30.

Single-doc surface because Surface 5 is small enough that BASELINE/AUDIT/PLAN don't need to split.

---

## Baseline

### Route + auth
- `app/agent/to-do/page.tsx` — async server component (65 lines)
- Allowed roles: `director`, `negotiator`, `sales_progressor`, `admin`, `superadmin`
- Internal staff get a different inbox via `listInternalSelfAssignedTasks` + `listProgressorInboxTasks`

### Data fan-out
Three conditional queries:
1. `listAllTasksForAgent(userId, agencyId)` — agency-scoped, returns empty for internal staff (agencyId=null)
2. `listProgressorInboxTasks(userId)` — for sales_progressor only
3. `listInternalSelfAssignedTasks()` — for internal staff only

### Render branches
1. **Empty** (`tasks.length === 0`): `AddManualTaskForm` + `agent-glass-strong` centered card + ghost preview
2. **Has tasks**: `AddManualTaskForm` + `Section`s (per task category)

### Role variations
| Role | "My to-dos" section | Progressor section | Internal to-dos | progLabel |
|---|---|---|---|---|
| director | ✓ | ✓ | — | "with progressor" |
| negotiator | ✓ | ✓ | — | "with progressor" |
| sales_progressor | — | ✓ (as inbox) | ✓ | "from agents" |
| admin / superadmin | — | — | ✓ | n/a |

### Components in scope
- `app/agent/to-do/page.tsx` (65) — page orchestrator, uses canonical `<PageHeader>` + `<StatPill>`
- `components/agent/AgentTodoList.tsx` (495) — main work component

Reused canonical primitives: `PageHeader`, `StatPill`. Also uses `AddManualTaskForm` (file-detail surface, already Wave A3'd).

### Mutations
- `AddManualTaskForm` submit → manual task creation (server action)
- Per-task toggle → status change (handled by `handleToggle` server action)
- Toggle "Show completed" → client-only state

### Known oddities to preserve
- Internal staff use entirely different task pools — fixture lists `ownTasks=[]` for internal
- "Show N completed" expander uses inline button + `agent-acc` body (headless body pattern — same grandfather as ManualTaskList from Wave A3)
- TaskGroup card has an `inset 3px 0 0` red border when `overdue=true` — preserve

---

## Audit vs DoD

| Criterion | Status | Action |
|---|---|---|
| Canonical primitives | **Partial.** Page uses `PageHeader` + `StatPill` (canonical). AgentTodoList has 3 clean `glass-card` swaps + 1 `agent-glass-strong` grandfather. | G1 |
| Hover / focus / active | OK | none |
| Voice | **2 em-dash violations** in prose strings | G1 |
| Modal pattern | none | none |
| Loading state | No `loading.tsx`. | none |
| Empty state | `agent-glass-strong` card + ghost preview + `AddManualTaskForm`. | grandfather chrome |
| Error state | Implicit bubble. | flag only |

### Class usage inventory

**Cards:**
- `glass-card` (clean Card swap): 3 instances in `AgentTodoList.tsx`
  - L162 ghost preview wrapper
  - L304 empty-section card ("All caught up." / "All clear.")
  - L351 TaskGroup wrapper (rendered N times)
- `agent-glass-strong` (chrome grandfather): 1 instance — L143 empty-page card

**Accordions:**
- 1 `agent-acc` body at L329 — "Show N completed" expander. Headless-body pattern (toggle is external button at L320). Same grandfather rationale as Wave A3 ManualTaskList.

**Skeletons:**
- ~6 `agent-skeleton` divs in the empty-state ghost preview (L159-173). Wrap with `<Skeleton>` primitive — Bar helper pattern from Surface 2 D1 / Surface 3 E1.

**Buttons:**
- Only 1 button on the page is `<button className="agent-link agent-link-muted">` (Show/Hide completed toggle, L320). Link-style, not `agent-btn`. No Button primitive migration needed.

**Voice violations (2 prose em-dashes):**
- L151: `"Add an internal to-do above — visible to your whole internal team."`
- L222: `"No internal to-dos yet — add one above to get started."`

Other em-dashes in the file are all in JSX comments. No `automatically` / `the system` / `the platform` violations.

---

## Plan — PR G1

**Single PR ("G1"). Same compressed model as Surfaces 2-4.**

Changes:
1. **Voice swap** — 2 prose em-dashes in `AgentTodoList.tsx` → periods
2. **3 `glass-card` → `<Card>` swaps** in `AgentTodoList.tsx` (L162, L304, L351)
3. **Skeleton primitive swap** in ghost preview — introduce local `Bar` helper, swap ~6 instances
4. **POLISH_TBD** — extend Surfaces 2-4 chrome entry to include Surface 5 file. Surface 5 = fourth consumer of `agent-glass`. Extend Wave A3 headless-body grandfather to cover this accordion.

Verification:
- `tsc --noEmit` clean
- multi-tenant 26/26
- E2E sentinel: new spec at `e2e/surface-agent-todo.spec.ts`

Chrome decision: inherited from Surfaces 2-4 (Option B = grandfather). Surface 5 is the fourth consumer of `agent-glass-strong` — this strongly amplifies the Law 14 trigger for the Card primitive extension (now 4 consumers across page-level surfaces).

Exit criteria:
- G1 PR shipped + tsc + multi-tenant green
- POLISH_TBD updated
- BUILD_PLAN marked DONE for Surface 5

This Surface 5 doc is pinned 2026-06-30.
