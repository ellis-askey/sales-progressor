# Phase 3 · Surface 3 · Reminders / Work Queue · Audit vs DoD

**Companion to:** [BASELINE.md](BASELINE.md) and [PLAN.md](PLAN.md).
**Drafted:** 2026-06-30.

---

## TL;DR

Surface 3 is **bigger than Surface 2 but smaller than Surface 1**. Three Wave-A-style swaps are clean:

- Voice sweep on `AgentRemindersList` chip tooltips (3 strings — same shape as Wave C of Surface 1)
- 4 `agent-btn` → `<Button>` swaps in `AgentRemindersList` (1 stays grandfathered: ghost-bordered variant)
- `agent-skeleton` → `<Skeleton>` primitive on work-queue page ghost preview (~6 instances)

Three Surface-2-style grandfathers:

- `agent-glass-strong` chrome on all 7 cards (same call as Surface 2 Hub — agent-glass system differs from glass-card)
- 2 `agent-acc` accordion patterns (same two-zone / headless gap grandfathered in Wave A4)
- 4 `createPortal` snooze popovers (no canonical `Popover` primitive exists; out-of-scope for this surface)

**Expected scope: 1 PR, similar to Surface 2 D1 but with two clean swap categories instead of one.**

---

## Coverage per DoD

| DoD criterion | Status today | Surface 3 work |
|---|---|---|
| Canonical primitives for every UI element | **Partial.** Same `agent-glass*` chrome question as Hub. Buttons + Skeleton clean. Accordions + popovers grandfather. | per PLAN |
| Hover / focus / active / disabled | **OK.** Existing buttons hit standard states. | no action |
| Voice-passed strings | **3 violations** (em-dash + "automatically" in chip tooltips) | swap in this PR |
| Modal pattern | n/a — surface owns no modals. `ChaseDrawer` consumed but owned by chase surface. | no action |
| Loading state | **No loading.tsx exists**. Page renders synchronously. Existing empty-state ghost preview serves a related role. | no action (no Suspense to skeleton) |
| Empty state | **Composed inline** with Bell icon + 2-line copy + ghost preview. EmptyState compact would regress (same call as Surface 2 grandfather entry for hub welcome). | grandfather |
| Error state | **Implicit** — bubbles to error.tsx. | flag only |

---

## Class usage inventory

### `agent-glass-strong` chrome (7 instances)

| File | Lines (approx) | Card purpose |
|---|---|---|
| `app/agent/work-queue/page.tsx` | 92 | True-empty welcome |
| `AgentRemindersList.tsx` | 650, 881, 900, 935, 1010 | Sticky filter bar + group cards + sub-empties |
| `ReminderCard.tsx` | 419 | Per-reminder row chrome |
| `FileAlertsStrip.tsx` | 39 | Strip outer chrome |

**Decision: grandfather** (same as Surface 2). The agent-glass system is a parallel visual treatment to `glass-card`; Card primitive's `variant="glass"` ≠ `agent-glass-strong`. Filed in POLISH_TBD alongside Surface 2's entry.

### `agent-btn` buttons (5 instances on this surface)

| Line | Variant | Migration verdict |
|---|---|---|
| `AgentRemindersList.tsx:171` | `agent-btn-sm agent-btn-ghost` | **Migrate to `<Button variant="ghost" size="sm">`** |
| `AgentRemindersList.tsx:257` | `agent-btn-sm agent-btn-secondary` | **Migrate to `<Button variant="secondary" size="sm">`** |
| `AgentRemindersList.tsx:483` | `agent-btn-sm agent-btn-ghost-bordered` | **Grandfather** — ghost-bordered variant not in Button union (existing entry in POLISH_TBD from Wave A3) |
| `AgentRemindersList.tsx:493` | `agent-btn-sm agent-btn-secondary` | **Migrate** |
| `AgentRemindersList.tsx:536` | `agent-btn-sm agent-btn-primary` | **Migrate to `<Button size="sm">`** (primary is default) |

**Decision: 4 migrate, 1 grandfather.**

### Accordions (`agent-acc`)

Two patterns:
1. `AgentRemindersList.tsx:977` — group section open/close. Same two-zone header (label + count badge) primitive gap.
2. `FileAlertsStrip.tsx:77` — strip body open/close. Header has internal toggle button (headless-body shape).

**Decision: grandfather both.** Same primitive-API gap rationale as Wave A3/A4 grandfathers — Accordion.Header doesn't support two-zone layout or external toggles. Filed in POLISH_TBD.

### Popovers (`createPortal`, 4 instances)

- 2 in `AgentRemindersList` (snooze: row + bulk)
- 2 in `ReminderCard` (per-row snooze + escalate)

No `<Popover>` primitive exists. These are different from modals (anchored to a trigger, not centred/right-anchored). Pattern: open/close state + position from `getBoundingClientRect` + `createPortal` to document.body.

**Decision: grandfather.** Adding a Popover primitive is a separate, well-scoped follow-up — out of Surface 3 scope (Law 14: build primitive when 3+ consumers force the canonicalisation). Currently only the reminders surface uses this pattern.

### Skeletons (`agent-skeleton` — ~6 instances)

In `app/agent/work-queue/page.tsx` empty-state ghost preview:
- Group label badge (radius 99)
- 2 text bars per ghost row × 2 rows
- 1 action chip per ghost row × 2 rows

**Decision: migrate.** Bar helper pattern from Surface 2 D1 + PanelSkeletons from Wave A4. Inner pulses wrap `<Skeleton variant="block">`.

### Voice violations (3 strings)

| Line | Current | Proposed |
|---|---|---|
| 55 | `"Client chased automatically, then opted out. Now manual — please follow up."` | `"We chased the client, then they opted out. Follow up manually."` |
| 61 | `"Can't chase automatically — the client contact has no email address. Manual chase needed."` | `"We can't chase this client: no email on file. Follow up manually."` |
| 63 | `"Can't chase automatically — the client contact has no portal access. Manual chase needed."` | `"We can't chase this client: no portal access. Follow up manually."` |

Same swaps applied to `RemindersSection.tsx` in Wave C of Surface 1. Tooltip semantics unchanged.

---

## Per-PR remediation priority

Single PR ("E1") — three clean swap categories + grandfathers in POLISH_TBD:

1. Voice sweep on the 3 `AgentRemindersList` chip tooltips
2. 4 `agent-btn` → `<Button>` swaps in `AgentRemindersList` (1 stays raw)
3. `agent-skeleton` → `Bar`+`<Skeleton>` on work-queue page empty ghost
4. POLISH_TBD: extend Surface 2 entry to cover agent-glass-strong on Surface 3 files; new entries for the 2 accordion patterns + the popover gap

**Estimated diff:** small. 4 files touched.

---

## Risk profile

| Risk | Mitigation |
|---|---|
| Voice swap changes tooltip semantics | Same swap shape already shipped in Wave C; copy proposed verbatim same |
| Button primitive renders `<button>`; existing `<button>` already — no JSX shape change | n/a |
| ghost-bordered grandfather: only one button stays raw and it's already grandfathered per Wave A3 POLISH entry | n/a |
| Skeleton primitive cooler gray vs agent-skeleton warm theme tokens (same delta as Hub D1) | Visible only during the empty-state preview; small surface area; accepted canonical shift |

---

## Out of scope (re-stated)

- `ChaseDrawer` and the chase arc
- `AutomatedEmailsCard*` (file-detail Surface 1, already covered)
- All server services (`lib/services/reminders.ts`, `lib/services/work-queue.ts`)
- `PageHeader`, `StatPill` (canonical layout primitives)
- `runReminderEngineAction()` button behaviour (intentional admin shortcut per BASELINE §10)
