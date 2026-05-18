# Cross-Page Audit Inventory
**Date:** 2026-05-17
**Scope:** 9 polished pages + their component trees
**Phase:** 1 — Inventory only. No fixes.
**Auditor:** Claude Code automated read pass

---

## Files read

### Pages
1. `app/agent/transactions/new-v2/page.tsx`
2. `app/agent/transactions/[id]/page.tsx`
3. `app/agent/hub/page.tsx`
4. `app/agent/work-queue/page.tsx`
5. `app/agent/transactions/page.tsx`
6. `app/agent/comms/page.tsx`
7. `app/agent/completions/page.tsx`
8. `app/agent/to-do/page.tsx`
9. `app/agent/to-do/loading.tsx`

### Components read (2–3 levels deep)
- `components/transactions-v2/NewSaleFlow.tsx`
- `components/transactions-v2/HeroCard.tsx`
- `components/transactions-v2/DraftPanel.tsx`
- `components/transactions-v2/form/Stage2Sections.tsx`
- `components/transactions-v2/form/SectionAccordion.tsx`
- `components/transactions/TransactionListWithSearch.tsx`
- `components/transactions/TransactionTable.tsx`
- `components/transactions/TransactionRowView.tsx`
- `components/transactions/ForecastStrip.tsx`
- `components/completions/CompletionsGroupList.tsx`
- `components/completions/CompletionFileRowView.tsx`
- `components/agent/AgentTodoList.tsx`
- `components/todos/AddManualTaskForm.tsx`
- `components/hub/AttentionListView.tsx`
- `components/comms/CommsActivityFeed.tsx`
- `components/reminders/AgentRemindersList.tsx`
- `components/reminders/FileAlertsStrip.tsx`
- `components/transaction/PropertyHero.tsx`
- `components/transaction/TransactionSidebar.tsx`
- `components/transaction/TransactionNotes.tsx`
- `components/milestones/MilestonePanel.tsx`
- `components/milestones/MilestoneRow.tsx`

---

## Summary stats

| Category | Total instances found | Drift flags |
|---|---|---|
| 1. Accordions / Collapsibles | 14 | 2 |
| 2. Dropdowns / menus | 8 | 3 |
| 3. Card surfaces | 32 | 6 |
| 4. Buttons | 28 | 4 |
| 5. Links | 18 | 3 |
| 6. Segment pills / toggles | 8 | 1 |
| 7. Status / state indicators | 14 | 5 |
| 8. Skeletons / loading | 22 | 2 |
| 9. Empty-state ghosts | 8 | 2 |
| 10. Borders and dividers | 26 | 9 |
| 11. Focus rings | 0 canonical | 8 (none defined anywhere) |
| 12. Animations on state change | 12 | 2 |
| 13. Caret rotation drift | 9 | 1 |
| 14. Solid/glass mode parity | 6 branches | 4 |
| 15. Card surface shade consistency | 5 distinct values | 5 |
| 16. Hardcoded colours as tokens | ~35 | ~35 |
| 17. hover-row / hover-link patterns | 12 | 3 |

---

## Category 1 — Accordions / Collapsibles

### Canonical pattern
```
<div className={`agent-acc${open ? " open" : ""}`}>
  <div className="agent-acc-in">
    <div className="agent-acc-body">…</div>
  </div>
</div>
```
Header uses `.agent-acc-hdr`. Caret uses CaretDown with `transition: "transform 200ms"` and `rotate(180deg)` when open.

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| comms | `app/agent/comms/page.tsx` | 120–141 | Ghost state: hardcodes `agent-acc open` class directly on element, no toggle. Uses `.agent-acc-hdr`, `.agent-acc-in`, `.agent-acc-body` | Ghost is always-open, no toggle needed — **not drift**, but note the static state |
| comms | `components/comms/CommsActivityFeed.tsx` | 62–78 | Canonical: `.agent-acc-hdr` header, `agent-acc${open ? " open" : ""}`, `.agent-acc-in`. CaretDown with `rotate(180deg)` + `transition: "transform 200ms"` | Correct |
| completions | `app/agent/completions/page.tsx` | 144–174 | Ghost groups use `agent-acc open` static — always open (correct for ghost skeleton) | No drift — ghost is decorative |
| completions | `components/completions/CompletionsGroupList.tsx` | 41–102 | Canonical: `.agent-acc-hdr` (as div with role="button"), `agent-acc${isOpen ? " open" : ""}`, `.agent-acc-in`, `.agent-acc-body`. CaretDown via Tailwind `rotate-180` class | **Drift:** Uses `className={`…transition-transform duration-200${isOpen ? " rotate-180" : ""}`}` — Tailwind rotation instead of inline style `transform`. Functionally equivalent but differs from other accordions |
| work-queue | `components/reminders/FileAlertsStrip.tsx` | 76–150 | Canonical `agent-acc` / `agent-acc-in`. No separate body wrapper | No `agent-acc-body` — structural variant. No drift from spec but inconsistent with other usages |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 760–787 | Each urgency group: `agent-acc${!isCollapsed ? " open" : ""}` / `agent-acc-in`. No body wrapper | Consistent with FileAlertsStrip, no agent-acc-body. **Medium drift:** Missing `agent-acc-body` that other accordions use |
| to-do | `components/agent/AgentTodoList.tsx` | 273–281 | Done toggle: `agent-acc${showDone ? " open" : ""}` / `agent-acc-in`. CaretDown with inline `transform` rotation | Correct. CaretDown with `transition: "transform 200ms"` and `rotate(180deg)` — canonical |
| new-v2 | `components/transactions-v2/form/SectionAccordion.tsx` | 36–43 | Canonical `agent-acc${expanded ? " open" : ""}` / `agent-acc-in` / `agent-acc-body`. Uses `agent-glass-strong` outer | **Drift:** Uses `CaretUp` for open state instead of rotating `CaretDown`. Only accordion in the codebase that imports and uses `CaretUp` as a separate icon rather than rotating CaretDown |
| new-v2 | `components/transactions-v2/NewSaleFlow.tsx` | 1109 | `isSolid` branch changes background inline — not an accordion |  |
| transaction-detail | `components/milestones/MilestonePanel.tsx` | via MilestoneRow | Milestone sections rendered via MilestoneRow which uses `agent-reveal-in` for content disclosure, not accordion pattern | Not accordion — different pattern |
| transaction-detail | `components/transaction/TransactionNotes.tsx` | 127–135 | "Show N more" expand via `setExpanded(true)` — no animation wrapper, no accordion class | **Drift:** Expand has no animation class. Plain state toggle with no transition |
| transaction-detail | `app/agent/transactions/[id]/page.tsx` | 372–381 | PropertyFileTabs component handles tab-based accordion — not read in depth but uses hero-tabs pattern | Tab pattern, not accordion |

---

## Category 2 — Dropdowns / menus

### Canonical pattern
Portal-rendered div with class `.agent-dropdown-in` (open) / `.agent-dropdown-out` (closing). Background `rgba(255,255,255,0.97)`. Border `1px solid rgba(0,0,0,0.07)`. BoxShadow `0 8px 24px rgba(0,0,0,0.12)`. Items use `.agent-dropdown-item`.

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 120–155 | AssignedToChip: portal `.agent-dropdown-in`/`.agent-dropdown-out`, canonical bg/border/shadow | Canonical |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 194–236 | RiskChip: same portal pattern | Canonical |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 281–309 | ManagedByChip: same portal pattern | Canonical |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 356–398 | ActivityFilterChip: same portal pattern | Canonical |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 158–170 | ActivityVerbChip hover popover: `.agent-dropdown-in`/`.agent-dropdown-out`. `pointerEvents: "none"` on popover | **Drift:** Popover is pointer-events:none (info only, not interactive). Background still `rgba(255,255,255,0.97)` — canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 104–150 | SideSnoozeMenu: `.agent-dropdown-in`, canonical bg/border/shadow. No `.agent-dropdown-out` (only checks `open`, no closing animation) | **Drift:** Missing `.agent-dropdown-out` closing animation. Instant unmount on close |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 152–219 | RowSnoozeMenu: same — `.agent-dropdown-in` only, no `.agent-dropdown-out` | **Drift:** Missing closing animation — inconsistent with TransactionListWithSearch chips |
| comms | `app/agent/comms/page.tsx` | 77–90 | `comms-filter-bar` / `comms-filter-pill` — a custom pill row, not a dropdown. Filter pills are inline links, not a revealed menu | Not a dropdown. Uses canonical `.comms-filter-pill` class with `.on` modifier |

---

## Category 3 — Card surfaces

### Canonical pattern hierarchy
- `.glass-card` — primary content card (warm cream glass)
- `.agent-glass` — section-level card (lighter)
- `.agent-glass-strong` — stronger/opaque card for containers
- `.agent-glass-light` — lightest variant (activity ribbon etc.)
- `--agent-surface-elevated` — CSS variable for elevated glass

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| hub | `app/agent/hub/page.tsx` | 119 | `.agent-glass` — welcome CTA card | Canonical |
| hub | `app/agent/hub/page.tsx` | 148, 163 | `.agent-glass` — ghost pipeline health + momentum | Canonical |
| hub | `app/agent/hub/page.tsx` | 173 | `.agent-glass-strong` — ghost attention list | Canonical |
| hub | `app/agent/hub/page.tsx` | 205, 215 | `.agent-glass` — ghost exchange forecast + service split | Canonical |
| hub | `app/agent/hub/page.tsx` | 253 | `.agent-glass` — today's diary card | Canonical |
| hub | `app/agent/hub/page.tsx` | 310 | `.agent-glass` — pipeline health card | Canonical |
| hub | `app/agent/hub/page.tsx` | 518 | `.agent-glass` — momentum card | Canonical |
| hub | `app/agent/hub/page.tsx` | 566 | `.agent-glass` — exchange forecast card | Canonical |
| hub | `app/agent/hub/page.tsx` | 635 | `.agent-glass` — service split card | Canonical |
| hub | `app/agent/hub/page.tsx` | 719 | `.agent-glass-light hub-activity-ribbon` | Canonical but uses combo class |
| work-queue | `app/agent/work-queue/page.tsx` | 76 | `.agent-glass-strong` — empty state | Canonical |
| work-queue | `app/agent/work-queue/page.tsx` | 100 | `.agent-glass-strong` — ghost reminder group | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 478, 665, 719, 792 | `.agent-glass-strong` — filter bar, all-caught-up, filtered empty, snoozed empty | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 477–490 | `SplitFileCard`: `.agent-glass-strong` outer. Header: `rgba(255,255,255,0.28)` inline background | **Drift:** `rgba(255,255,255,0.28)` is a bespoke hardcoded value — not a CSS token. Should be `var(--agent-surface-glass)` or similar |
| work-queue | `components/reminders/FileAlertsStrip.tsx` | 39 | `.agent-glass-strong` | Canonical |
| transaction-list | `app/agent/transactions/page.tsx` | 209, 273 | `.agent-glass-strong` — empty states | Canonical |
| transaction-list | `components/transactions/TransactionTable.tsx` | 107 | `.agent-glass-strong` | Canonical |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 554 | `.tl-card` — custom class (not agent-glass family) | **Note:** `tl-card` is a page-specific CSS class, not in the canonical family. Its styling is in `globals.css` — acceptable as a page-level surface, but note the divergence from the agent-glass system |
| comms | `app/agent/comms/page.tsx` | 96 | `.glass-card` — empty state | **Drift:** All other pages use `.agent-glass-strong` for empty states; comms uses `.glass-card`. Inconsistent empty-state surface |
| comms | `app/agent/comms/page.tsx` | 115 | `.agent-glass` — ghost day-bucket | Canonical |
| comms | `components/comms/CommsActivityFeed.tsx` | 61 | `.agent-glass` — day bucket wrapper | Canonical |
| comms | `components/comms/CommsActivityFeed.tsx` | 80 | `.glass-card` — transaction card inside day bucket | Mixed: `glass-card` inside `agent-glass` container. Intentional nesting (content card inside section) |
| completions | `app/agent/completions/page.tsx` | 116 | `.glass-card` — empty state | **Drift:** Uses `.glass-card` not `.agent-glass-strong`. Inconsistent with work-queue and transaction-list empty states |
| completions | `app/agent/completions/page.tsx` | 136, 165 | `.agent-glass` — ghost groups | Canonical |
| completions | `components/completions/CompletionsGroupList.tsx` | 41 | `.agent-glass` — group wrapper | Canonical |
| completions | `components/completions/CompletionsGroupList.tsx` | 89–92 | `glass-card block px-5 py-4 border ${s.border}` — file card inside group | `.glass-card` with urgency-border Tailwind class. Mixed: Tailwind border class layered on `.glass-card` |
| to-do | `components/agent/AgentTodoList.tsx` | 119, 136 | `.glass-card` — empty state + ghost | `glass-card` for empty, not `agent-glass-strong`. **Drift** from pattern |
| to-do | `components/agent/AgentTodoList.tsx` | 295 | `.glass-card` — task group card | Canonical for task cards — `glass-card` is the content card |
| to-do | `app/agent/to-do/loading.tsx` | 30, 58 | `.glass-card` — skeleton task groups | Canonical for task-card shape |
| to-do | `components/todos/AddManualTaskForm.tsx` | 100 | `.glass-card p-4 space-y-3 agent-reveal-in` — add form | Canonical |
| transaction-detail | `components/transaction/TransactionSidebar.tsx` | 184, 203, 246 | `.glass-card rounded-[12px]` — sidebar cards | Canonical for sidebar. The `rounded-[12px]` is an explicit Tailwind override — minor redundancy if `glass-card` already sets radius |
| transaction-detail | `components/transaction/TransactionNotes.tsx` | 74 | `.glass-card overflow-hidden rounded-[12px]` | Same pattern as sidebar — canonical |

---

## Category 4 — Buttons

### Canonical classes
- `.agent-btn` — base (includes press-down `:active` scale 0.98)
- `.agent-btn-primary` — coral fill
- `.agent-btn-sm` / `.agent-btn-md` — sizes
- `.agent-btn-ghost` — borderless ghost
- `.agent-btn-ghost-bordered` — ghost with border
- `.agent-btn-secondary` — secondary action
- `.agent-icon-btn` / `.agent-icon-btn-sm` — icon buttons

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| hub | `app/agent/hub/page.tsx` | 108 | `<Link className="agent-btn agent-btn-primary agent-btn-sm">` | Canonical |
| hub | `app/agent/hub/page.tsx` | 138 | `<Link className="agent-btn agent-btn-primary agent-btn-md">` | Canonical |
| hub | `app/agent/hub/page.tsx` | 237 | `<Link className="agent-btn agent-btn-primary agent-btn-sm">` | Canonical |
| transaction-list | `app/agent/transactions/page.tsx` | 127 | `<Link className="agent-btn agent-btn-primary agent-btn-sm">` | Canonical |
| transaction-list | `app/agent/transactions/page.tsx` | 246 | `<Link className="agent-btn agent-btn-primary agent-btn-md">` | Canonical |
| transaction-list | `components/transactions/TransactionTable.tsx` | 134–148 | Sort header buttons: plain `<button>` with inline styles. `background: "none", border: "none", cursor: "pointer"` | **Drift:** Plain `<button>` with no canonical class. No press-down affordance, no agent-btn. Sort buttons are intentionally bespoke for the table header — probably acceptable, but note the gap |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 578, 675 | `agent-icon-btn agent-icon-btn-sm` for search clear | Canonical |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 608 | `agent-link agent-link-muted tl-bar-clear` for clear filters | Using `.agent-link` as a button — **Drift:** button styled as link for "Clear filter". Correct visually but semantically ambiguous |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 115 | `agent-btn agent-btn-sm agent-btn-ghost` — snooze button | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 184 | `agent-btn agent-btn-sm agent-btn-secondary` — row snooze | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 342 | `agent-btn agent-btn-sm agent-btn-secondary` — Done button | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 364 | `agent-btn agent-btn-sm agent-btn-primary` — Chase button | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 750–756 | `agent-link agent-link-muted` for Show/Hide collapse toggle | `agent-link` used as button — same pattern as transaction-list Clear filter. **Medium drift:** Buttons that are visually links |
| work-queue | `components/reminders/FileAlertsStrip.tsx` | 65–70 | `agent-link agent-link-muted` for Show/Hide collapse toggle | Same as above |
| to-do | `components/agent/AgentTodoList.tsx` | 265–269 | `agent-link agent-link-muted` for "Show N completed" toggle with CaretDown | Same pattern — `agent-link` as button |
| to-do | `components/todos/AddManualTaskForm.tsx` | 88 | `agent-btn agent-btn-sm agent-btn-ghost-bordered` — "Add to-do" | Canonical |
| to-do | `components/todos/AddManualTaskForm.tsx` | 154 | `agent-link agent-link-muted` — Cancel | Link as button |
| to-do | `components/todos/AddManualTaskForm.tsx` | 157 | `agent-btn agent-btn-sm agent-btn-primary` — Add | Canonical |
| to-do | `components/agent/AgentTodoList.tsx` | 347–370 | Task toggle: plain `<button>` with inline border/background/cursor styles. `.p-2 -m-2` tap area wrapper | **Drift:** Circular toggle button entirely bespoke. No canonical class. No press-down affordance |
| transaction-detail | `components/transaction/TransactionNotes.tsx` | 108–116 | Delete button: `agent-icon-btn agent-icon-btn-sm` | Canonical |
| transaction-detail | `components/transaction/TransactionNotes.tsx` | 147–152 | Submit button: `agent-btn agent-btn-sm agent-btn-primary` | Canonical |
| transaction-detail | `app/agent/transactions/[id]/page.tsx` | 375 | Tab chain-link inline in page — no buttons visible; PropertyFileTabs handles tabs | n/a |
| new-v2 | `components/transactions-v2/HeroCard.tsx` | 78 | `agent-icon-btn agent-icon-btn-sm` — draft delete ×  | Canonical |
| new-v2 | `components/transactions-v2/form/SectionAccordion.tsx` | 21 | `agent-acc-hdr w-full` on a `<button>` — accordion trigger | **Drift:** Button uses `agent-acc-hdr` class (a div-level class) as its own class. `agent-acc-hdr` is not designed for `<button>` elements. Works but semantics unusual |

---

## Category 5 — Links

### Canonical classes
- `.agent-link` — primary coloured link (coral, underlines on hover)
- `.agent-link-muted` — secondary muted link
- `.agent-hover-row` — full-row hover on `<Link>` or wrapper divs

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| hub | `app/agent/hub/page.tsx` | 272–299 | Diary row: `<Link className="agent-hover-row">` | Canonical |
| hub | `app/agent/hub/page.tsx` | 383–394 | Pipeline stats clickable cells: `<Link className="agent-press-cell">` | **Note:** `agent-press-cell` is a custom class — not in the canonical link family. Provides press-down on links. Not drift, but a separate pattern not used elsewhere in these 9 pages |
| hub | `app/agent/hub/page.tsx` | 486, 497, 441 | "Coming up" strip links: `className="coming-up-link"` | **Drift:** `coming-up-link` is a page-specific CSS class. Not `.agent-link`. Styling unknown without reading globals.css, but the class name is custom |
| hub | `app/agent/hub/page.tsx` | 748 | `<Link className="agent-link">` — "View file" | Canonical |
| hub | `components/hub/AttentionListView.tsx` | 52 | `<Link className="agent-link">` — "All reminders" | Canonical |
| hub | `components/hub/AttentionListView.tsx` | 77–89 | Attention rows: `<Link className="agent-hover-row">` | Canonical |
| transaction-list | `app/agent/transactions/page.tsx` | 163–169 | Clear filter: `<Link className="agent-link agent-link-muted">` | Canonical |
| transaction-list | `app/agent/transactions/page.tsx` | 197–203 | Clear month filter: same | Canonical |
| transaction-list | `app/agent/transactions/page.tsx` | 279, 299, 317 | EmptyState action links: `<Link className="agent-link">` | Canonical |
| transaction-list | `components/transactions/TransactionTable.tsx` | 640–659 | Status tab Links: `<Link className="agent-tab">` | Not `.agent-link` — `.agent-tab` is the correct class for tabs. Canonical |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 265–306 | Mobile row: `<Link className="flex md:hidden agent-hover-row">` | Canonical |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 314–318 | Desktop row: `<Link className="hidden md:grid items-center agent-hover-row group">` | Canonical |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 200–210 | VendorBuyerLine "Names not set": `color: "rgba(180,87,9,0.40)"` inline on `<p>` | **Drift:** Hardcoded rgba colour on text content — not a token. Should be `var(--agent-warning)` or similar |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 492–499 | Address link: `<Link className="agent-link">` | Canonical |
| work-queue | `components/reminders/FileAlertsStrip.tsx` | 136–139 | Action link: `<Link className="agent-link agent-link-muted">` | Canonical |
| comms | `components/comms/CommsActivityFeed.tsx` | 81–84 | Transaction link: `<Link className="comms-tx-link">` | **Note:** Custom class `comms-tx-link` — not `.agent-link`. Styling unknown without globals.css but bespoke |
| to-do | `components/agent/AgentTodoList.tsx` | 298–305 | Transaction address link: `hover:underline` Tailwind class inline | **Drift:** No `.agent-link` — uses raw Tailwind `hover:underline`. No canonical colour, no canonical hover treatment |
| transaction-detail | `components/transaction/PropertyHero.tsx` | 110–113 | Back link: `<Link className="agent-link agent-link-muted">` | Canonical |

---

## Category 6 — Segment pills / toggles

### Canonical pattern
`.agent-segment-pill` + `.agent-segment-pill-sm` + `.on` modifier

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| work-queue | `components/reminders/AgentRemindersList.tsx` | 701–704 | All/Seller/Buyer filter: `agent-segment-pill agent-segment-pill-sm` with `.on` | Canonical |
| transaction-list | `components/transactions/ForecastStrip.tsx` | 99, 123 | Month pills: `agent-segment-pill agent-segment-pill-sm` with `.on`. Both `<span>` (empty) and `<Link>` (populated) | Canonical. Note: empty pills are `<span>` not `<Link>` — correct for aria-disabled pills |
| to-do | `components/todos/AddManualTaskForm.tsx` | 128–136 | Mine/Your progressor ownership toggle: `agent-segment-pill agent-segment-pill-sm` with `.on` | Canonical |
| new-v2 | `components/transactions-v2/form/Stage2Sections.tsx` | (inferred — OutsourcedBanner and PortalInvitePrompt use them) | Forms use `agent-segment-pill` for option selectors | Canonical |
| comms | `app/agent/comms/page.tsx` | 78–89 | `comms-filter-pill` with `.on` — filter toggle | **Drift:** Custom class `comms-filter-pill` instead of `agent-segment-pill`. Different visual treatment even if functionally equivalent |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 100–106 | Chip triggers use `agent-tab tl-bar-chip` with `.on` — not segment pills | **Note:** Filter chips use `.agent-tab` + `.tl-bar-chip`, not `.agent-segment-pill`. Intentional design choice (tab affordance vs pill affordance), but creates two toggle systems |

---

## Category 7 — Status / state indicators

### Canonical
- `.agent-pill-active`, `.agent-pill-hold`, `.agent-pill-completed`, `.agent-pill-withdrawn` — status pills
- `var(--agent-success)`, `var(--agent-warning)`, `var(--agent-danger)`, `var(--agent-info)` — semantic colours
- Urgency dots: inline `<span>` with `background: colorValue, borderRadius: "50%"`

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| transaction-list | `components/transactions/TransactionRowView.tsx` | 230–243 | Risk stripe: `bg-red-500` / `bg-amber-400` / `bg-emerald-500` Tailwind classes | **Drift:** Hardcoded Tailwind colour classes, not CSS token variables. Should be `var(--agent-danger)`, `var(--agent-warning)`, `var(--agent-success)` |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 88–92 | ACTIVITY_TONE: `rgba(16,185,129,0.10)` / `rgba(245,158,11,0.12)` / `rgba(239,68,68,0.10)` for chip backgrounds; `#059669` / `#b45309` / `#dc2626` for foreground | **Drift:** All hardcoded hex and rgba values. Not CSS tokens |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 245–254 | Service tag: `bg-indigo-50/70 text-indigo-500 border-indigo-100` / `bg-slate-100/60 text-slate-400 border-slate-200/40` Tailwind | **Drift:** Bespoke Tailwind colour utilities for service type badge. No token equivalent |
| completions | `components/completions/CompletionFileRowView.tsx` | 33–38 | GROUP_STYLES: `bg-red-500` / `bg-amber-500` / `bg-blue-500` / `bg-slate-400` / `bg-slate-300` dot classes; `text-red-600` / `text-amber-600` / `text-blue-600` / `text-slate-900/60` label classes | **Drift:** Urgency dots use Tailwind colour classes, not tokens |
| completions | `app/agent/completions/page.tsx` | 21–26 | GROUP_STYLES_STAT: `statColor: "#dc2626"`, `"#d97706"`, `"#3b82f6"`, `"rgba(15,23,42,0.5)"`, `"rgba(15,23,42,0.4)"` | **Drift:** Hardcoded hex colours for stat row colours on the page — not tokens. These are only used as `statColor` in the `GROUP_STYLES_STAT` record but are not actually rendered anywhere in the visible page (only `pillColor` is used) — may be dead code |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 65–71 | GROUP_LEFT_BORDER: `"#dc2626"`, `"#ea580c"`, `"#d97706"`, `"rgba(148,163,184,0.35)"`, `"rgba(168,85,247,0.5)"` | **Drift:** Hardcoded hex for left border colours. Not tokens |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 249–253 | SideColumn dot/label colours: `dotColor = "#ea580c"` / `"#3b82f6"`, `columnBg = "rgba(251,146,60,0.06)"` / `"rgba(59,130,246,0.06)"`, `labelColor = "#ea580c"` / `"#3b82f6"` | **Drift:** All hardcoded hex and rgba, not tokens. Seller = orange, Buyer = blue — but using raw colour values |
| hub | `app/agent/hub/page.tsx` | 338–340 | "Need attention" stat colour: `color: escalatedCount > 0 ? "var(--agent-danger)" : attentionFileCount > 0 ? "var(--agent-warning)" : "var(--agent-text-primary)"` | Canonical — uses tokens |
| hub | `components/hub/AttentionListView.tsx` | 13–32 | URGENCY_STYLE: uses `var(--agent-danger)`, `rgba(var(--agent-danger-rgb),0.05)`, `var(--agent-warning)`, `rgba(var(--agent-warning-rgb),0.05)`, `var(--agent-coral)`, `var(--agent-coral-bg-tint)` | Mostly canonical with RGB tokens for alpha variants |
| to-do | `components/agent/AgentTodoList.tsx` | 356–360 | Task toggle button border: `var(--agent-warning)` for progressor, `var(--agent-info-border)` for own task. Background: `var(--agent-success)` when done | Canonical |
| to-do | `components/agent/AgentTodoList.tsx` | 363 | Spinner: `border: "1.5px solid var(--agent-border-default)", borderTopColor: "var(--agent-text-secondary)"` | Canonical |
| hub | `app/agent/hub/page.tsx` | 264–266 | Diary type indicator: `"var(--agent-success)"` / `"var(--agent-coral)"` for borderLeft colours | Canonical |
| hub | `app/agent/hub/page.tsx` | 294 | Diary type label colour: `"var(--agent-success)"` / `"var(--agent-coral-deep)"` | Canonical |

---

## Category 8 — Skeletons / loading

### Canonical pattern
`.agent-skeleton` class. Borders on skeleton cards should use `var(--agent-border-subtle)`.

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| hub | `app/agent/hub/page.tsx` | 155–200 | Multiple `.agent-skeleton` shapes for ghost pipeline, momentum, attention, forecast, service split | All use `.agent-skeleton` — canonical |
| work-queue | `app/agent/work-queue/page.tsx` | 98–112 | Ghost reminder rows: `.agent-skeleton` shapes inside `agent-glass-strong` | Canonical |
| to-do | `app/agent/to-do/loading.tsx` | 7–8 | PageHeader pill slots: `.agent-skeleton` style pills | Canonical |
| to-do | `app/agent/to-do/loading.tsx` | 16–17 | Add task form skeleton: single `.agent-skeleton` button shape | Canonical |
| to-do | `app/agent/to-do/loading.tsx` | 21–24 | Section header skeletons: `.agent-skeleton` | Canonical |
| to-do | `app/agent/to-do/loading.tsx` | 30–48 | Task group skeletons: `.agent-skeleton` inside `.glass-card` | **Drift:** Skeleton uses `.glass-card` not `.agent-glass-strong`. Border on `glass-card` comes from the class itself — acceptable but inconsistent with other skeleton containers which use `agent-glass-strong` |
| to-do | `app/agent/to-do/loading.tsx` | 58–75 | Second section skeleton: same `.glass-card` with `.agent-skeleton` items | Same as above |
| comms | `app/agent/comms/page.tsx` | 117–141 | Ghost day-bucket: `.agent-skeleton` shapes inside `agent-glass` / `glass-card` | Canonical |
| completions | `app/agent/completions/page.tsx` | 138–174 | Ghost groups: `.agent-skeleton` inside `agent-glass` + `agent-acc-hdr` | Canonical |
| to-do | `components/agent/AgentTodoList.tsx` | 131–151 | Empty state ghost: `.agent-skeleton` shapes inside `glass-card` | Same glass-card/skeleton pairing |
| work-queue | `app/agent/work-queue/page.tsx` | 98 | Ghost skeleton count badge: `.agent-skeleton` style { height: 18, width: 22, borderRadius: 99 } | Canonical |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | n/a | No skeleton — client component, no loading state shown | n/a |

---

## Category 9 — Empty-state ghosts

### Canonical pattern
Ghost preview sections should use:
- `opacity: 0.35` (audit target — some may still be at 0.3 or 0.5)
- `pointerEvents: "none"`
- `.agent-skeleton` shapes only (no fake text content)

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| hub | `app/agent/hub/page.tsx` | 147 | Ghost pipeline health + momentum: `opacity: 0.3, pointerEvents: "none"` | **Drift:** Opacity 0.3 — should be 0.35 |
| hub | `app/agent/hub/page.tsx` | 172 | Ghost attention: `opacity: 0.3, pointerEvents: "none"` | **Drift:** Opacity 0.3 — should be 0.35 |
| hub | `app/agent/hub/page.tsx` | 204 | Ghost forecast + service split: `opacity: 0.3, pointerEvents: "none"` | **Drift:** Opacity 0.3 — should be 0.35 |
| work-queue | `app/agent/work-queue/page.tsx` | 90 | Ghost reminder groups: `opacity: 0.5, pointerEvents: "none"` | **Drift:** Opacity 0.5 — higher than canonical 0.35 |
| comms | `app/agent/comms/page.tsx` | 114 | Ghost day-bucket: `opacity: 0.4, pointerEvents: "none"` | **Drift:** Opacity 0.4 — not 0.35 |
| completions | `app/agent/completions/page.tsx` | 134 | Ghost groups: `opacity: 0.35, pointerEvents: "none"` | Canonical — correct |
| to-do | `components/agent/AgentTodoList.tsx` | 131 | Ghost task section: `opacity: 0.35, pointerEvents: "none"` | Canonical — correct |
| to-do | `app/agent/to-do/loading.tsx` | n/a | Loading skeleton — not a ghost (actual loading state) | n/a |

**Summary:** Opacity is inconsistent across pages. Values found: 0.3 (hub×3), 0.4 (comms), 0.5 (work-queue), 0.35 (completions, to-do). Only completions and to-do match the canonical 0.35.

---

## Category 10 — Borders and dividers

### Canonical tokens
- `var(--agent-border-subtle)` — lightest border (e.g. row dividers)
- `var(--agent-border-default)` — standard border
- `var(--agent-border-strong)` — strong border

### Instances

| Page | File | Line | Value used | Drift flag |
|---|---|---|---|---|
| hub | `app/agent/hub/page.tsx` | 155 | `borderLeft: i > 0 ? "1px solid var(--agent-border-subtle)"` | Canonical |
| hub | `app/agent/hub/page.tsx` | 178 | `borderBottom: "0.5px solid var(--agent-border-subtle)"` | Canonical |
| hub | `app/agent/hub/page.tsx` | 190–192 | `borderLeft: "3px solid var(--agent-border-subtle)"`, `borderTop: "0.5px solid var(--agent-border-subtle)"` | Canonical |
| hub | `app/agent/hub/page.tsx` | 399, 472 | `borderTop: "1px solid var(--agent-border-subtle)"` | Canonical |
| hub | `app/agent/hub/page.tsx` | 533 | `borderTop: "0.5px solid var(--agent-border-subtle)"` | Canonical |
| hub | `app/agent/hub/page.tsx` | 601 | `borderTop: "0.5px solid var(--agent-border-subtle)"` | Canonical |
| hub | `app/agent/hub/page.tsx` | 686 | `borderTop: "0.5px solid var(--agent-border-subtle)"` | Canonical |
| transaction-list | `components/transactions/TransactionTable.tsx` | 117–120 | `borderBottom: "0.5px solid var(--agent-border-subtle)"` on header | Canonical |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 255 | `divider = "0.5px solid var(--agent-border-subtle)"` | Canonical |
| transaction-detail | `components/transaction/TransactionSidebar.tsx` | 211 | `borderTop: "1px solid var(--agent-border-default)"` | Canonical |
| comms | `app/agent/comms/page.tsx` | 124 | `.px-4 py-2.5 border-b border-white/20` — Tailwind class | **Drift:** `border-white/20` is a hardcoded Tailwind opacity-border. Should be `var(--agent-border-subtle)`. This appears inside a ghost element, but the pattern is still a gap |
| comms | `components/comms/CommsActivityFeed.tsx` | 87 | `divide-y divide-white/15` — Tailwind | **Drift:** `divide-white/15` hardcoded Tailwind. Should be `var(--agent-border-subtle)` equivalent |
| comms | `components/comms/CommsActivityFeed.tsx` | 128–130 | `borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)"` | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 326 | `borderTop: i > 0 ? "0.5px solid rgba(15,23,42,0.06)"` | **Drift:** Hardcoded `rgba(15,23,42,0.06)` — not a token. Should be `var(--agent-border-subtle)` |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 360 | `borderTop: "0.5px solid rgba(15,23,42,0.06)"` | **Drift:** Same hardcoded value |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 288, 416 | SideColumn borders: `isSeller ? "rgba(234,88,12,0.14)" : "rgba(59,130,246,0.14)"` for column border; `isSeller ? "rgba(234,88,12,0.10)" : "rgba(59,130,246,0.10)"` for header bottom | **Drift:** Bespoke semantic colours as border values — not tokens. Intentional design (seller/buyer colour coding) but no token equivalent |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 485–489 | SplitFileCard header border-radius: inline, plus `background: "rgba(255,255,255,0.28)"` on card header | **Drift:** Hardcoded rgba header background |
| to-do | `components/agent/AgentTodoList.tsx` | 296 | `borderBottom: "0.5px solid var(--agent-border-subtle)"` | Canonical |
| to-do | `components/agent/AgentTodoList.tsx` | 344 | `borderBottom: hasBorder ? "0.5px solid var(--agent-border-subtle)" : "none"` | Canonical |
| to-do | `app/agent/to-do/loading.tsx` | 31, 38, 59 | `borderBottom: "0.5px solid var(--agent-border-subtle)"` | Canonical |
| to-do | `components/todos/AddManualTaskForm.tsx` | 142 | `border-t border-white/20` — Tailwind | **Drift:** `border-white/20` hardcoded Tailwind. Should be `var(--agent-border-subtle)` |
| transaction-detail | `components/transaction/TransactionNotes.tsx` | 89 | `border: "0.5px solid var(--agent-border-default)"` | Canonical |
| completions | `components/completions/CompletionsGroupList.tsx` | 92 | `border ${s.border}` where `s.border` is `"border-red-200/40"` / `"border-amber-200/40"` etc. | **Drift:** Urgency-coloured Tailwind border on `glass-card`. Not a token — Tailwind opacity-colour utility |
| transaction-detail | `components/transaction/TransactionSidebar.tsx` | 184 | No explicit border set — `glass-card` provides it | n/a |
| new-v2 | `components/transactions-v2/HeroCard.tsx` | 50 | `border: "0.5px solid var(--nv2-border-glass)"` | Uses `--nv2-*` token family (new-v2 scoped) — acceptable within new-v2 scope |

---

## Category 11 — Focus rings

### Canonical pattern
`.agent-focus-ring` class (for inputs/interactive elements). `focusVisible` patterns. Tabs should use underline, not ring. Inputs should use ring.

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| all | All component files | — | **No `.agent-focus-ring` class found anywhere in the audited components** | **High drift:** Focus ring treatment is undefined across all 9 pages. No canonical focus state implemented in any of the 22 components read. All interactive elements rely on browser defaults or have no focus treatment |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 568 | `<input className="agent-input agent-input-sm">` | `agent-input` class may define focus ring via CSS — but no explicit focus style visible in component |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 691 | `<input className="agent-input agent-input-sm">` | Same — relies on `agent-input` CSS |
| comms | `components/comms/CommsActivityFeed.tsx` | 64–67 | Accordion header: `role="button" tabIndex={0}` — keyboard accessible but no explicit focus treatment | **Drift:** Tab-focusable element has no visible focus ring |
| completions | `components/completions/CompletionsGroupList.tsx` | 49–54 | Same pattern — `role="button" tabIndex={0}` no focus ring | **Drift:** Same gap |
| to-do | `components/agent/AgentTodoList.tsx` | 347–370 | Task toggle: `<button>` with custom styling but no focus class | **Drift:** Custom button, no focus ring |
| new-v2 | `components/transactions-v2/form/SectionAccordion.tsx` | 18 | `<button type="button" className="agent-acc-hdr w-full">` — no focus class | **Drift:** Missing focus ring |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 141–152 | ActivityVerbChip: `tabIndex={0}` with `onFocus`/`onBlur` to show/hide popover — but no visual focus ring on the span | **Drift:** Accessible focus behavior exists but no visual ring |

---

## Category 12 — Animations on state change

### Canonical classes
- `.agent-reveal-in` — entrance animation
- `.agent-reveal-out` — exit animation  
- `.agent-row-flash` — confirm flash (green briefly)
- `.agent-row-exit` — row collapse on removal

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| transaction-detail | `components/transaction/TransactionNotes.tsx` | 86 | New optimistic note: `className={isOptimistic ? "agent-reveal-in" : ""}` | Canonical |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 323 | Row in SideColumn: `className={isExiting ? "agent-row-exit" : (loading === task.id ? "agent-row-flash" : undefined)}` | Canonical — uses both exit and flash |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 802 | Snoozed card wrapper: `className={exitingIds.has(log.id) ? "agent-row-exit" : ""}` | Canonical |
| to-do | `components/todos/AddManualTaskForm.tsx` | 100 | Form reveal: `className="glass-card p-4 space-y-3 agent-reveal-in"` | Canonical |
| to-do | `components/agent/AgentTodoList.tsx` | 274 | Done toggle: `agent-acc open` drives height animation | Canonical |
| transaction-list | `components/transactions/TransactionListWithSearch.tsx` | 82–84 | Dropdown close: `setClosing(true)` → `agent-dropdown-out` class → `onAnimationEnd` unmount | Canonical — proper exit animation |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 158–170 | ActivityVerbChip popover: `agent-dropdown-in`/`agent-dropdown-out` with closing state | Canonical |
| hub | `app/agent/hub/page.tsx` | n/a | No animation classes used on state change — hub is server-rendered, no client state animations | n/a |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 104–150 | SideSnoozeMenu close: `setOpen(false)` — **no closing animation**. No `closing` state, no `agent-dropdown-out` | **Drift:** SideSnoozeMenu and RowSnoozeMenu use `open && …` pattern — instant unmount, no exit animation. Inconsistent with chip dropdowns in TransactionListWithSearch |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 152–219 | RowSnoozeMenu: same — no exit animation | **Drift:** Same gap |
| new-v2 | `components/transactions-v2/HeroCard.tsx` | 39–43 | DraftRow delete: `grid-template-rows: removing ? "0fr" : "1fr"` with `transition: "grid-template-rows 220ms"` | **Note:** Uses grid-template-rows trick for collapse, not `.agent-row-exit`. Functionally similar but a different implementation pattern |
| transaction-detail | `app/agent/transactions/[id]/page.tsx` | n/a | State animations handled by sub-components (MilestoneRow, ActivityTimeline etc.) — not visible in page-level read | n/a |

---

## Category 13 — Caret rotation drift

### Catalogue of every accordion/toggle trigger with its caret treatment

| Page | File | Line | Caret implementation | Pattern |
|---|---|---|---|---|
| comms | `components/comms/CommsActivityFeed.tsx` | 72 | `<CaretDown style={{ transition: "transform 200ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>` | Canonical — single CaretDown, inline rotation |
| completions | `components/completions/CompletionsGroupList.tsx` | 72 | `<CaretDown className="... transition-transform duration-200${isOpen ? " rotate-180" : ""}">` | Tailwind rotation — functionally same but Tailwind class not inline style |
| work-queue | `components/reminders/FileAlertsStrip.tsx` | n/a | No caret — uses "Show"/"Hide" text toggle. No icon | **Drift:** Text toggle instead of caret |
| work-queue | `components/reminders/AgentRemindersList.tsx` | 750–756 | No caret — uses "Show"/"Hide" text toggle. No icon | **Drift:** Text toggle instead of caret |
| to-do | `components/agent/AgentTodoList.tsx` | 270 | `<CaretDown size={12} style={{ transition: "transform 200ms", transform: showDone ? "rotate(180deg)" : "rotate(0deg)" }}>` | Canonical |
| new-v2 | `components/transactions-v2/form/SectionAccordion.tsx` | 31–33 | `{expanded ? <CaretUp /> : <CaretDown />}` — swaps icons | **Drift:** Swaps between CaretUp and CaretDown instead of rotating CaretDown. Only instance of this pattern |
| hub | `app/agent/hub/page.tsx` | n/a | No accordion trigger on hub (server-rendered, no collapsibles) | n/a |
| transaction-list | n/a | n/a | No accordion trigger | n/a |
| transaction-detail | `components/transaction/TransactionNotes.tsx` | 127–135 | "Show N more" expand — no caret at all | **Drift:** Text link with no caret icon. Expand affordance is a plain text button |

**Summary:** Three patterns for "open/close" caret:
1. Single `CaretDown` rotated 180deg via inline style — canonical (comms, to-do)
2. Single `CaretDown` rotated via Tailwind `rotate-180` — near-canonical (completions)
3. Swap between `CaretDown` and `CaretUp` — drift (new-v2 SectionAccordion)
4. Text-only "Show"/"Hide" with no icon — drift (work-queue FileAlertsStrip, AgentRemindersList)
5. No caret — drift (to-do notes expand)

---

## Category 14 — Solid/glass mode parity

### Context
`useSolidMode()` hook drives `isSolid` branch in new-v2 components. Other pages do not use `isSolid`. Concern: elements with a glass branch but no solid branch, or vice versa.

### Instances

| Page | File | Line | isSolid branch | Glass branch | Gap |
|---|---|---|---|---|---|
| new-v2 | `components/transactions-v2/HeroCard.tsx` | 97–211 | `isSolid = true` → `background: "#ffffff"`, `backdropFilter: "none"`, `border: "1px solid var(--nv2-border-dark)"` | glass: `var(--nv2-surface-glass)`, `blur(24px)`, `0.5px solid var(--nv2-border-glass)` | Note in code (line 47–49): "isSolid:true branch unreachable in night-mode-eligible contexts" — **isSolid branch may be dead code** |
| new-v2 | `components/transactions-v2/DraftPanel.tsx` | 44–51, 107–117 | Same pattern — `isSolid ? "#ffffff"` vs `var(--nv2-surface-raised)`. Note: same dead code warning at line 47–49 | Same | Same dead code concern |
| new-v2 | `components/transactions-v2/form/OutsourcedBanner.tsx` | 16–17 | `isSolid ? "rgba(var(--agent-coral-base-rgb), 0.10)"` vs `rgba(var(--agent-coral-base-rgb), 0.05)`. Border: `isSolid ? "1px solid ..."` vs `"0.5px solid ..."` | Note: same dead code comment | Branching on both bg and border — more complete |
| new-v2 | `components/transactions-v2/form/PortalInvitePrompt.tsx` | 33 | Same isSolid branch structure with dead code note | Same | Same |
| new-v2 | `components/transactions-v2/NewSaleFlow.tsx` | 1109 | One `isSolid` branch for a background value | Complete | n/a |
| all non-new-v2 pages | All other components | — | No `useSolidMode` or `isSolid` | No solid branch | **Gap:** All components outside `transactions-v2/` have no solid mode. If solid mode is applied at a layout level that affects these pages, their glass surfaces (glass-card, agent-glass etc.) have no solid fallback |

**Coloured trim in solid mode:** The `agent-glass-strong` / `glass-card` classes used across all pages are CSS-class-based. Their solid-mode behaviour is entirely in `globals.css` (not read in this audit). The concern is whether the CSS class itself handles solid vs glass, or if it's purely glass-only. This cannot be determined from component reads alone.

---

## Category 15 — Card surface shade consistency

### All card background rgba values found

| Value | Component / context | Token equivalent? |
|---|---|---|
| `rgba(255,255,255,0.97)` | Dropdown menus in TransactionListWithSearch, TransactionRowView, AgentRemindersList (multiple) | No token — hardcoded |
| `rgba(255,255,255,0.28)` | SplitFileCard header background in AgentRemindersList | No token — hardcoded |
| `rgba(255,255,255,0.40)` | NewSaleFlow line 1109 (isSolid=false branch) | No token — hardcoded |
| `#ffffff` | DraftPanel, HeroCard in `isSolid=true` branch | No token for solid |
| `var(--nv2-surface-glass)` | HeroCard, DraftPanel (glass branch) | nv2-scoped token |
| `var(--nv2-surface-raised)` | DraftPanel (glass branch) | nv2-scoped token |
| `var(--agent-surface-elevated)` | PropertyHero background | Agent-scoped token |
| `var(--agent-surface-glass)` | TransactionNotes note items | Agent-scoped token |
| CSS class `.glass-card` | Many components — actual rgba value defined in globals.css | Unknown without reading CSS |
| CSS class `.agent-glass` | Many components | Unknown without reading CSS |
| CSS class `.agent-glass-strong` | Many components | Unknown without reading CSS |
| Column backgrounds `rgba(251,146,60,0.06)` / `rgba(59,130,246,0.06)` | AgentRemindersList seller/buyer columns | No token — hardcoded semantic |

**Summary:** Dropdown menus are the most consistently hardcoded surface: all 5 dropdown popover instances use `rgba(255,255,255,0.97)`. The `.glass-card` class system (values unknown) likely defines the canonical card bg. The `rgba(255,255,255,0.28)` on the SplitFileCard header is the most notable bespoke value.

---

## Category 16 — Hardcoded colours that should be tokens

### All instances of #hex or rgba() mapping to a semantic concept

| Page | File | Line | Value | Semantic meaning | Should be |
|---|---|---|---|---|---|
| transaction-list | `TransactionRowView.tsx` | 88–92 | `rgba(16,185,129,0.10)`, `#059669` | Success/moving | `var(--agent-success)`, `rgba(var(--agent-success-rgb),0.10)` |
| transaction-list | `TransactionRowView.tsx` | 88–92 | `rgba(245,158,11,0.12)`, `#b45309` | Warning/stalled | `var(--agent-warning)`, etc. |
| transaction-list | `TransactionRowView.tsx` | 88–92 | `rgba(239,68,68,0.10)`, `#dc2626` | Danger/stale | `var(--agent-danger)`, etc. |
| transaction-list | `TransactionRowView.tsx` | 88–92 | `#10b981`, `#f59e0b`, `#ef4444` | Dot colours for activity state | Token variants |
| transaction-list | `TransactionRowView.tsx` | 200–210 | `rgba(180,87,9,0.40)` | Warning muted (Names not set) | `var(--agent-warning)` at opacity |
| work-queue | `AgentRemindersList.tsx` | 65–71 | `#dc2626`, `#ea580c`, `#d97706` | Danger, escalated orange, warning amber | `var(--agent-danger)`, custom tokens |
| work-queue | `AgentRemindersList.tsx` | 65–71 | `rgba(148,163,184,0.35)` | Upcoming/muted border | `var(--agent-border-subtle)` or muted token |
| work-queue | `AgentRemindersList.tsx` | 65–71 | `rgba(168,85,247,0.5)` | Purple/snoozed | No existing token — new concept |
| work-queue | `AgentRemindersList.tsx` | 249–253 | `#ea580c`, `#3b82f6` | Seller orange, buyer blue | No existing tokens for these |
| work-queue | `AgentRemindersList.tsx` | 249–253 | `rgba(251,146,60,0.06)`, `rgba(59,130,246,0.06)` | Column bg for seller/buyer | No existing tokens |
| work-queue | `AgentRemindersList.tsx` | 296 | `rgba(15,23,42,0.35)` | Muted text | `var(--agent-text-muted)` |
| work-queue | `AgentRemindersList.tsx` | 313 | `rgba(15,23,42,0.35)` | Muted text (upcoming urgency) | `var(--agent-text-muted)` |
| work-queue | `AgentRemindersList.tsx` | 326, 360 | `rgba(15,23,42,0.06)` | Very subtle border | `var(--agent-border-subtle)` |
| work-queue | `AgentRemindersList.tsx` | 426 | `rgba(15,23,42,0.28)` | Placeholder text | `var(--agent-text-disabled)` |
| completions | `CompletionFileRowView.tsx` | 33–38 | `bg-red-500`, `bg-amber-500`, `bg-blue-500`, `bg-slate-400`, `bg-slate-300` | Urgency dots | Tokens |
| completions | `CompletionFileRowView.tsx` | 33–38 | `text-red-600`, `text-amber-600`, `text-blue-600`, `text-slate-900/60` | Urgency labels | Tokens |
| completions | `CompletionFileRowView.tsx` | 33–38 | `border-red-200/40`, `border-amber-200/40`, `border-blue-200/40`, `border-white/20`, `border-white/15` | Urgency card borders | Tokens |
| completions | `app/agent/completions/page.tsx` | 21–26 | `"#dc2626"`, `"#d97706"`, `"#3b82f6"` | Danger/warning/info stat colours | Tokens (possibly dead code) |
| comms | `CommsActivityFeed.tsx` | 90 | `bg-violet-100`, `bg-emerald-100` | Portal/agent confirmed indicators | Token missing |
| comms | `CommsActivityFeed.tsx` | 91 | `text-violet-600`, `text-emerald-600` | Same | Token missing |
| comms | `CommsActivityFeed.tsx` | 98–104 | `bg-blue-50 text-blue-600`, `bg-emerald-50 text-emerald-700` | Vendor/Purchaser side badges | Token missing |
| comms | `CommsActivityFeed.tsx` | 103–105 | `bg-violet-50 text-violet-600 border border-violet-200` | Client-confirmed badge | Token missing |
| comms | `CommsActivityFeed.tsx` | 87 | `divide-white/15` | Row divider | `var(--agent-border-subtle)` |
| to-do | `AddManualTaskForm.tsx` | 142 | `border-white/20` | Section divider | `var(--agent-border-subtle)` |
| to-do | `AddManualTaskForm.tsx` | 103 | `text-blue-500` | Transaction address text | No token |
| to-do | `AddManualTaskForm.tsx` | 157 | Error `text-red-500` | Error state | `var(--agent-danger)` |
| to-do | `TransactionNotes.tsx` | 157 | `text-red-500` | Error text | `var(--agent-danger)` |
| transaction-list | `TransactionRowView.tsx` | 246–253 | `bg-indigo-50/70 text-indigo-500 border-indigo-100` | Outsourced service type badge | No token |

**Summary:** The highest concentration of hardcoded colours is in `AgentRemindersList.tsx` (work-queue) and `TransactionRowView.tsx` (transaction-list). The `CommsActivityFeed.tsx` has a cluster of violet/emerald/blue hardcoded Tailwind classes for milestone badges. Many of these represent genuinely new semantic concepts (seller/buyer colour coding, portal confirmation, snoozed state) that currently have no token — they need tokens created, not just adoption.

---

## Category 17 — `agent-hover-row` / `agent-hover-link` patterns

### Canonical
`.agent-hover-row` on `<Link>` or wrapping `<div>` provides hover background. Rows in lists should consistently use this.

### Instances

| Page | File | Line | Implementation | Drift flag |
|---|---|---|---|---|
| hub | `app/agent/hub/page.tsx` | 284 | Diary row `<Link className="agent-hover-row">` | Canonical |
| hub | `components/hub/AttentionListView.tsx` | 87 | Attention row `<Link className="agent-hover-row">` | Canonical |
| work-queue | `components/reminders/FileAlertsStrip.tsx` | 99 | `<div className="agent-hover-row">` wrapping alert row | Canonical — div wrapper since row has nested link |
| transaction-list | `components/transactions/TransactionRowView.tsx` | 265, 314 | `<Link className="... agent-hover-row">` on both mobile and desktop | Canonical |
| new-v2 | `components/transactions-v2/HeroCard.tsx` | 44 | `.v2-draft-row agent-hover-row` on draft row | Canonical — draft rows in new-v2 use agent-hover-row |
| completions | `components/completions/CompletionsGroupList.tsx` | 89–94 | `<Link className="glass-card block px-5 py-4 border ${s.border} hover:shadow-md transition-shadow">` | **Drift:** File card in completions uses `hover:shadow-md transition-shadow` Tailwind for hover state, NOT `.agent-hover-row`. Inconsistent with other list rows |
| to-do | `components/agent/AgentTodoList.tsx` | 295–321 | TaskGroup `glass-card` with no hover class. TaskRow is a `<div>`, no hover | **Drift:** Task group cards and task rows have no hover state |
| to-do | `components/agent/AgentTodoList.tsx` | 298–305 | Address link uses `hover:underline` Tailwind | **Drift:** `hover:underline` instead of `.agent-link` |
| comms | `components/comms/CommsActivityFeed.tsx` | 79–87 | Transaction card `glass-card` + transaction link `comms-tx-link`. No hover on card; link has its own hover style | **Drift:** No `.agent-hover-row` on the transaction rows in comms feed |

---

## Drift flags summary

### High priority (visual inconsistency or structural gap)

1. **Empty-state surface inconsistency** — comms and completions use `.glass-card` for empty state; hub, work-queue, and transaction-list use `.agent-glass-strong`. Three pages drift from the majority pattern. (Cat 3)

2. **Ghost opacity inconsistency** — hub uses 0.3, comms uses 0.4, work-queue uses 0.5; only completions and to-do use the canonical 0.35. (Cat 9)

3. **Focus rings absent everywhere** — No `.agent-focus-ring` class exists on any interactive element across all 9 pages. Keyboard users have no consistent visible focus indicator beyond browser defaults. (Cat 11)

4. **Dropdown close animation missing in work-queue** — `SideSnoozeMenu` and `RowSnoozeMenu` in `AgentRemindersList.tsx` have no `.agent-dropdown-out` closing animation. Instant unmount vs 100ms slide in all other dropdowns. (Cat 2, Cat 12)

5. **Hardcoded colours — work-queue reminders** — `AgentRemindersList.tsx` has the most concentrated cluster: `#dc2626`, `#ea580c`, `#d97706`, `rgba(15,23,42,0.35)`, `rgba(15,23,42,0.06)`, `rgba(15,23,42,0.28)`, column bg rgba values. Most are token-mappable, some are new semantic concepts needing new tokens. (Cat 16)

6. **Hardcoded colours — comms milestone badges** — `CommsActivityFeed.tsx` uses hardcoded `bg-violet-100/text-violet-600`, `bg-emerald-100/text-emerald-600`, `bg-blue-50/text-blue-600`, `bg-emerald-50/text-emerald-700`, `bg-violet-50/text-violet-600` for portal/agent confirmation and vendor/purchaser side badges. No token equivalents for these concepts. (Cat 16)

7. **Hardcoded colours — transaction row activity chip** — `TransactionRowView.tsx` ACTIVITY_TONE object uses raw hex and rgba for all three activity states (moving/stalled/stale). (Cat 7, Cat 16)

8. **`agent-hover-row` missing on completions file cards and to-do task rows** — These card-style rows have no hover state treatment. (Cat 17)

### Medium priority (structural inconsistency, non-blocking)

9. **`agent-acc-body` wrapper inconsistency** — Some accordions include `agent-acc-body`, some don't. (Cat 1)

10. **`SectionAccordion` uses CaretUp + CaretDown swap** instead of rotating a single CaretDown. (Cat 13)

11. **FileAlertsStrip and AgentRemindersList urgency groups use text-only "Show"/"Hide"** with no caret icon. (Cat 13)

12. **`comms-filter-pill` class** instead of `agent-segment-pill` for the comms page filter toggle. (Cat 6)

13. **`comms-tx-link` and `coming-up-link`** — bespoke CSS classes for links that could use `.agent-link`. (Cat 5)

14. **`border-white/20` and `divide-white/15`** — Tailwind hardcoded opacity-border utilities in `AddManualTaskForm.tsx` (to-do) and `CommsActivityFeed.tsx`. (Cat 10)

15. **Dropdown bg `rgba(255,255,255,0.97)`** hardcoded in all 5 dropdown instances — not a token. If the glass card background token changes, dropdown surface won't follow. (Cat 15)

16. **`rgba(255,255,255,0.28)` on SplitFileCard header** — bespoke hardcoded surface. (Cat 10, Cat 15)

17. **TaskGroup link in to-do uses `hover:underline` Tailwind** instead of `.agent-link`. (Cat 17, Cat 5)

18. **Completions file cards use `hover:shadow-md`** instead of `agent-hover-row`. (Cat 17)

### Low priority (intentional or minor)

19. **`isSolid` branches may be dead code** in `HeroCard.tsx` and `DraftPanel.tsx` — comment in code acknowledges this. (Cat 14)

20. **Sort header buttons in TransactionTable** — plain `<button>` with inline styles. Intentional for table headers, but no press-down affordance. (Cat 4)

21. **`TransactionNotes` expand ("Show N more")** — no caret, no accordion animation. Plain state toggle. (Cat 1, Cat 13)

22. **Completions `GROUP_STYLES_STAT.statColor`** values (`"#dc2626"` etc.) appear to be dead code — `statColor` is defined in the record but nothing renders it in the visible page output. (Cat 16)

23. **`agent-link` used as `<button>`** for Show/Hide, Clear filter, Cancel — semantically a button but styled as a link. Consistent pattern, but may need ARIA role="button". (Cat 4)

---

## New categories discovered

### NC1 — CSS class namespace mixing (new-v2 `--nv2-*` tokens vs `--agent-*` tokens)

The new-v2 page uses a separate CSS variable namespace: `--nv2-surface-glass`, `--nv2-border-glass`, `--nv2-border-dark`, `--nv2-text-faint`, `--nv2-text-ghost`, `--nv2-text-muted`. These are used exclusively in `components/transactions-v2/`. All other pages use `--agent-*` tokens. This is intentional scoping but creates two parallel token systems. Decision needed: will new-v2 tokens eventually merge into the agent token system, or remain permanently separate?

### NC2 — Inline `onMouseEnter`/`onMouseLeave` hover style overrides

`TransactionNotes.tsx` (line 97–98) and `TransactionTable.tsx` (lines 148–149) use inline `onMouseEnter`/`onMouseLeave` event handlers to change element styles imperatively. This is the pre-token pattern for hover states — it predates `agent-hover-row`. Should be catalogued as candidates for `.agent-hover-row` adoption or a targeted hover token.

### NC3 — `agent-press-cell` class (hub only)

`app/agent/hub/page.tsx` uses `className="agent-press-cell"` on pipeline stat cells and the stalled-files link. This class is not used on any other page. It provides press-down affordance on non-button `<Link>` elements. Whether this class is defined in globals.css and whether it's the right abstraction for other pages is unconfirmed.

### NC4 — Mixed render modes for avatar/initials

`TransactionRowView.tsx` (line 358–360) renders an assigned-user avatar as a coral circle with white initials using inline styles: `background: "var(--agent-coral-deep)"`. No other page has this pattern. There's no `agent-avatar` or similar canonical class. If avatars appear in more places, this will need canonicalisation.

### NC5 — `agent-section-in` animation class (new-v2 only)

`Stage2Sections.tsx` (line 21) uses `animation: "agent-section-in 360ms ..."` inline — a named CSS animation. This is not `.agent-reveal-in` and not used elsewhere. It's defined as an inline animation reference rather than a CSS class application.

### NC6 — `wq-split-body`, `wq-urgency-bar-*` utility classes (work-queue only)

Work-queue uses several page-scoped CSS classes: `wq-split-body` (mobile stacking), `wq-urgency-bar`, `wq-urgency-bar-escalated`, `wq-urgency-bar-overdue`, `wq-urgency-bar-due-today`, `wq-urgency-bar-coming-up`. These are defined in globals.css. This is acceptable scoping but noted as a pattern of page-specific CSS class groups outside the canonical agent-* namespace.

### NC7 — `agent-card-hdr` vs other header patterns

Card headers use several patterns:
- `agent-card-hdr` — canonical header class with `agent-card-title` or `agent-card-title-emphasis`
- `agent-card-hdr-warning` — warning variant (FileAlertsStrip)
- `agent-card-hdr-internal` — internal variant (hub page)
- Custom header div with manual padding+flex (many components)

This is partially canonicalised but incomplete. Several components build card headers manually instead of using the class.

### NC8 — `tl-card`, `tl-filter-banner`, `tl-bar-chip`, `tl-*` class family (transaction-list only)

The transaction-list page uses a family of `tl-*` CSS classes for its search/filter UI: `tl-card`, `tl-filter-banner`, `tl-card-search`, `tl-search-row`, `tl-search-input`, `tl-search-chips`, `tl-bar-chip`, `tl-card-tabs`, `tl-bar-row`, `tl-bar-tabs`, `tl-bar-clear`. These are page-scoped and not part of the agent-* canonical system. Acceptable as page-specific, but if the search/filter UI pattern expands to other pages, canonicalisation will be needed.
