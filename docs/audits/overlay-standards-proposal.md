# Overlay Standards — Taxonomy and Canonical Pattern Proposal

**Date:** 2026-05-18
**Status:** Stage 1 — awaiting Ellis sign-off before visual proposals are rendered on the audit page
**Based on:** 33-component audit at `/agent/audit/overlays`, existing token system (`themes.css`), animation classes (`agent-system.css`)

---

## What the audit surfaced

The 33 overlay components were built independently. Common structural problems:

| Problem | Current state |
|---|---|
| Z-index collisions | `z-50`, `z-[1000]`, `1000`, `1500`, `2000`, `3000` — hardcoded integers and arbitrary Tailwind values alongside the token system (`--agent-z-modal: 1000` etc.) |
| Two backdrop classes | `.agent-backdrop` (40% opacity, 8px blur) and `.agent-backdrop-overlay` (35% opacity, 4px blur) used interchangeably with no rule for which |
| Two toast systems | `AgentToaster` (new, full-featured) and `ToastContext` (legacy, simpler) coexist; ChainDrawer and NewSaleFlow still call the legacy one |
| Header structure varies per component | Some have icon + title + subtitle; some have address as title; some have no header at all |
| Width inconsistency | Modals: 420–480px. Drawers: 28rem / 440px / fluid. No rule |
| Click-outside dismiss inconsistency | Some dialogs close on backdrop click, some don't — no pattern based on intent |
| Focus trapping absent | None of the 33 components implement a focus trap |
| Exit animation coverage gaps | `agent-drawer-out` and `agent-modal-out` keyframes do not exist; ChaseDrawer and ReconciliationDrawer unmount immediately |

---

## Proposed taxonomy

```
Category 1 — Slide-in surfaces (drawers)
  1a  Compose drawer        ChaseDrawer, AddNodeDrawer
  1b  Edit drawer           EditSaleDetailsDrawer, ReconciliationDrawer
  1c  Browse drawer         ChainDrawer

Category 2 — Centred dialogs (modals)
  2a  Simple confirmation   MortgageModal, SurveyNrConfirmModal
  2b  Decision + impact     UndoMilestoneModal, WithdrawalReasonModal,
                            DuplicateAddressModal, NavAwayModal,
                            UnsavedChangesModal, AddressConsequencesModal
  2c  Data entry dialog     AddFirmModal, AddBrokerModal
  2d  Informational         WelcomeModal
  2e  Celebration           ExchangeCelebration

Category 3 — Anchored overlays (popovers)
  3a  Detail popover        RiskBadgeWithPopover, MissingFeeRow (desktop)
  3b  Mobile sheet          MissingFeeRow (mobile), future mobile drawers
  3c  Content panel         ChangelogDropdown (read-only panel anchored to a button)

Category 4 — Menus (dropdowns)
  4a  Selection menu        StatusControlDropdown, ToneSelector,
                            SolicitorPicker dropdown, BrokerPicker dropdown
  4b  Action menu           SideSnoozeMenu, RowSnoozeMenu

Category 5 — Transient notifications (toasts)
  5a  Success
  5b  Info
  5c  Warning
  5d  Error
  5e  Action toast          with undo / retry button

Category 6 — Full-screen modes
  6a  Command overlay       AgentGlobalSearch
  6b  Feedback              FeedbackWidget
  6c  Blocking loader       SubmissionOverlay
```

---

## Category 1 — Slide-in surfaces

### Shared canon (all sub-variants)

**Structure:**
```
fixed inset-y-0 right-0
  [sticky header: 56px]
  [body: flex-1, overflow-y-auto]
  [sticky footer: conditional on variant]
```

**Visual:**
```
width:      sub-variant-specific (see below)
background: var(--agent-surface-elevated)
border-left: 1px solid var(--agent-border-default)
box-shadow: -8px 0 40px rgba(var(--agent-shadow-rgb), 0.12)
z-index:    var(--agent-z-modal)  [1000]
```

**Header (canonical structure — same across all drawers):**
```
height: 56px; padding: 0 20px;
display: flex; align-items: center; justify-content: space-between;
border-bottom: 1px solid var(--agent-border-subtle);
background: var(--agent-surface-elevated);  [sticky]

Left:  icon (optional, 20px) + title (font-size 14px, font-weight 600, --agent-text-primary)
Right: close button (agent-circle-btn, 32×32px, X icon 14px)
```

**Backdrop:**
```
class: agent-backdrop  [rgba(shadow-rgb, 0.40), blur 8px, z-index 999]
animation: agent-backdrop-in 200ms ease both
```

**Animation (entry):**
```
agent-drawer-in: translateX(24px) → translateX(0)
duration: 280ms
easing:   var(--agent-ease)  [cubic-bezier(0.4, 0, 0.2, 1)]
fill:     both
```

**Exit animation (NEW — needs adding to agent-system.css):**
```
@keyframes agent-drawer-out {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(24px); }
}
duration: 200ms ease-in
Two-step: add class → 200ms → unmount
```

**Dismiss triggers:**
- X button: always present, always dismisses
- Escape key: always dismisses
- Backdrop click: **only if no unsaved data** (1a compose on empty form, 1c browse) — **not** when form is dirty (1b edit) or when the drawer has a confirmation flow

**Focus:** First focusable element receives focus on mount. Tab cycles within drawer. No current focus trap — flagged as a gap to address.

**Keyboard:**
- Escape: dismisses
- Tab: cycles through drawer controls only (once focus trap is implemented)

**Reduced motion:** `animation: none` for both entry and exit — instant appearance.

---

### 1a — Compose drawer

**When to use:** User creates or composes something (a chase message, a chain node) and submits it via a primary action in the footer.

**Width:** `420px` (was: ChaseDrawer uses `max-w-[28rem]` = 448px; AddNodeDrawer uses no explicit width — needs fixing)

**Footer (sticky):**
```
height: 64px; padding: 0 20px;
display: flex; align-items: center; justify-content: flex-end; gap: 10px;
border-top: 1px solid var(--agent-border-subtle);
background: var(--agent-surface-elevated);

Right: [Cancel — agent-btn ghost] [Primary CTA — agent-btn primary]
```

**Backdrop click:** closes only when the compose form is empty.

**Examples:** ChaseDrawer, AddNodeDrawer

---

### 1b — Edit drawer

**When to use:** User reviews and edits structured data, either in sections (each with its own save) or as a single form.

**Width:** `520px` (was: EditSaleDetailsDrawer uses inline `style={{ width: 440 }}`; ReconciliationDrawer uses Tailwind width)

**Footer:** Present only for single-form variant. Section-per-section save uses inline save buttons per section (current EditSaleDetailsDrawer pattern — keep).

**Backdrop click:** Never dismisses. Dirty form shows UnsavedChangesModal instead.

**Examples:** EditSaleDetailsDrawer, ReconciliationDrawer

---

### 1c — Browse drawer

**When to use:** User browses content and takes contextual actions on items within the drawer. The drawer itself is not a form.

**Width:** `480px`

**Footer:** Optional sticky footer for bulk actions (e.g. ChainDrawer's "Invite all" button).

**Backdrop click:** Always dismisses (no unsaved state).

**Examples:** ChainDrawer

---

## Category 2 — Centred dialogs

### Shared canon (all sub-variants)

**Structure:**
```
fixed inset-0 flex items-center justify-center padding: 0 16px
  [backdrop]
  [dialog card]
```

**Backdrop:**
```
class: agent-backdrop  [same class as drawers — standardise to one backdrop class]
```

**Animation (entry):**
```
agent-modal-in: scale(0.95) + translateY(8px) → scale(1) + 0
duration: 250ms
easing:   var(--agent-ease)
fill:     both
```

**Exit animation (NEW):**
```
@keyframes agent-modal-out {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to   { opacity: 0; transform: scale(0.95) translateY(4px); }
}
duration: 180ms ease-in
Two-step: add class → 180ms → unmount
```

**Z-index:**
```
dialog z-index: var(--agent-z-modal)  [1000]
Note: DuplicateAddressModal currently uses z-index 2000 — fix to use token
```

**Common dialog card:**
```
background: var(--agent-surface-elevated)
border: 0.5px solid var(--agent-border-default)
border-radius: var(--agent-radius-xl)  [16px]
box-shadow: 0 24px 64px rgba(var(--agent-shadow-rgb), 0.14),
            0 4px 16px rgba(var(--agent-shadow-rgb), 0.06)
width: 100%; max-width: sub-variant-specific
```

**Close X button:** Present in 2b, 2c, 2d. Absent in 2a (users must pick an action — no "close" ambiguity). Positioned: absolute top-4 right-4, `agent-circle-btn`.

---

### 2a — Simple confirmation

**When to use:** Binary or small-option choice. No data entry. No impact visualisation. Clear action label, clear cancel.

**Max-width:** `400px`

**Header:** Title only (no close X — user must choose).
```
padding: 20px 24px 0
font-size: 15px; font-weight: 700; color: --agent-text-primary
```

**Body:** 1–2 sentence explanation.
```
padding: 12px 24px 0; font-size: 13.5px; color: --agent-text-secondary; line-height: 1.6
```

**Footer:**
```
padding: 16px 24px 20px;
display: flex; gap: 8px; flex-direction: column;
Each button: full-width, 44px height, agent-radius-lg
Primary action: top (agent-btn-primary or danger variant)
Cancel: bottom (agent-link style, no border)
```

**Backdrop click:** Does NOT dismiss. User must explicitly choose.

**Examples:** MortgageModal, SurveyNrConfirmModal

---

### 2b — Decision + impact

**When to use:** User must choose between options where at least one has visible consequences (step count, downstream impact, reason text, data loss).

**Max-width:** `460px`

**Header:** Title + optional close X (top-right) if the dialog is dismissible.

**Body:** May include:
- Impact summary (colour-coded counts, percentage bars)
- Radio/select options
- Text input (withdrawal reason custom text)
- Consequence list (expandable)

**Footer:**
```
padding: 16px 24px 20px;
display: flex; justify-content: flex-end; gap: 8px;
[Cancel — ghost] [Confirm — primary or danger depending on action]
```

**Destructive actions** (discard changes, irreversible): use `--agent-danger` colour on the confirm button.
**Backdrop click:** Does NOT dismiss (user is mid-decision).

**Examples:** UndoMilestoneModal, WithdrawalReasonModal, DuplicateAddressModal, NavAwayModal, UnsavedChangesModal, AddressConsequencesModal

---

### 2c — Data entry dialog

**When to use:** User creates a new record (firm, broker) directly from within another overlay flow. Keeps the user in context without a full page navigation.

**Max-width:** `460px`

**Header:** Title + close X.

**Body:** Form fields with inline validation. Required fields indicated.

**Footer:**
```
padding: 0 24px 20px;
display: flex; justify-content: flex-end; gap: 8px;
[Cancel — ghost] [Save / Create — primary]
```

Save button: disabled while fields are empty or invalid; shows loading state during save.

**Backdrop click:** Dismisses if form is empty. Shows unsaved-changes warning if populated.

**Examples:** AddFirmModal, AddBrokerModal

---

### 2d — Informational

**When to use:** Orient the user to a new surface or introduce a feature. No consequential action required — user closes at will.

**Max-width:** `520px`

**Header:** Optional decorative header (gradient, illustration). Title prominent (18–20px).

**Body:** Rich content — feature highlights, onboarding steps, tour slides.

**Footer:** Single primary CTA + optional dismiss link.

**Backdrop click:** Dismisses.

**Examples:** WelcomeModal

---

### 2e — Celebration

**When to use:** Mark a significant milestone (exchange confirmed). Special animation. Brief, joyful, tap-to-dismiss.

**Structure:** Full-screen. Canvas layer (confetti) behind a centred card.

**Card:**
```
max-width: 380px; padding: 32px; text-align: center;
border-radius: 24px; background: white; box-shadow: large
```

**Animation:** `agent-modal-in--celebrate` (scale 0.92 → 1, 200ms).

**Backdrop click / tap:** Always dismisses.

**Reduced motion:** Confetti animation suppressed. Card entrance immediate.

**Examples:** ExchangeCelebration

---

## Category 3 — Anchored overlays

### 3a — Detail popover

**When to use:** Show rich detail context about a specific element (risk breakdown, fee editor) anchored near its trigger. Floats above other content.

**Positioning:** Dynamic — calculate available space above/below trigger at open time. Prefer below; flip to above if insufficient space.

**Visual:**
```
background: var(--agent-surface-elevated)
border: 1px solid var(--agent-border-default)
border-radius: var(--agent-radius-lg)  [12px]
box-shadow: 0 8px 32px rgba(var(--agent-shadow-rgb), 0.14)
max-width: 340px; min-width: 240px
z-index: var(--agent-z-dropdown)  [1500]
```

**Animation:** `agent-dropdown-in` (120ms — reuse existing) on open. `agent-dropdown-out` on close.

**Dismiss triggers:**
- Click outside popover
- Scroll (window scroll closes immediately)
- Escape key
- No X button (implicit dismiss)

**No backdrop.**

**Examples:** RiskBadgeWithPopover, MissingFeeRow (desktop)

---

### 3b — Mobile sheet

**When to use:** The mobile equivalent of 3a. Slides up from the bottom edge. Better for fat-finger interaction and taller content.

**Visual:**
```
position: fixed; inset-x: 0; bottom: 0;
border-radius: 20px 20px 0 0;
background: var(--agent-surface-elevated)
border-top: 1px solid var(--agent-border-default)
box-shadow: 0 -8px 32px rgba(var(--agent-shadow-rgb), 0.12)
max-height: 80vh; overflow-y: auto
z-index: var(--agent-z-modal)  [1000]
```

**Animation (NEW needed):**
```
@keyframes agent-sheet-in {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
duration: 280ms; easing: var(--agent-ease)
```

**Backdrop:** Light — `agent-backdrop-overlay` class (35% opacity, 4px blur). Not the full `agent-backdrop`.

**Dismiss triggers:**
- Backdrop tap
- Escape key
- Swipe down (not currently implemented — note as a gap)
- Explicit close button (top-right of sheet header)

**Examples:** MissingFeeRow (mobile, `window.innerWidth < 768`)

---

### 3c — Content panel

**When to use:** A popover-style panel anchored to a button that shows read-only content (changelog entries, notifications). Not a menu (no selectable items). Not a dialog (no action required).

**Visual:** Same as 3a but wider (max-width: 320px), with richer internal structure (headers, sections, scroll).

**Animation:** Same as 3a.

**Dismiss triggers:** Same as 3a (click outside, Escape).

**Examples:** ChangelogDropdown

---

## Category 4 — Menus

### Shared canon

**Animation:** `agent-dropdown-in` on open, `agent-dropdown-out` on close (two-step, `onAnimationEnd` → unmount). Both already exist in `agent-system.css`.

**Visual:**
```
background: var(--agent-surface-elevated)
border: 1px solid var(--agent-border-default)
border-radius: var(--agent-radius-lg)  [12px]
box-shadow: 0 8px 24px rgba(var(--agent-shadow-rgb), 0.10)
overflow: hidden
z-index: var(--agent-z-dropdown)  [1500]
```

**Item structure:**
```
height: 40px; padding: 0 14px;
display: flex; align-items: center; gap: 10px;
font-size: 13px; color: var(--agent-text-primary)
cursor: pointer;
class: agent-dropdown-item  [already defined in agent-system.css]
```

**Keyboard:** Arrow keys navigate items. Enter selects. Escape closes.

---

### 4a — Selection menu

**When to use:** User selects one option from a list. Selection persists (status change, tone, firm).

**Width:** Min 160px, max 360px (content-driven).

**Items:** Label only, or label + meta-label. Active/selected item shows a checkmark or highlighted background.

**Dismiss:** Clicking an item dismisses + applies. Clicking outside dismisses without change. Escape dismisses without change.

**Examples:** StatusControlDropdown, ToneSelector, SolicitorPicker dropdown layer, BrokerPicker dropdown layer

---

### 4b — Action menu

**When to use:** User triggers an action from a small option list. Nothing is "selected" as persistent state — each click fires an action and closes the menu.

**Width:** Min 120px, max 240px (usually narrower than 4a).

**Items:** Label only. No checkmarks.

**Dismiss:** Clicking an item fires action + dismisses. Clicking outside dismisses without action. Escape dismisses.

**Examples:** SideSnoozeMenu, RowSnoozeMenu

---

## Category 5 — Transient notifications

### Shared canon

**Position:** Bottom-right. `fixed bottom-6 right-6 z-[--agent-z-toast]`. Max 4 stacked.

**Visual (AgentToaster — this is the canonical system):**
```
width: 360px; border-radius: var(--agent-radius-xl)  [16px]
background: rgba(255,255,255,0.88); backdrop-filter: blur(24px) saturate(180%)
border: 0.5px solid var(--agent-glass-border)
border-left: 3px solid [semantic colour by type]
box-shadow: 0 8px 32px rgba(var(--agent-shadow-rgb), 0.10)
```

**Semantic left-border colours:**
```
success: var(--agent-success)  [green]
info:    var(--agent-info)     [blue]
warning: var(--agent-warning)  [amber]
error:   var(--agent-danger)   [red]
```

**Durations:** success 4s · info 4s · warning 6s · error 8s. Persistent: `duration: 0`.

**Dismiss:** Hover pauses timer. Click X dismisses. Action button dismisses after callback.

**Exit animation:** `agent-toast-out` (opacity 0, translateX 24px, existing keyframe).

**Consolidation required:** `ToastContext` (legacy) should be retired. ChainDrawer and NewSaleFlow should migrate to `useAgentToast()`. This is the largest deviation from the canonical pattern — two incompatible systems for the same thing.

---

## Category 6 — Full-screen modes

### Shared canon

**Backdrop:** `agent-backdrop` (40% opacity, 8px blur).

**Content panel:** Centred, max-width and max-height sub-variant-specific.

**Dismiss:** Always Escape. Usually click-backdrop. X button where content warrants it.

**Focus trap:** Required. Tab should cycle within the overlay only.

---

### 6a — Command overlay (search)

**When to use:** Global command/search interface triggered by keyboard shortcut. Fast, keyboard-driven.

**Content:** Centred panel, `max-width: 640px`, appears at `pt-[15vh]` (upper-centre, like Cmd+K conventions).

**Dismiss:** Escape, backdrop click, navigate to result.

**Examples:** AgentGlobalSearch

---

### 6b — Feedback overlay

**When to use:** Multi-step feedback form. Requires deliberate interaction — not modal-blocking, but captures full attention.

**Content:** Floating button (fixed corner) opens panel via `role="dialog"`.

**Dismiss:** Escape, dedicated close button, backdrop click.

**Examples:** FeedbackWidget

---

### 6c — Blocking loader

**When to use:** System is performing an operation the user cannot interrupt (file creation). Blocks all interaction.

**Z-index:** Above all other overlays. `z-index: 3000` (above `--agent-z-toast` at 2000 — the only case where a component legitimately exceeds the toast z-index).

**Content:** Centred spinner + rotating status messages.

**Dismiss:** None. Unmounts when operation completes.

**Reduced motion:** Messages still cycle. Spinner animation suppressed — show static icon instead.

**Examples:** SubmissionOverlay

---

### 6d — Celebration

→ Reclassified to **2e** (Centred dialogs — Celebration). ExchangeCelebration is structurally a centred dialog with full-screen canvas layer behind it, not a command/search/loading mode.

---

## Z-index stack (proposed canonical)

| Layer | Token | Value | Who lives here |
|---|---|---|---|
| Base | `--agent-z-base` | 0 | Page content |
| Elevated | `--agent-z-elevated` | 10 | Sticky headers, in-flow floating elements |
| Overlay | `--agent-z-overlay` | 100 | In-page overlays, tooltips |
| Modal backdrop | `--agent-z-modal` − 1 | 999 | Backdrop for modals + drawers |
| Modal / drawer | `--agent-z-modal` | 1000 | All drawers, all centred dialogs |
| Dropdown / popover | `--agent-z-dropdown` | 1500 | All 4a/4b menus, 3a popovers, 3c panels |
| Toast | `--agent-z-toast` | 2000 | All toasts |
| Blocking loader | (hardcoded) | 3000 | SubmissionOverlay only — documented exception |

**Current violations to fix:**
- DuplicateAddressModal: `2000` → `--agent-z-modal` (1000)
- ChainDrawer: check hardcoded value
- MissingFeeRow popover: likely correct at 1500, verify
- `AccountDangerZone` inline modal: uses `position: fixed` without z-index — needs explicit `--agent-z-modal`

---

## New CSS additions required

The following need to be added to `agent-system.css` before implementation can proceed:

```
@keyframes agent-drawer-out { ... }        [Cat 1 exit animation]
@keyframes agent-modal-out  { ... }        [Cat 2 exit animation]
@keyframes agent-sheet-in   { ... }        [Cat 3b enter animation]
@keyframes agent-sheet-out  { ... }        [Cat 3b exit animation]

.agent-drawer { ... }                      [canonical drawer card class]
.agent-sheet  { ... }                      [canonical mobile sheet class]
```

The `.agent-modal` and `.agent-backdrop` classes already exist and can be used as-is for Category 2.

---

## Decisions requested before Stage 2

Three areas where the proposal has genuine choices that benefit from Ellis's input before rendering visual proposals:

**Decision 1 — Drawer width by sub-variant or unified?**
- Option A: Sub-variant widths (420 / 520 / 480 for 1a / 1b / 1c). More purposeful sizing.
- Option B: Single canonical drawer width (440px). Simpler, predictable.

**Decision 2 — Close X on centred dialogs: always or by variant?**
- Current proposal: X present on 2b/2c/2d, absent on 2a (simple confirm — user must choose).
- Alternative: X always present for consistency even on 2a.

**Decision 3 — Legacy ToastContext retirement**
- Current: two toast systems. Proposal says retire ToastContext.
- This means migrating ChainDrawer + NewSaleFlow to `useAgentToast()` — small but touching two active components.
- If this isn't worth doing now, the audit page just documents the divergence.

---

## What happens after approval

Stage 2: Render current/proposed visual pairs on `/agent/audit/overlays` for each component. Ellis clicks "Current", "Proposed", or "Modify proposal" per component.

Stage 3 (future, separate arc): Apply approved patterns to production components. One PR per category or sub-variant. Production components are NOT touched until Ellis has signed off on both the taxonomy (here) and the visual proposals (Stage 2 audit page).
