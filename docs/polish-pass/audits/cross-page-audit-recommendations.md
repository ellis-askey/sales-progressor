# Cross-Page Audit — Recommendations
*Phase 2 of cross-page audit initiated 2026-05-17*

---

## Summary

| Verdict | Count |
|---|---|
| CHANGE (confirmed, implement in Phase 4) | 27 |
| UNCERTAIN (needs Ellis decision in Phase 3) | 10 |
| NO CHANGE (committed status quo) | 20 |

Files most affected: `components/reminders/AgentRemindersList.tsx` (9 changes), `components/transactions/TransactionRowView.tsx` (4 changes), `app/agent/comms/page.tsx` (4 changes).

---

## How to read this doc

- **CHANGE** — implement in Phase 4, one atomic commit per category. No decision required.
- **UNCERTAIN** — Ellis must choose an option before Phase 4 starts. Options are presented as literal code, not prose. Decisions go into `docs/polish-pass/audits/cross-page-audit-decisions.md`.
- **NO CHANGE** — audited and deliberately left as-is. Revisiting these requires a new audit item.

---

## CAT 1 — Accordions

### Changes

**CHANGE 1A** — `components/transactions-v2/form/SectionAccordion.tsx:31-33`

Before: swaps between `<CaretUp>` (expanded) and `<CaretDown>` (collapsed) — the only accordion in the codebase that imports `CaretUp`.

```tsx
// BEFORE
{expanded
  ? <CaretUp size={14} weight="bold" color="var(--nv2-text-ghost)" />
  : <CaretDown size={14} weight="bold" color="var(--nv2-text-ghost)" />
}
```

After: single `<CaretDown>` rotated via inline style, matching the canonical pattern in `CommsActivityFeed.tsx:72` and `AgentTodoList.tsx:270`.

```tsx
// AFTER
<CaretDown
  size={14}
  weight="bold"
  color="var(--nv2-text-ghost)"
  style={{ transition: "transform 200ms", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
/>
```

Remove the `CaretUp` import. Rationale: eliminates the single instance of icon-swap in a codebase that otherwise uses rotation uniformly.

---

**CHANGE 1B** — `components/completions/CompletionsGroupList.tsx:72`

Before: Tailwind `rotate-180` class for rotation — functionally equivalent but differs from the canonical inline-style pattern.

```tsx
// BEFORE
<CaretDown className={`w-3.5 h-3.5 flex-shrink-0 text-slate-900/40 transition-transform duration-200${isOpen ? " rotate-180" : ""}`} />
```

After: inline style, matching canonical pattern.

```tsx
// AFTER
<CaretDown
  style={{
    width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0,
    transition: "transform 200ms",
    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
  }}
/>
```

Rationale: one rotation pattern across the codebase; `text-slate-900/40` also replaced by `var(--agent-text-muted)` token.

---

### No changes

- No change for `agent-acc-body` omission in `AgentRemindersList.tsx` and `FileAlertsStrip.tsx` (both patterns work for their layout needs — no body wrapper is structurally valid).
- No change for `TransactionNotes` "Show N more" expand (text-only toggle, no caret appropriate — different UX pattern with no animated container).

---

## CAT 2 — Dropdowns

### Changes

**CHANGE 2A** — `components/reminders/AgentRemindersList.tsx` `SideSnoozeMenu` (~line 86–150)

Missing `agent-dropdown-out` exit animation. All other dropdowns (TransactionListWithSearch, TransactionRowView ActivityVerbChip) use the `closing` state → `agent-dropdown-out` class → `onAnimationEnd` unmount pattern. SideSnoozeMenu uses plain `open &&` — instant unmount.

Before (close path):
```tsx
// BEFORE — no closing state, instant unmount
{open && pos && typeof document !== "undefined" && createPortal(
  <div
    data-theme={theme}
    className="agent-dropdown-in"
    ...
  >
```

After: add `closing` state, apply `agent-dropdown-out` on close, unmount after animation:
```tsx
// AFTER
const [closing, setClosing] = useState(false);

// In the toggle handler, replace setOpen(false) with:
function close() { setClosing(true); setOpen(false); }

// In the portal:
{(open || closing) && pos && typeof document !== "undefined" && createPortal(
  <div
    data-theme={theme}
    className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
    onAnimationEnd={() => { if (closing) setClosing(false); }}
    ...
  >
```

---

**CHANGE 2B** — `components/reminders/AgentRemindersList.tsx` `RowSnoozeMenu` (~line 152–219)

Same pattern as 2A. `RowSnoozeMenu` also uses `open &&` with instant unmount, no `closing` state.

Apply identical fix: add `closing` state, replace `setOpen(false)` calls with a `close()` function, apply `agent-dropdown-out` class and `onAnimationEnd` unmount.

---

### No changes

- No change for any other dropdown instance — all canonical.

---

## CAT 3 — Card surfaces

### Changes

**CHANGE 3A** — `app/agent/comms/page.tsx:96`

Before: `glass-card` on the comms empty-state card.
```tsx
// BEFORE
<div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
```

After: `agent-glass-strong` — consistent with hub, work-queue, and transaction-list empty states.
```tsx
// AFTER
<div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center" }}>
```

---

**CHANGE 3B** — `app/agent/completions/page.tsx:116`

Before: `glass-card px-6 py-12` on the completions empty-state card.
```tsx
// BEFORE
<div className="glass-card px-6 py-12" style={{ textAlign: "center" }}>
```

After: `agent-glass-strong` with equivalent padding.
```tsx
// AFTER
<div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center" }}>
```

---

### Uncertain

**UNCERTAIN 3C** — `components/agent/AgentTodoList.tsx:119`

The whole-page empty state renders a `glass-card` for the central "Nothing here yet" card.

```tsx
// Current
<div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
```

Option A — `agent-glass-strong` (consistent with other empty states):
```tsx
<div className="agent-glass-strong" style={{ padding: "48px 24px", textAlign: "center" }}>
```

Option B — keep `glass-card` (the to-do page uses `glass-card` for its task group cards; the empty state visually reads as a content card shape, not just a container):
```tsx
// No change
<div className="glass-card" style={{ padding: "48px 24px", textAlign: "center" }}>
```

---

### No changes

- No change for `SplitFileCard` header (`rgba(255,255,255,0.28)`) — intentional semi-transparent header within the card; changing it would flatten the visual hierarchy.

---

## CAT 4 — Buttons

### No changes

All button instances use canonical classes or are intentionally scoped (sort header plain `<button>`, `agent-link` as visual-link button pattern). No changes.

---

## CAT 5 — Links

### Changes

**CHANGE 5A** — `components/agent/AgentTodoList.tsx:298-305`

The transaction address link in `TaskGroup` uses raw Tailwind `hover:underline` rather than `agent-link`.

Before:
```tsx
// BEFORE — line 298-304
<Link
  href={`/agent/transactions/${group.transactionId}`}
  style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none" }}
  className="hover:underline"
>
  {group.address ?? "Unknown address"}
</Link>
```

After:
```tsx
// AFTER
<Link
  href={`/agent/transactions/${group.transactionId}`}
  className="agent-link"
  style={{ fontSize: 13, fontWeight: 600 }}
>
  {group.address ?? "Unknown address"}
</Link>
```

Rationale: `agent-link` provides canonical colour, hover underline, and focus ring via agent-system.css.

---

### No changes

- No change for `coming-up-link` (hub page, page-specific acceptable styling).
- No change for `comms-tx-link` (page-scoped link style, visually intentional for the comms transaction card header).

---

## CAT 6 — Segment pills

### Changes

**CHANGE 6A** — `app/agent/comms/page.tsx:77-89`

The comms filter bar uses `comms-filter-pill` custom class instead of `agent-segment-pill`.

Before:
```tsx
// BEFORE — lines 77-89
<div className="comms-filter-bar">
  <Link
    href={filterBase}
    className={`comms-filter-pill${!portalOnly ? " on" : ""}`}
  >
    All milestones
  </Link>
  <Link
    href={`${filterBase}?filter=portal`}
    className={`comms-filter-pill${portalOnly ? " on" : ""}`}
  >
    Client confirmations
  </Link>
</div>
```

After: replace wrapper and pill classes with canonical system. The `comms-filter-bar` wrapper can be replaced by a plain `div` with flex layout, or kept if it applies padding/border — check `globals.css` for `comms-filter-bar` definition. The pills become:
```tsx
// AFTER
<div style={{ display: "flex", gap: 4 }}>
  <Link
    href={filterBase}
    className={`agent-segment-pill agent-segment-pill-sm${!portalOnly ? " on" : ""}`}
  >
    All milestones
  </Link>
  <Link
    href={`${filterBase}?filter=portal`}
    className={`agent-segment-pill agent-segment-pill-sm${portalOnly ? " on" : ""}`}
  >
    Client confirmations
  </Link>
</div>
```

Note: verify whether `comms-filter-bar` applies a container style (border, padding, background) in globals.css. If it does, preserve that container style; only swap the pill class.

---

### No changes

- No change for all other segment pill instances — canonical.

---

## CAT 7 — Status indicators

### Changes

**CHANGE 7A** — `components/transactions/TransactionRowView.tsx:241`

Risk stripe Tailwind classes → inline token-based style:

Before:
```tsx
// BEFORE
return r.level === "high" ? "bg-red-500" : r.level === "medium" ? "bg-amber-400" : "bg-emerald-500";
// Used as: <div className={`w-1 self-stretch flex-shrink-0 ${riskStripe}`} />
```

After: switch to inline `background` using semantic tokens. Change `riskStripe` to a colour string and apply via `style`:
```tsx
// AFTER
const riskStripeColor = tx.health
  ? (() => {
      const r = calculateRiskScore({ ... });
      return r.level === "high"
        ? "var(--agent-danger)"
        : r.level === "medium"
        ? "var(--agent-warning)"
        : "var(--agent-success)";
    })()
  : "var(--agent-success)";

// Render:
<div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: riskStripeColor }} />
```

---

**CHANGE 7B** — `components/transactions/TransactionRowView.tsx:88-92`

`ACTIVITY_TONE` full replacement. All three entries use hardcoded hex/rgba values.

Before:
```tsx
// BEFORE
const ACTIVITY_TONE: Record<ActivityState, { bg: string; fg: string; dot: string }> = {
  moving:  { bg: "rgba(16,185,129,0.10)", fg: "#059669",  dot: "#10b981" },
  stalled: { bg: "rgba(245,158,11,0.12)", fg: "#b45309",  dot: "#f59e0b" },
  stale:   { bg: "rgba(239,68,68,0.10)",  fg: "#dc2626",  dot: "#ef4444" },
};
```

After:
```tsx
// AFTER
const ACTIVITY_TONE: Record<ActivityState, { bg: string; fg: string; dot: string }> = {
  moving:  { bg: "rgba(var(--agent-success-rgb), 0.10)", fg: "var(--agent-success)",  dot: "var(--agent-success)"  },
  stalled: { bg: "rgba(var(--agent-warning-rgb), 0.12)", fg: "var(--agent-warning)",  dot: "var(--agent-warning)"  },
  stale:   { bg: "rgba(var(--agent-danger-rgb),  0.10)", fg: "var(--agent-danger)",   dot: "var(--agent-danger)"   },
};
```

All three RGB tokens (`--agent-success-rgb`, `--agent-warning-rgb`, `--agent-danger-rgb`) are confirmed present across all 6 themes in `themes.css`.

---

**CHANGE 7C** — `components/completions/CompletionFileRowView.tsx:33-38`

`GROUP_STYLES` dot colours: replace Tailwind colour classes with token-based inline styles for the semantically meaningful entries.

Before:
```tsx
// BEFORE
export const GROUP_STYLES = {
  overdue:   { dot: "bg-red-500",   label: "text-red-600",      border: "border-red-200/40"   },
  this_week: { dot: "bg-amber-500", label: "text-amber-600",    border: "border-amber-200/40" },
  next_week: { dot: "bg-blue-500",  label: "text-blue-600",     border: "border-blue-200/40"  },
  later:     { dot: "bg-slate-400", label: "text-slate-900/60", border: "border-white/20"     },
  no_date:   { dot: "bg-slate-300", label: "text-slate-900/40", border: "border-white/15"     },
} as const;
```

After: the `dot` values for overdue/this_week/next_week are semantic — replace with inline styles. The `later` and `no_date` dot/label/border values (`bg-slate-400`, `bg-slate-300`) have no semantic token counterpart — leave as Tailwind. This requires changing how the dot is rendered (from `className={s.dot}` to `style={{ background: s.dotColor }}`).

```tsx
// AFTER
export const GROUP_STYLES = {
  overdue:   { dotColor: "var(--agent-danger)",  label: "text-red-600",      border: "border-red-200/40"   },
  this_week: { dotColor: "var(--agent-warning)", label: "text-amber-600",    border: "border-amber-200/40" },
  next_week: { dotColor: "var(--agent-info)",    label: "text-blue-600",     border: "border-blue-200/40"  },
  later:     { dotColor: "bg-slate-400",         label: "text-slate-900/60", border: "border-white/20"     },
  no_date:   { dotColor: "bg-slate-300",         label: "text-slate-900/40", border: "border-white/15"     },
} as const;
// Render dot: for overdue/this_week/next_week use style={{ background: s.dotColor }};
// for later/no_date keep className={s.dotColor} (still a Tailwind class).
// Or simplify: make dotColor always inline, convert bg-slate-* to their raw hex values (#94a3b8, #cbd5e1).
```

Simplest clean approach: make all `dotColor` values CSS strings for inline style rendering.

---

### Uncertain

**UNCERTAIN 7D** — `components/reminders/AgentRemindersList.tsx` `GROUP_CONFIG` Tailwind `labelCls`/`badgeCls`

Current:
```tsx
const GROUP_CONFIG = {
  escalated: { ..., labelCls: "text-red-700",      badgeCls: "bg-red-100 text-red-700"       },
  overdue:   { ..., labelCls: "text-orange-700",   badgeCls: "bg-orange-100 text-orange-700" },
  due_today: { ..., labelCls: "text-amber-700",    badgeCls: "bg-amber-100 text-amber-700"   },
  upcoming:  { ..., labelCls: "text-slate-900/60", badgeCls: "bg-slate-100 text-slate-900/60" },
};
```

Option A — replace with inline token-based styles (requires changing `className={cfg.labelCls}` to `style={{ color: cfg.labelColor }}`):
```tsx
// Option A
const GROUP_CONFIG = {
  escalated: { ..., labelColor: "var(--agent-danger)",  badgeColor: "var(--agent-danger)",  badgeBg: "rgba(var(--agent-danger-rgb), 0.10)"  },
  overdue:   { ..., labelColor: "#ea580c",              badgeColor: "#ea580c",              badgeBg: "rgba(234,88,12,0.10)"                  },
  due_today: { ..., labelColor: "var(--agent-warning)", badgeColor: "var(--agent-warning)", badgeBg: "rgba(var(--agent-warning-rgb), 0.10)"  },
  upcoming:  { ..., labelColor: "var(--agent-text-muted)", badgeColor: "var(--agent-text-muted)", badgeBg: "rgba(var(--agent-bg-base-rgb), 0.10)" },
};
```

Note: "overdue" (orange `#ea580c`) is a distinct intensity from "escalated" (danger red `#dc2626`) — see UNCERTAIN 7E for the orange token question.

Option B — leave Tailwind (these classes are contained within this one object, the header backgrounds are already handled by `wq-urgency-bar-*` CSS classes, and the E1 comment in the file explicitly flags this as intentional semantic colour-coding):
```tsx
// No change — E1 semantic colour-coding intentional per existing code comment
```

---

**UNCERTAIN 7E** — Seller `#ea580c` / buyer `#3b82f6` colour pair

Used in `AgentRemindersList.tsx:250-252` (SideColumn dot/label/bg), `AgentRemindersList.tsx:402-404` (EmptyColumn), and `AgentRemindersList.tsx:310-313` (inline urgency urgencyColor).

Option A — define new tokens in themes.css:
```css
/* Add to all 6 theme blocks + night mode */
--agent-party-seller: #ea580c;   /* orange */
--agent-party-buyer:  #3b82f6;   /* blue  */
--agent-party-seller-bg: rgba(234,88,12,0.06);
--agent-party-buyer-bg:  rgba(59,130,246,0.06);
```
Then in component:
```tsx
const dotColor   = isSeller ? "var(--agent-party-seller)"    : "var(--agent-party-buyer)";
const columnBg   = isSeller ? "var(--agent-party-seller-bg)" : "var(--agent-party-buyer-bg)";
const labelColor = isSeller ? "var(--agent-party-seller)"    : "var(--agent-party-buyer)";
```

Option B — map to existing tokens (`--agent-warning` for seller, `--agent-info` for buyer). Semantically imperfect (warning implies urgency; seller/buyer are categorical, not qualitative):
```tsx
const dotColor   = isSeller ? "var(--agent-warning)" : "var(--agent-info)";
const columnBg   = isSeller ? "rgba(var(--agent-warning-rgb), 0.06)" : "rgba(var(--agent-info-rgb), 0.06)";
const labelColor = isSeller ? "var(--agent-warning)" : "var(--agent-info)";
```

Note: themes.css already defines `--agent-vendor-accent` and `--agent-purchaser-accent` as "Semantic — side accents (categorical, theme-locked; used as text colour on milestone side-labels and party indicators; not quality signals)". These tokens appear to be exactly what's needed. Confirm whether these tokens already cover this use case before creating new ones.

---

**UNCERTAIN 7F** — `components/comms/CommsActivityFeed.tsx` badge system

Current hardcoded Tailwind classes:
```tsx
// Portal-confirmed icon: bg-violet-100 / text-violet-600
// Agent-confirmed icon:  bg-emerald-100 / text-emerald-600
// Vendor side badge:     bg-blue-50 text-blue-600
// Purchaser side badge:  bg-emerald-50 text-emerald-700
// Client-confirmed tag:  bg-violet-50 text-violet-600 border border-violet-200
```

Option A — define role/confirmation tokens in themes.css:
```css
--agent-portal-confirmed-bg: rgba(167,139,250,0.10);
--agent-portal-confirmed-fg: #7c3aed; /* or similar violet */
--agent-vendor-side-bg: rgba(59,130,246,0.06);
--agent-purchaser-side-bg: rgba(16,185,129,0.06);
```

Option B — map to existing tokens where semantically close: vendor = `--agent-info`, purchaser = `--agent-success` or `--agent-purchaser-accent`, portal-confirmed = no existing token (violet has no mapping).

Option C — leave as-is. These badges encode semantically distinct concepts (portal confirmation vs agent confirmation vs vendor/purchaser side) where violet specifically signals "client-origin action." No existing token maps cleanly. The concentration is in one component (`CommsActivityFeed.tsx`).

---

## CAT 8 — Skeletons

### No changes

All skeleton instances use `.agent-skeleton` canonically. No changes.

---

## CAT 9 — Ghost opacity

### Changes

**CHANGE 9A** — `app/agent/hub/page.tsx` — 3 locations

Before (all three):
```tsx
// Line 147
<div style={{ display: "grid", ..., opacity: 0.3, pointerEvents: "none" }}>
// Line 172
<div className="agent-glass-strong" style={{ ..., opacity: 0.3, pointerEvents: "none" }}>
// Line 204
<div style={{ display: "grid", ..., opacity: 0.3, pointerEvents: "none" }}>
```

After (all three): change `opacity: 0.3` → `opacity: 0.35`.

---

**CHANGE 9B** — `app/agent/comms/page.tsx:114`

Before:
```tsx
<div style={{ opacity: 0.4, pointerEvents: "none" }}>
```

After:
```tsx
<div style={{ opacity: 0.35, pointerEvents: "none" }}>
```

---

**CHANGE 9C** — `app/agent/work-queue/page.tsx:90`

Before:
```tsx
<div style={{ opacity: 0.5, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
```

After:
```tsx
<div style={{ opacity: 0.35, pointerEvents: "none", display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
```

---

## CAT 10 — Borders

### Changes

**CHANGE 10A** — `components/comms/CommsActivityFeed.tsx:87`

Tailwind `divide-white/15` on the milestone row list inside a transaction card.

Before:
```tsx
<div className="divide-y divide-white/15">
```

After: replace Tailwind divide utility with a `borderTop` on each child (the rows already have `key={m.id}` and `flex items-start gap-3 px-4 py-3`). The cleanest approach is to add `borderTop` conditionally on index, or switch to a wrapper approach:
```tsx
// AFTER — add borderTop to each row div except the first
<div>
  {tx.milestones.map((m, i) => (
    <div
      key={m.id}
      className="flex items-start gap-3 px-4 py-3"
      style={{ borderTop: i > 0 ? `0.5px solid var(--agent-border-subtle)` : undefined }}
    >
```

---

**CHANGE 10B** — `app/agent/comms/page.tsx:124`

Tailwind `border-b border-white/20` inside the ghost day-bucket preview.

Before:
```tsx
<div className="px-4 py-2.5 border-b border-white/20">
```

After:
```tsx
<div className="px-4 py-2.5" style={{ borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
```

---

**CHANGE 10C** — `components/reminders/AgentRemindersList.tsx` — 2 locations

`rgba(15,23,42,0.06)` used for row dividers within SideColumn.

Before (line 326):
```tsx
borderTop: i > 0 ? `0.5px solid rgba(15,23,42,0.06)` : undefined,
```

Before (line 360):
```tsx
borderTop: `0.5px solid rgba(15,23,42,0.06)`,
```

After (both):
```tsx
borderTop: i > 0 ? `0.5px solid var(--agent-border-subtle)` : undefined,
// and:
borderTop: `0.5px solid var(--agent-border-subtle)`,
```

---

**CHANGE 10D** — `components/todos/AddManualTaskForm.tsx:142`

Currently: `border-t border-white/20` (Tailwind).

Verified: this change was NOT completed in Stage 4 — `border-white/20` is still present in the file.

Before:
```tsx
<div className="flex items-center gap-3 pt-1 border-t border-white/20">
```

After: replace Tailwind border utility with inline style.
```tsx
<div className="flex items-center gap-3 pt-1" style={{ borderTop: "0.5px solid var(--agent-border-subtle)" }}>
```

---

### No changes

- No change for completions urgency card borders (`border-red-200/40` etc.) — intentional semantic distinction that communicates urgency level on individual file cards. Aligning to a single border token would lose the visual signal.

---

## CAT 11 — Focus rings

### Changes

**CHANGE 11A** — `app/agent/styles/agent-system.css`

Add `agent-acc-hdr:focus-visible` rule to the existing `:focus-visible` rule section. This covers the `role="button" tabIndex={0}` accordion headers in `CommsActivityFeed.tsx:63-67` and `CompletionsGroupList.tsx:49-54`, which are `<div>` elements with `agent-acc-hdr` class and no focus treatment.

Locate the existing `:focus-visible` section in `agent-system.css` (which already covers `.agent-btn`, `.agent-link`, `.agent-segment-pill`, etc.) and add:

```css
/* AFTER — add to existing :focus-visible block */
.agent-acc-hdr:focus-visible {
  outline: none;
  box-shadow: var(--agent-focus-ring);
}
```

---

**CHANGE 11B** — `components/agent/AgentTodoList.tsx` task completion circle (~line 348-361)

The task toggle `<button>` (a plain circle button with inline border/background) has no focus treatment.

Before:
```tsx
<button
  onClick={toggle}
  disabled={loading}
  aria-label={isDone ? "Reopen" : "Mark as done"}
  className="p-2 -m-2"
  style={{
    width: 18, height: 18, borderRadius: "50%",
    border: ...,
    background: ...,
    cursor: ...,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 150ms",
  }}
>
```

Option A — add a CSS class `agent-circle-btn` defined in `agent-system.css` with the focus ring:

In `agent-system.css`:
```css
.agent-circle-btn:focus-visible {
  outline: none;
  box-shadow: var(--agent-focus-ring);
}
```

In component:
```tsx
<button
  className="p-2 -m-2 agent-circle-btn"
  ...
>
```

Option B — inline focus style using `onFocus`/`onBlur` (avoids adding a new CSS class but regresses to the pre-token pattern):
```tsx
// Not recommended — adds imperative style handlers
```

Recommendation: Option A — define `agent-circle-btn` in `agent-system.css`. Clean, reusable if other circular buttons appear.

---

### No changes

- No change for `.agent-btn`, `.agent-link`, `.agent-segment-pill`, `.agent-btn-ghost-bordered`, `.agent-tab` — all already wired in agent-system.css.

---

## CAT 12 — Animations

### Changes

Same as CAT 2 (CHANGE 2A and 2B). No additional proposals.

### No changes

- All other animation instances are canonical.

---

## CAT 13 — Caret rotation

### Changes

- CHANGE 13A — same as CHANGE 1A (`SectionAccordion.tsx`). Already covered.

### Uncertain

**UNCERTAIN 13B** — Text-only "Show"/"Hide" toggles in `AgentRemindersList.tsx:751-756` and `FileAlertsStrip.tsx`

Current: plain text button with no icon.

```tsx
// Current (AgentRemindersList.tsx ~line 751)
<button
  onClick={() => toggleCollapse(groupKey)}
  className="agent-link agent-link-muted"
  style={{ fontSize: 12 }}
>
  {isCollapsed ? "Show" : "Hide"}
</button>
```

Option A — add rotating `<CaretDown>` to match the canonical caret pattern:
```tsx
<button
  onClick={() => toggleCollapse(groupKey)}
  className="agent-link agent-link-muted"
  style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
>
  {isCollapsed ? "Show" : "Hide"}
  <CaretDown
    size={10}
    style={{ transition: "transform 200ms", transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)" }}
  />
</button>
```

Option B — leave text-only. The "Show"/"Hide" text is unambiguous in context (inside a group header that already communicates what will be shown). Adding a caret could read as redundant.

Note: this is a semantically distinct context from the day-bucket accordions — the "Show/Hide" is inside a colour-coded urgency header where space is constrained. The text signal may be preferable.

---

## CAT 14 — Solid/glass parity

### No changes

`isSolid` dead-code branches accepted per existing code comment in HeroCard.tsx and DraftPanel.tsx. All instances reviewed.

---

## CAT 15 — Card shade consistency

### No changes

Dropdown `rgba(255,255,255,0.97)` hardcoded across all instances — consistent internally; would require a new token definition. Accepted for now. `rgba(255,255,255,0.28)` SplitFileCard header accepted as intentional. All other instances reviewed.

---

## CAT 16 — Hardcoded colours

### Changes

**CHANGE 16A** — `components/reminders/AgentRemindersList.tsx` — 2 locations: `rgba(15,23,42,0.35)` → `var(--agent-text-muted)`

Line 296 (SideColumn reminder count span):
```tsx
// BEFORE
<span style={{ fontSize: 10, color: "rgba(15,23,42,0.35)", marginLeft: "auto" }}>
// AFTER
<span style={{ fontSize: 10, color: "var(--agent-text-muted)", marginLeft: "auto" }}>
```

Line 313 (SideColumn urgencyColor fallback — "upcoming" state):
```tsx
// BEFORE
: "rgba(15,23,42,0.35)";
// AFTER
: "var(--agent-text-muted)";
```

---

**CHANGE 16B** — `components/reminders/AgentRemindersList.tsx` — 2 locations: `rgba(15,23,42,0.06)` → `var(--agent-border-subtle)` (same as CHANGE 10C)

Lines 326 and 360 — covered by CHANGE 10C above.

---

**CHANGE 16C** — `components/reminders/AgentRemindersList.tsx` — 1 location: `rgba(15,23,42,0.28)` → `var(--agent-text-disabled)`

Line 426 (EmptyColumn "all up to date" italic text):
```tsx
// BEFORE
<span style={{ fontSize: 11, color: "rgba(15,23,42,0.28)", fontStyle: "italic" }}>
// AFTER
<span style={{ fontSize: 11, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>
```

---

**CHANGE 16D** — `components/transactions/TransactionRowView.tsx` — `rgba(180,87,9,0.40)` → token equivalent

Line 201 (VendorBuyerLine "Names not set" text):
```tsx
// BEFORE
<p className="text-xs mt-0.5 truncate" style={{ color: "rgba(180,87,9,0.40)" }}>Names not set</p>
// AFTER
<p className="text-xs mt-0.5 truncate" style={{ color: "rgba(var(--agent-warning-rgb), 0.40)" }}>Names not set</p>
```

---

**CHANGE 16E** — `components/reminders/AgentRemindersList.tsx` `GROUP_LEFT_BORDER.escalated`: `"#dc2626"` → `var(--agent-danger)`

```tsx
// BEFORE
const GROUP_LEFT_BORDER = {
  escalated: "#dc2626",
  ...
};
// AFTER
const GROUP_LEFT_BORDER = {
  escalated: "var(--agent-danger)",
  ...
};
```

---

**CHANGE 16F** — `components/reminders/AgentRemindersList.tsx` `GROUP_LEFT_BORDER.due_today`: `"#d97706"` → `var(--agent-warning)`

```tsx
// BEFORE
  due_today: "#d97706",
// AFTER
  due_today: "var(--agent-warning)",
```

---

**CHANGE 16G** — `components/reminders/AgentRemindersList.tsx` `GROUP_LEFT_BORDER.upcoming`: `"rgba(148,163,184,0.35)"` → `var(--agent-border-subtle)`

```tsx
// BEFORE
  upcoming: "rgba(148,163,184,0.35)",
// AFTER
  upcoming: "var(--agent-border-subtle)",
```

---

**CHANGE 16M** — `components/transactions/TransactionRowView.tsx:88-92` — same as CHANGE 7B. Covered above.

---

### Uncertain

**UNCERTAIN 16H** — Seller `#ea580c` / buyer `#3b82f6` — same as UNCERTAIN 7E. See above.

---

**UNCERTAIN 16I** — `components/reminders/AgentRemindersList.tsx` `GROUP_LEFT_BORDER.snoozed`: `"rgba(168,85,247,0.5)"` (purple)

Option A — define a snoozed token in themes.css:
```css
/* themes.css — all theme blocks already define --agent-snoozed, --agent-snoozed-rgb */
```

Check: themes.css token inventory already lists `--agent-snoozed`, `--agent-snoozed-bg`, `--agent-snoozed-border`, `--agent-snoozed-rgb` in the header comment. If these are defined in all 6 theme blocks, use them:
```tsx
// AFTER
  snoozed: "var(--agent-snoozed)",
```

Option B — leave as-is (snoozed is a visually distinctive purple state with no other usage in the app; the hardcoded value is contained).

Note: verify whether `--agent-snoozed` is actually defined in the theme blocks (the header comment lists it but confirm actual presence).

---

**UNCERTAIN 16J** — `GROUP_CONFIG` Tailwind label/badge classes — same as UNCERTAIN 7D. See above.

---

**UNCERTAIN 16K** — `CompletionFileRowView.tsx` `GROUP_STYLES` `later`/`no_date` dot colours: `bg-slate-400`, `bg-slate-300`

These represent "no urgency" and "no date" states. No semantic token exists for neutral slate.

Option A — leave as Tailwind (no semantic meaning; they're deliberately neutral and slate maps to no theme concept):
```tsx
// No change for later/no_date dot
```

Option B — convert to raw hex values for inline style rendering (if 7C's approach of making all dots inline style is adopted, these need a raw value):
```tsx
later:   { dotColor: "#94a3b8", ... }  // slate-400 raw hex
no_date: { dotColor: "#cbd5e1", ... }  // slate-300 raw hex
```

If CHANGE 7C is implemented (all dots become inline style), Option B must also be adopted for these two entries.

---

**UNCERTAIN 16L** — `CommsActivityFeed.tsx` badge system — same as UNCERTAIN 7F. See above.

---

## CAT 17 — Hover-row

### Changes

**CHANGE 17A** — `components/completions/CompletionsGroupList.tsx:92`

File card links use `hover:shadow-md transition-shadow` Tailwind instead of `agent-hover-row`.

Before:
```tsx
<Link
  key={f.id}
  href={`/agent/transactions/${f.id}`}
  className={`glass-card block px-5 py-4 border ${s.border} hover:shadow-md transition-shadow`}
  style={{ textDecoration: "none" }}
>
```

After: replace hover utilities with `agent-hover-row`. Check whether `agent-hover-row` is compatible with `glass-card block` (it should be — `agent-hover-row` is a utility class adding hover background, not conflicting with card surface).
```tsx
<Link
  key={f.id}
  href={`/agent/transactions/${f.id}`}
  className={`glass-card block px-5 py-4 border ${s.border} agent-hover-row`}
  style={{ textDecoration: "none" }}
>
```

---

### Uncertain

**UNCERTAIN 17B** — `components/agent/AgentTodoList.tsx` task rows — currently no hover effect

Option A — add `agent-hover-row` to `TaskRow` wrapper div:
```tsx
// AFTER
<div
  className="agent-hover-row"
  style={{
    display: "flex", alignItems: "flex-start", gap: 12,
    padding: "12px 16px",
    borderBottom: hasBorder ? "0.5px solid var(--agent-border-subtle)" : "none",
  }}
>
```

Option B — leave no hover on task rows. Task rows have inline interactive elements (the circle toggle button, due-date label). A full-row hover background might visually compete with the toggle affordance and could mislead users into thinking the row itself is clickable (it isn't — only the checkbox and the address link are interactive).

---

## NC1 — `--nv2-*` token namespace

### Recommendation: keep separate

`--nv2-*` tokens are used exclusively in `components/transactions-v2/` for the new-sale form's glassmorphic context. They are intentionally different from agent pages. No merging recommended.

Each `--nv2-*` token alongside its nearest `--agent-*` counterpart:

| `--nv2-*` token | Nearest `--agent-*` counterpart | Notes |
|---|---|---|
| `--nv2-surface-glass` | `--agent-glass-bg` | Different alpha values |
| `--nv2-surface-raised` | `--agent-surface-elevated` | Elevated surface variant |
| `--nv2-border-glass` | `--agent-glass-border` | Glass border |
| `--nv2-border-dark` | `--agent-border-strong` | Stronger border |
| `--nv2-text-faint` | `--agent-text-tertiary` | Faint text |
| `--nv2-text-ghost` | `--agent-text-disabled` | Ghost/disabled text |
| `--nv2-text-muted` | `--agent-text-muted` | Muted text |

Recommend: add a comment block at the top of the new-v2 form's CSS (or inline in the first component that defines these tokens) documenting the namespace separation and the counterpart table above.

---

## NC2 — Inline hover handlers

### Change

**CHANGE NC2A** — `components/transaction/TransactionNotes.tsx:97-98`

Current: `onMouseEnter`/`onMouseLeave` state pattern for hover (pre-token pattern).

Before:
```tsx
// BEFORE — lines 97-98
onMouseEnter={(e) => { e.currentTarget.style.background = "var(--agent-glass-bg-hover)"; }}
onMouseLeave={(e) => { e.currentTarget.style.background = "var(--agent-surface-glass)"; }}
```

After: CSS hover rule in a `<style>` block or a scoped CSS class. Since this is a `.tsx` file without a dedicated CSS module, define a CSS class for the note item. The cleanest approach given the existing inline-style-heavy pattern is to add a specific class:

```css
/* In agent-system.css or a note-specific rule */
.agent-note-item:hover {
  background: var(--agent-glass-bg-hover);
}
```

Then in the component, replace the `onMouseEnter`/`onMouseLeave` handlers with `className="agent-note-item"` on the note `<div>`, and set the base background via CSS rather than inline style:
```tsx
// AFTER
<div
  className="agent-note-item"
  style={{
    padding: "8px 10px",
    borderRadius: 8,
    border: "0.5px solid var(--agent-border-default)",
    position: "relative",
    opacity: isOptimistic ? 0.65 : 1,
    transition: "background 150ms",
  }}
>
```

With in CSS:
```css
.agent-note-item {
  background: var(--agent-surface-glass);
}
.agent-note-item:hover {
  background: var(--agent-glass-bg-hover);
}
```

---

## NC3–NC8

### No changes

- **NC3** (`agent-press-cell`) — hub-only pattern, acceptable as page-specific.
- **NC4** (avatar/initials inline style) — single instance, no canonicalisation needed until pattern recurs.
- **NC5** (`agent-section-in` animation) — new-v2 only, inline animation reference acceptable.
- **NC6** (`wq-split-body`, `wq-urgency-bar-*`) — page-scoped CSS class group, acceptable.
- **NC7** (card header patterns) — partial canonicalisation, no new inconsistencies being introduced.
- **NC8** (`tl-*` class family) — transaction-list page-scoped, acceptable.

---

## Phase 3 decision items

All UNCERTAIN items requiring Ellis's choice before Phase 4 begins:

1. **UNCERTAIN 3C** — AgentTodoList empty state: `glass-card` or `agent-glass-strong`?
2. **UNCERTAIN 7D / 16J** — GROUP_CONFIG label/badge Tailwind classes: inline token-based styles or leave Tailwind?
3. **UNCERTAIN 7E / 16H** — Seller/buyer colours: new `--agent-party-*` tokens, map to existing tokens, or confirm `--agent-vendor-accent`/`--agent-purchaser-accent` cover this?
4. **UNCERTAIN 7F / 16L** — CommsActivityFeed badge system: new tokens, map to existing, or leave as-is?
5. **UNCERTAIN 13B** — Text "Show"/"Hide" toggles: add CaretDown, or leave text-only?
6. **UNCERTAIN 16I** — `GROUP_LEFT_BORDER.snoozed` purple: confirm `--agent-snoozed` token is defined in theme blocks, then use it — or leave hardcoded?
7. **UNCERTAIN 16K** — CompletionFileRowView `later`/`no_date` dot colours: leave Tailwind, or convert to raw hex for inline style consistency with 7C?
8. **UNCERTAIN 17B** — AgentTodoList task rows: add `agent-hover-row` or leave no hover?

---

## Phase 4 sweep order

Recommended commit order (independent changes first; CSS infra before consumers):

1. **CSS infra** (`agent-system.css`) — CHANGE 11A (`agent-acc-hdr:focus-visible`), CHANGE 11B class definition (`agent-circle-btn`), CHANGE NC2A CSS class (`agent-note-item`).
2. **Ghost opacity sweep** — CHANGE 9A (hub), 9B (comms), 9C (work-queue). Three files, one commit.
3. **Border token sweep** — CHANGE 10A (CommsActivityFeed), 10B (comms page), 10C (AgentRemindersList ×2), 10D (AddManualTaskForm). Four files, one commit.
4. **Hardcoded colour sweep** — CHANGE 16A/B/C/E/F/G (all AgentRemindersList), 16D (TransactionRowView). Can combine with step 3 if scope is manageable.
5. **Caret rotation** — CHANGE 1A (SectionAccordion), 1B (CompletionsGroupList). Two files, one commit.
6. **Dropdown exit animation** — CHANGE 2A/2B (AgentRemindersList SideSnoozeMenu + RowSnoozeMenu). One file.
7. **Card surface sweep** — CHANGE 3A (comms page), 3B (completions page). Two files.
8. **Status token sweep** — CHANGE 7A/7B (TransactionRowView risk stripe + ACTIVITY_TONE), 7C (CompletionFileRowView GROUP_STYLES). Two files.
9. **Link / pill / hover** — CHANGE 5A (AgentTodoList link), 6A (comms filter pills), 17A (CompletionsGroupList hover). Three files.
10. **NC2A** (TransactionNotes hover → CSS class). One file.
11. **Post-Phase-3 decisions** — implement all UNCERTAIN items after Ellis decides.
