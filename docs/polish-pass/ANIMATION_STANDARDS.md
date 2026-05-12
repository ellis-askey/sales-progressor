# Animation Standards — Agent App

**Status:** Active standard. Applies to all 27 agent pages and (via portal handoff) the buyer/seller portal pass.  
**Established:** 2026-05-11, during new-v2 Stage 3.  
**Source:** Patterns proven in `/agent/anim-preview` (Rounds 1 and 2). Extracted to `agent-system.css` before new-v2 Stage 4.  
**Baseline reference:** `/agent/transactions/[id]` (transaction-detail) — the canonical production implementation of every class in this doc, signed off 2026-05-12. When in doubt about how a class should look or behave in production, open this page and observe. Keyframe definitions live in `app/agent/styles/agent-system.css`. Top-level implementation doc: `docs/ANIMATION_STANDARDS.md`.

---

## The rule

No page in the Polish Pass invents its own accordion, reveal, dropdown-entrance, row-flash, or row-exit animation. Everyone uses the six canonical classes below. If a page needs one of these patterns and a canonical class exists, it uses the canonical class. End of story.

The only exceptions are animations that require JavaScript measurement (A5 tab indicator, H1 status crossfade) — these are implemented per-page using the documented pattern. See **Per-page JS patterns** below.

---

## Six canonical classes

### 1. Accordion — `.agent-acc` / `.agent-acc-in`

**What it animates:** Collapsible sections. Height 0 → natural height on expand; natural height → 0 on collapse.

**Technique:** `grid-template-rows: 0fr ↔ 1fr` on the grid container. The inner element clips content during animation.

**How to use:**
```html
<!-- Container (grid wrapper — animates height) -->
<div class="agent-acc open">
  <!-- Inner (clips content during animation) -->
  <div class="agent-acc-in">
    <!-- Content goes here — can be any height -->
  </div>
</div>
```
Toggle the `.open` class on `.agent-acc` to expand / collapse.

**Timing:** Open 200ms / close 150ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Opacity fades with the height (0→1 open, 1→0 close).

**Reduced-motion:** `transition: none` — content appears/disappears instantly. The section is still fully functional.

**Where it applies:** Price & Fees, Notes, Chain (CollapsibleSection), Solicitors & Broker (SectionAccordion) on new-v2. Milestone groups (B1) and reminder cards (E2) on transaction detail and work queue.

**Stage 4 note (new-v2 Commit B):** Apply to `CollapsibleSection` and `SectionAccordion` production components.

---

### 2. Inline reveal — `.agent-reveal-in`

**What it animates:** An element that mounts in response to a user action — validation error message, inline edit form, delta preview row, "From memo" badge on extraction.

**How to use:**
```jsx
{condition && (
  <div className="agent-reveal-in">
    Error message or newly revealed content
  </div>
)}
```
If the same element can appear multiple times (e.g. re-submit triggering validation), use `key` to force remount: `<div key={errorKey} className="agent-reveal-in">`.

**Timing:** 150ms `ease-out`, `translateY(-3px) → translateY(0)`.

**Reduced-motion:** `animation: none` — element appears instantly.

---

### 3. Inline dismiss — `.agent-reveal-out`

**What it animates:** An element unmounting — the reverse of `.agent-reveal-in`.

**How to use (two-step pattern — required for exit animation to play):**
```tsx
// State: exiting boolean alongside the "shown" boolean
function cancelEdit() {
  setExiting(true);
  setTimeout(() => { setEditing(false); setExiting(false); }, 150); // match animation duration
}

// JSX:
{editing && (
  <div className={exiting ? "agent-reveal-out" : "agent-reveal-in"}>
    Inline edit form
  </div>
)}
```
Without the two-step, React unmounts instantly and the exit keyframe never runs.

**Timing:** 150ms `ease-in`, `translateY(0) → translateY(-3px)`.

**Reduced-motion:** `animation: none` — element disappears instantly.

---

### 4. Dropdown entrance — `.agent-dropdown-in`

**What it animates:** A dropdown menu appearing. Apply on mount.

**How to use:**
```jsx
{open && (
  <div key={dropdownKey} className="agent-dropdown-in" style={{ position: "absolute", ... }}>
    {/* menu items */}
  </div>
)}
```
Use `key` to force remount each open so the animation replays.

**Timing:** 120ms `ease-out`, `translateY(-4px) → translateY(0)`. This is a downward-opening direction. For dropdowns that open **upward** (e.g. user nav strip in sidebar), the translate direction must flip — apply `translateY(+4px) → translateY(0)` by adding a wrapping inline style override or a local class. Detect viewport proximity before deciding direction.

**Reduced-motion:** `animation: none` — dropdown appears instantly.

---

### 5. Row confirm flash — `.agent-row-flash`

**What it animates:** A milestone row flashing a subtle green wash after confirmation. The flash is the ambient signal; the dot pop (`ms-node-pop`) is the primary signal.

**How to use:**
```jsx
<div
  key={flashing ? flashKey : 0}  // key forces remount so flash replays
  className={flashing ? "agent-row-flash" : ""}
  style={{ display: "flex", ... }}
>
  {/* milestone row content */}
</div>
```

**Timing:** 700ms `ease-out`. Peaks at rgba(16, 185, 129, 0.07) at the 20% mark, returns to transparent.

**Reduced-motion:** `animation: none` — state change is still visible via dot colour change. No flash.

---

### 6. Row deletion exit — `.agent-row-exit`

**What it animates:** A list row being removed — fades out and collapses its height before the DOM node is actually removed.

**How to use (two-step pattern — required for the animation to play before removal):**
```tsx
// 1. Mark as exiting — row gets the class, animation plays
setExitingId(id);
// 2. After animation, fire the server action / state removal
setTimeout(() => {
  startTransition(async () => {
    await deleteAction(id);  // revalidates, row disappears from list
    setExitingId(null);
  });
}, 150);

// JSX:
<div className={exitingId === entry.id ? "agent-row-exit" : ""}>
  {/* row content */}
</div>
```
`forwards` fill-mode keeps the row at `opacity: 0 / max-height: 0` until React removes it from the DOM. `pointer-events: none` prevents interaction during the animation.

**Timing:** 150ms `ease-in`. `opacity: 1 → 0`, `max-height: 300px → 0`.

**Reduced-motion:** `animation: none; opacity: 0; max-height: 0; overflow: hidden` — row collapses instantly without a fade.

**Where it applies:** ActivityTimeline delete, ManualTaskCard delete, RemindersSection log snooze/dismiss.

---

## Six canonical interactive-state classes

These six classes cover every non-button interactive pattern. Defined in `agent-system.css`. All are theme-aware via `--agent-*` tokens. No per-page CSS for these patterns — if it's in this list, use the class.

### 6. Segment pill / toggle — `.agent-segment-pill`

**What it is:** Binary or multi-option selector (e.g. tenure, purchase type, fee type, self/outsourced mode).

**Selected state:** Add `.on`. Unselected: omit `.on` (no extra class).

**Small chip variant:** Add `.agent-segment-pill-sm` — reduces padding and font size for inline use.

**Subtitle text:** Wrap in `<span className="agent-segment-pill-note">` — muted below the label when unselected, coral when `.on`.

**How to use:**
```jsx
<button className={`agent-segment-pill${selected ? " on" : ""}`}>
  Freehold
  <span className="agent-segment-pill-note">No management pack</span>
</button>
```

**Hover:** Border lifts to `--agent-border-strong`; background to `--agent-glass-bg-subtle`. Suppressed when `.on` (already selected).

**Active:** `scale(0.97)` press-down.

**Focus:** `box-shadow: var(--agent-focus-ring)`.

**Reduced-motion:** Active transform suppressed.

---

### 7. Text link button — `.agent-link` / `.agent-link-muted`

**What it is:** Inline text action — "Load", "Change file", "+ Add", "Edit", "Remove", "Tell me more", "Skip".

**Muted variant:** `.agent-link-muted` — uses `--agent-text-muted`, `font-weight: regular`. Use for low-emphasis actions ("View all drafts", "Skip", "Cancel").

**How to use:**
```jsx
<button className="agent-link" style={{ fontSize: 12 }}>Change file</button>
<button className="agent-link agent-link-muted" style={{ fontSize: 12 }}>Skip</button>
```

**Hover:** Underline with `text-underline-offset: 2px`. Muted variant text darkens to `--agent-text-secondary`.

**Active:** `opacity: 0.65`.

**Focus:** `box-shadow: var(--agent-focus-ring)` on a `border-radius: sm` outline.

---

### 8. Bordered ghost button — `.agent-btn-ghost-bordered`

**What it is:** An `.agent-btn` variant — coral border, coral text, no fill at rest. Use for secondary CTAs that need more presence than a text link but less than primary (e.g. "+ Add chain", "+ Add sale above", "Try again").

**How to use:**
```jsx
<button className="agent-btn agent-btn-ghost-bordered agent-btn-sm">+ Add chain</button>
```
For dashed border (chain stubs): add `style={{ borderStyle: "dashed" }}`.

**Hover:** Fills to `--agent-coral-bg-tint`; border lightens to `--agent-coral`.

**Press-down:** Inherits `scale(0.98)` from `.agent-btn:active`.

**Focus:** `box-shadow: var(--agent-focus-ring)`.

---

### 9. Accordion header — `.agent-acc-hdr`

**What it is:** The clickable header row of a collapsible section. Pairs with `.agent-acc` / `.agent-acc-in` on the body.

**Sub-elements:**
- `.agent-acc-title` — section heading text
- `.agent-acc-summary` — muted subtitle / collapsed preview
- `.agent-acc-body` — inner padding wrapper for expanded content

**How to use:**
```jsx
<div className="agent-glass" style={{ overflow: "hidden" }}>
  <div className="agent-acc-hdr" role="button" tabIndex={0}
    onClick={() => setOpen(v => !v)}
    onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpen(v => !v)}>
    <span className="agent-acc-title">Price &amp; Fees</span>
    <span className="agent-acc-summary">£375,000 · £5,000 fee + VAT</span>
  </div>
  <div className={`agent-acc${open ? " open" : ""}`}>
    <div className="agent-acc-in">
      <div className="agent-acc-body">
        {/* content */}
      </div>
    </div>
  </div>
</div>
```

**Hover:** Background fills to `--agent-hover-tint`.

**Focus:** Inset ring `box-shadow: inset 0 0 0 2px var(--agent-border-focus)`.

**Active:** Background fills to `--agent-hover-tint-strong`.

**Keyboard:** The `role="button"` + `tabIndex={0}` + `onKeyDown` pattern is required for keyboard accessibility on div-based headers. Native `<button>` elements do not need these.

---

### 10. Dropdown menu item — `.agent-dropdown-item`

**What it is:** A full-width button inside a `.agent-dropdown-in` menu (status picker, snooze options, tone selector, any similar list). Full-width, left-aligned text, hover fills background.

**How to use:**
```jsx
<div className="agent-dropdown-in" style={{ position: "absolute", ... }}>
  {options.map(o => (
    <button key={o} className="agent-dropdown-item" onClick={() => pick(o)}>
      {o}
    </button>
  ))}
</div>
```

For items with a trailing note (e.g. "Recommended" tag): add `style={{ justifyContent: "space-between" }}`.

**Hover:** Background fills to `--agent-hover-tint`.

**Active:** Background fills to `--agent-hover-tint-strong`.

**Focus:** Inset box-shadow in `--agent-border-focus` + hover-tint background.

**Never use:** `onMouseOver`/`onMouseOut` inline to simulate hover on dropdown items. If you find yourself writing `e.currentTarget.style.background = "var(--agent-hover-tint)"`, convert to `.agent-dropdown-item`.

---

### 11. Circular icon button — `.agent-icon-btn`

**What it is:** Small circular icon or close (×) button. Hover fills a rounded background; active scales down.

**Sizes:**
- `.agent-icon-btn-sm` — 22×22px, 14px icon. For inline close buttons (carousel ×, dossier ×, "From memo" badge ×).
- `.agent-icon-btn-md` — 28×28px, 16px icon. For section-level close/dismiss controls.

**How to use:**
```jsx
<button className="agent-icon-btn agent-icon-btn-sm" aria-label="Remove vendor">×</button>
```

**Hover:** Background fills to `--agent-hover-tint`; text lightens to `--agent-text-secondary`.

**Active:** `scale(0.88)` + background fills to `--agent-hover-tint-strong`.

**Focus:** `box-shadow: var(--agent-focus-ring)`.

**Reduced-motion:** Active transform suppressed.

**Audit rule:** Any circular `×` or icon button with inline `background: "none"`, `border: "none"`, `borderRadius: "50%"` must be converted.

---

### 12. Hover colour shift — `.agent-hover-link`

**What it is:** Applies a `--agent-coral-deep` colour shift on hover to arbitrary text elements that are not anchors or full `.agent-link` buttons — typically labels, captions, or icon-adjacent text within a larger control group.

**How to use:**
```jsx
<button className="text-slate-900/40 agent-hover-link border border-dashed ...">
  + Add sale above
</button>
```

**Hover:** `color: var(--agent-coral-deep)` (150ms ease).

**States:** Hover only. No focus ring, no active state, no underline. For elements needing full keyboard affordance, use `.agent-link` instead.

**Where it applies:** ChainDrawer dashed "Add sale above / below" stub buttons — these live inside a group of controls where the full `.agent-link` underline would be visually noisy, and the hover colour shift is the intended feedback.

**Distinction from `.agent-link`:** `.agent-link` applies underline on hover + `box-shadow` focus ring. `.agent-hover-link` applies colour shift only. Never use `.agent-hover-link` as a substitute for `.agent-link` on standalone actions where focus visibility is required.

**Reduced-motion:** Colour transition is non-spatial — it remains in reduced-motion mode.

---

## Canonical surface and typography classes (added Stage 2, Hub pass)

These four classes were canonicalised during the Hub Stage 2 build. They are structural (not animation) but live in `agent-system.css` and follow the same "no per-page CSS" rule. Document here so the pattern is visible alongside the interactive-state classes.

### S1 — Internal card header — `.agent-card-hdr-internal`

**What it is:** Card header for stat and chart cards where the section label sits inside the card's own padding — no border-bottom, no flush-to-top positioning. Contains an `.agent-eyebrow` + `.agent-card-subtitle`.

**When to use:** Pipeline health, Momentum, Exchange forecast, Service split — any card where the header is a floating label above inline content, not a hard visual boundary.

**Distinction from `.agent-card-hdr`:** `.agent-card-hdr` is flush-to-card-top with `padding: 12px 16px` + `border-bottom`. Use `.agent-card-hdr` only when there is a clear content boundary between header and body (e.g. diary card, attention card). Use `.agent-card-hdr-internal` for internal floating headers.

**How to use:**
```jsx
<div className="agent-card-hdr-internal">
  <p className="agent-eyebrow" style={{ marginBottom: 2 }}>Pipeline health</p>
  <p className="agent-card-subtitle">Where your business sits right now</p>
</div>
```
Default `marginBottom` is 16px. Override inline where 20px is needed (e.g. Pipeline health card).

---

### S2 — Card subtitle — `.agent-card-subtitle`

**What it is:** 12px/muted subtitle text. Pairs with `.agent-eyebrow` inside `.agent-card-hdr-internal`.

**Do not use** as a standalone body copy replacement. It is specifically the subtitle that sits beneath the eyebrow in an internal header.

---

### S3 — Emphasis card title — `.agent-card-title-emphasis`

**What it is:** 13px/500/`--agent-text-primary` variant for card headers that need higher visual priority than `.agent-card-title` (12px/600/secondary). Use on attention card ("Needs your attention") and diary card — surfaces where the title is the primary visual anchor, not a secondary label.

**Distinction from `.agent-card-title`:** `.agent-card-title` is secondary-coloured and sits in standard widget headers. `.agent-card-title-emphasis` is primary-coloured and slightly larger — for the two hub cards that are action-oriented rather than informational.

---

### S4 — Light glass surface — `.agent-glass-light`

**What it is:** `rgba(255,255,255,0.42)` + `blur(16px)` — lighter than `.agent-glass-strong` (0.55), less opaque than `.agent-glass-subtle`. Use for secondary ribbon or band surfaces that need to recede visually behind primary stat cards.

**Where it applies:** Hub activity ribbon — the one surface on the hub that should feel "quieter" than the primary content cards.

**Do not use** as a substitute for `.agent-glass` or `.agent-glass-strong` on primary content cards.

---

## Canonical surface classes (added Stage 2, Work Queue pass)

### S5 — Warning card header — `.agent-card-hdr-warning`

**What it is:** Variant of `.agent-card-hdr` for cards whose header signals a warning or attention state. Same flex layout, padding (`12px 16px`), and border-bottom; background fills with `--agent-warning-bg` (theme-locked amber tint, identical hex across all six themes — see `themes.css` semantic-warning block).

**When to use:** A card header that needs to feel like a *soft warning surface* rather than a neutral panel. The warning is structural to the surface, not a one-off badge.

**Distinction from `.agent-card-hdr`:** Neutral header → `.agent-card-hdr`. Warning header → `.agent-card-hdr-warning`. Do not apply an inline `style={{ background: "amber-tint" }}` override on `.agent-card-hdr` — define a new variant if a new colour treatment is needed. Precedent: `.agent-hover-row-warning` at `agent-system.css:1084` (the paired warning-tint variant of `.agent-hover-row`).

**How to use:**
```jsx
<div className="agent-glass-strong" style={{ overflow: "hidden" }}>
  <div className="agent-card-hdr-warning">
    <div className="flex items-center gap-2">
      <Warning size={13} color="var(--agent-warning)" />
      <span className="agent-card-title">3 file alerts</span>
    </div>
    <button className="agent-link-muted">Show ↓</button>
  </div>
  …
</div>
```

**Where it applies:** Work queue `FileAlertsStrip` header (surfaces file-level data quality alerts — missing solicitor, overdue exchange, stale).

---

## Semantic tokens (added Stage 2, Work Queue pass)

### Snoozed token family — `--agent-snoozed-*`

**What it is:** A new theme-locked semantic colour family for the snoozed reminder state. Joins `--agent-warning-*`, `--agent-danger-*`, `--agent-success-*`, `--agent-info-*` as the fifth semantic state. Defined in all six theme blocks in `themes.css` at identical purple values.

**Tokens:**

| Token | Value | Purpose |
|---|---|---|
| `--agent-snoozed` | `#7E22CE` (purple-700 equivalent) | Primary text colour |
| `--agent-snoozed-bg` | `rgba(126, 34, 206, 0.08)` | Surface tint |
| `--agent-snoozed-border` | `rgba(126, 34, 206, 0.30)` | Border tint |
| `--agent-snoozed-rgb` | `126, 34, 206` | rgba composition channel |

**Why theme-locked (not theme-shifted):** Snoozed is a *single semantic state* with one meaning ("paused, will wake at scheduled time"), not a *signal within a colour-coded set* like E1's urgency hierarchy. Theme-locked semantic colours are the existing pattern for warning/danger/success/info — snoozed follows that precedent. E1 is the wrong precedent here: E1 governs multi-colour urgency relationships *within* a theme, not the colour of a single state *across* themes.

**Where it applies:** Snoozed banner on `ReminderCard` (transaction-detail and work queue); any future "paused" / "deferred" / "hibernating" UI state.

**Decision rationale (Work Queue Stage 2, 2026-05-12):** Initial production code used Tailwind `purple-50/200/600/700/800` values which are theme-fixed but escape the design system. Choice was between (a) a token family (token-driven theme-locked colour) or (b) documenting purple as an intentional E1-style exception. (a) was chosen because snoozed is structurally identical to warning/danger/success/info (single state, one universal meaning) and slotting it into the existing semantic-token pattern keeps the system uniform. (b) would have required defending why this one state lives outside the token system while four near-identical states live inside it.

---

## Deliberate exceptions

Components where semantic colour coding overrides canonical class rules. Do not "fix" these on any future pass — the exception is intentional and documented here.

### E1 — RemindersSection urgency group headers

**Component:** `components/reminders/RemindersSection.tsx`, `GROUP_CONFIG` constant (lines 47–52).

**Why not `.agent-acc-hdr`:** The urgency group headers carry semantically meaningful background colour coding:
- Escalated: `bg-red-50/70 border border-red-200`
- Overdue: `bg-orange-50/70 border border-orange-100`
- Due today: `bg-amber-50/60 border border-amber-100`
- Upcoming: `bg-white/30 border border-white/50`

This colour coding is the primary UI signal for urgency state and the most important information on the work queue. Applying `.agent-acc-hdr` would suppress all colour coding behind a neutral hover-state accordion header. The urgency headers are also not clickable (they are section dividers, not expand/collapse triggers), making `.agent-acc-hdr`'s cursor and hover states misleading.

**Rule:** Do not apply `.agent-acc-hdr` to urgency group headers on any future pass. The exception is permanent.

---

## Focus ring

**Where it lives:** `--agent-focus-ring` token in `themes.css` (all six theme blocks). Applied via `box-shadow: var(--agent-focus-ring)` in every `:focus` / `:focus-visible` rule in `agent-system.css`.

### Visual design

Two-layer `box-shadow` — a tight inner ring for accessibility, a soft outer glow for elegance:

```
--agent-focus-ring: 0 0 0 1.5px rgba(R, G, B, 0.50),   ← inner ring (border substitute)
                    0 0 12px 2px rgba(R, G, B, 0.18);   ← outer glow
```

The inner ring (1.5px, 50% opacity) acts as the WCAG-visible element border shift. The outer glow (12px blur, 18% opacity) provides the soft halo that doesn't clash with glass surfaces.

**Element border shift:** Elements that have an existing border (`.agent-input`, `.agent-textarea`, `.agent-segment-pill`) also shift `border-color` to `--agent-border-focus` on focus — providing a second, accessible indicator on the element itself.

### Theme-aware colours

| Theme | Focus colour |
|---|---|
| Sunset | `rgba(255, 138, 101, ...)` — coral |
| Coastal | `rgba(45, 122, 143, ...)` — teal |
| Heritage | `rgba(106, 133, 200, ...)` — blue-navy |
| Slate | `rgba(90, 107, 130, ...)` — blue-grey |
| Emerald | `rgba(61, 122, 90, ...)` — forest green |
| Claret | `rgba(139, 42, 61, ...)` — deep red |

### Transition

`box-shadow var(--agent-transition-fast)` (150ms ease) is in the base transition list of every focusable class: `.agent-btn`, `.agent-segment-pill`, `.agent-link`, `.agent-input`, `.agent-textarea`, `.agent-icon-btn`, `.agent-tab`, `.agent-nav-item`, `.agent-acc-hdr`. Glow fades in on focus, fades out on blur.

### Accordion header exception

`.agent-acc-hdr` uses an **inset** ring rather than an outer glow: `inset 0 0 0 1.5px var(--agent-border-focus), inset 0 0 12px rgba(var(--agent-coral-rgb), 0.06)`. Reason: the accordion header lives inside a parent with `overflow: hidden` (the glass card), which would clip any outer `box-shadow`. The inset ring is fully visible and accessible.

### Bespoke rules (not token-driven)

- `.agent-btn-danger:focus-visible` — uses danger-red glow: `0 0 0 1.5px rgba(199,62,62,0.50), 0 0 12px 2px rgba(199,62,62,0.18)`
- `.recharts-wrapper/surface:focus-visible` — SVG element uses `outline:` (box-shadow not applicable); left as-is
- `.price-hero-input:focus` — deliberately `box-shadow: none !important`; this is a display input where no focus ring is wanted

### Reduced-motion

Under `@media (prefers-reduced-motion: reduce)`, `box-shadow` is removed from the `transition-property` list for all focusable elements. The glow **still appears** — it just does so instantly rather than fading in. Keyboard navigation remains fully visible.

### WCAG 2.4.7 compliance

- The 1.5px inner ring at 50% opacity provides a visible border-like indicator even when the outer glow alone would be insufficient
- Elements with existing borders additionally shift `border-color` to `--agent-border-focus` on focus
- Verified: keyboard tab through all 6 themes clearly identifies focused element at all times

---

## `.agent-tab` — Underline tab paradigm

**What it is:** Tab buttons in a tab bar where the active state is communicated by a sliding 2px underline bar (JS-driven). No background fill on active — the underline is the sole indicator.

**How to use:**
```jsx
<div className="agent-tab-bar" style={{ padding: "0 20px", borderTop: "0.5px solid var(--agent-border-default)", position: "relative" }}>
  {tabs.map((t, i) => (
    <button
      key={t}
      ref={el => { btnRefs.current[i] = el; }}
      className="agent-tab"
      aria-selected={active === keys[i]}
      onClick={() => setActive(keys[i])}>
      {t}
    </button>
  ))}
  {ind && (
    <div style={{
      position: "absolute", bottom: 0, height: 2, borderRadius: 1,
      background: "var(--agent-coral-deep)",
      left: ind.left, width: ind.width,
      transition: rm ? "none" : "left 200ms ease, width 200ms ease",
    }} />
  )}
</div>
```

**States:**
- **At rest:** `--agent-text-muted`, no background
- **Hover (not active):** `--agent-text-secondary` (subtle lift, no fill)
- **Active (`aria-selected="true"`):** `--agent-text-primary`, `font-weight: medium`. Underline indicates active — not CSS.
- **Focus-visible:** `--agent-text-primary` + thin `text-decoration: underline` in `--agent-border-focus` colour at 1px. **NOT a halo. NOT a box-shadow.** The thin underline is a non-spatial focus signal that doesn't fight the JS indicator bar.
- **Disabled:** `--agent-text-disabled`

**Why no halo:** Tab context communicates active state structurally (the underline bar). Applying the input-style `box-shadow` focus ring creates a jarring halo inconsistent with that visual language.

**`.agent-tab-bar` requirements:** Must have `position: relative; overflow: hidden` for the absolute indicator bar. The `agent-tab-bar` class provides these. Consumers can add padding/border via inline style.

**Reduced-motion:** Colour transitions (150ms) are non-spatial — they stay even in reduced-motion. The sliding indicator is controlled by inline `transition` set to `"none"` when `rm`. The indicator still appears — it just snaps rather than slides.

---

## Per-page JS patterns

These require JavaScript measurement or state management. Document the pattern here. Implemented as shared utilities — pages import, not reinvent.

### A5 — Tab sliding underline (shared hook)

**Where:** Any page with a tab bar. Currently: transaction detail.

**Shared hook:** `lib/agent/use-tab-indicator.ts` — import and use; do not reimplement.

```tsx
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";

const { btnRefs, ind } = useTabIndicator(activeTabIdx);
```

`btnRefs` — attach to each tab button via `ref={el => { btnRefs.current[i] = el; }}`.
`ind` — `{ left, width } | null`. Null on first render (avoids 0,0 flash). Render the indicator bar only when non-null.

The consumer is responsible for the `transition` value:
```tsx
transition: rm ? "none" : "left 200ms ease, width 200ms ease"
```

**Verified in:** `app/agent/anim-preview/page.tsx` (A5 demo). Matches anim-preview output exactly.

### A6 — Progress ring draw-on (C3 pattern)

**Where:** Any ProgressRing component. Currently: TransactionSidebar, portal progress ring.

**Pattern:** `stroke-dashoffset` starts at `circ` (fully hidden), then transitions to `target` after a 60ms paint delay. This produces the draw-on sweep seen in anim-preview's C3 demo.

**Reference implementation:** `app/agent/polish/transaction-detail/page.tsx` → `SidebarProgressRing`

```tsx
function ProgressRing({ percent, rm }: { percent: number; rm: boolean }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const target = circ * (1 - percent / 100);
  const [offset, setOffset] = useState(rm ? target : circ);

  useEffect(() => {
    if (rm) { setOffset(target); return; }
    setOffset(circ);
    const t = setTimeout(() => setOffset(target), 60);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="track-colour" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="coral" strokeWidth={6} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: rm ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}
```

**Reduced-motion:** On mount with `rm=true`, `offset` is set directly to `target` — no transition, ring renders at final position immediately.

**Key detail:** `strokeDasharray={circ}` (not a string like `"176 176"`). The animation works by changing `strokeDashoffset` from `circ` (fully hidden) to `target` (correct fill). Animating `strokeDasharray` directly does not produce the draw-on effect.

### H1 — Status badge crossfade

**Where:** Transaction status badge when status changes (borderline — verify it reads as polish not lag before shipping).

**Pattern:** Two-step opacity: set `fading = true` → opacity 0 over 150ms → swap label → opacity 1 over 150ms. Total: ~300ms. On reduced-motion, instant swap.

---

## Button hover (`.agent-btn-[variant]:hover`)

All hover states are global in `agent-system.css`. No per-page hover CSS is ever written. Scope: every button that carries `.agent-btn` plus a variant class inherits the correct hover automatically.

### Per-variant behaviour

| Variant | Hover effect | Tokens used |
|---|---|---|
| `.agent-btn-primary` | Brightness +6%, shadow lifts, button rises 1px | `--agent-coral-rgb` (shadow), `filter: brightness(1.06)` |
| `.agent-btn-secondary` | Background lifts to `--agent-glass-bg-hover`, inset border tint, shadow lifts | `--agent-glass-bg-hover`, `--agent-glass-shadow-lifted`, `--agent-coral-base-rgb` |
| `.agent-btn-ghost` | Background fills to `--agent-coral-bg-tint`, text darkens to primary | `--agent-coral-bg-tint`, `--agent-text-primary` |
| `.agent-btn-danger` | Background fills to `--agent-danger-bg` | `--agent-danger-bg` |

All tokens are defined per-theme in `themes.css`. Hover states are theme-aware across all six themes with no per-page work.

### Transition

`filter`, `transform`, `box-shadow`, `background`, and `opacity` are all in the `.agent-btn` base transition at `--agent-transition-fast` (150ms). Brightness and lift are synchronised.

### Reduced-motion

The `translateY(-1px)` lift on `.agent-btn-primary:hover` and `.agent-btn-color-primary:hover` is suppressed under `@media (prefers-reduced-motion: reduce)` — no physical movement. The brightness and shadow changes are kept (they are not motion).

Ghost, secondary, and danger hovers involve only background/colour changes — no motion suppression needed.

### Audit rule (same as press-down)

Any button using inline `background` styling bypasses `.agent-btn` entirely and gets no hover. Stage 2 of each page must audit for inline-styled coral-filled and white-secondary buttons and convert them. Ghost/text/icon/pill controls are exempt — they do not carry `.agent-btn`.

---

## Button press-down (`.agent-btn:active`)

Already global — defined in `agent-system.css` for `.agent-btn:active { transform: scale(0.98) }`. No per-page work needed for any button that uses the `.agent-btn` class.

**Gap to watch:** Buttons with inline styles instead of `.agent-btn` class do not get press-down. Stage 2 of each page must audit for inline-styled buttons and convert them to `.agent-btn`.

**Stage 4 note (new-v2 Commit B):** HeroCard ("Drop a memo of sale", "Fill in manually"), SubmitArea CTA ("Save draft"), modal buttons ("Create anyway", "Change file", "Cancel" secondary), and Stage1Fields "Continue" converted to `.agent-btn` on the test page. Apply same conversion to production components.

---

## Reduced-motion contract

Every canonical class has a reduced-motion override in the `@media (prefers-reduced-motion: reduce)` block in `agent-system.css`. The `[data-rm="1"]` override on test pages suppresses all CSS `transition-duration` and `animation-duration` — canonical classes respond to this automatically.

No additional work is needed per-page for reduced-motion compliance. The global override handles it.

---

## Portal pass

This standard applies to the portal pass without modification. The five canonical classes live in `agent-system.css`, which is imported by the agent layout. Portal pages use a different layout (`/portal/[token]`). The portal pass must either:

1. Import `agent-system.css` into the portal layout (simplest — one import line), or
2. Duplicate the five canonical class definitions into a `portal-system.css` equivalent

Option 1 is preferred. Confirm at the start of the portal pass.

---

## Primary button theme-awareness

`.agent-btn-primary` uses `background: linear-gradient(135deg, var(--agent-coral-deep), var(--agent-coral-light))`. Both tokens shift per theme:

| Theme | `--agent-coral-deep` | Visual |
|---|---|---|
| Sunset | `#FF6B4A` | Orange-coral |
| Coastal | `#1F5A6E` | Teal |
| Heritage | `#4A6FB5` | Blue |
| Slate | `#3D4E66` | Slate-blue |
| Emerald | `#2D5A3D` | Forest green |
| Claret | `#6E1F2E` | Wine |

The primary button is **fully per-theme** — coral is the token name, not a colour constant. This is intentional brand design: each agency sees their theme's accent on primary CTAs.

**G4 Playwright test limitation:** The G4 test reads `getComputedStyle(el).backgroundColor`, which returns `transparent` for gradient backgrounds (the gradient lives in `backgroundImage`, not `backgroundColor`). The warning "identical across all themes" is a measurement artefact, not a token wiring failure. The test has been updated to read `backgroundImage` instead.

---

## Changelog

| Date | Change |
|---|---|
| 2026-05-11 | Initial extraction from anim-preview. Five classes added to agent-system.css. |
| 2026-05-11 | Button hover section added. `filter` added to `.agent-btn` transition. Reduced-motion override added for primary hover lift. |
| 2026-05-11 | Six canonical interactive-state classes added (§6–10): `.agent-segment-pill`, `.agent-link`, `.agent-btn-ghost-bordered`, `.agent-acc-hdr`, `.agent-icon-btn`. All defined in `agent-system.css`. Reduced-motion overrides added for pill and icon-btn active transforms. |
| 2026-05-11 | Focus ring redesigned: hard `0 0 0 3px` ring replaced with two-layer glow (`0 0 0 1.5px rgba 50% + 0 0 12px 2px rgba 18%`) across all six themes. `box-shadow` added to transition lists for segment-pill, link, nav-item, icon-btn, acc-hdr. Border-color shift added to segment-pill focus. Accordion header uses inset glow. Reduced-motion suppresses fade but glow still appears. |
| 2026-05-11 | `.agent-tab` redefined: pill-background style removed, underline paradigm adopted. Active state via JS sliding bar only. Focus via `text-decoration` (non-spatial), not `box-shadow` halo. `.agent-tab-bar` adds `position: relative; overflow: hidden`. |
| 2026-05-11 | `.agent-dropdown-item` added (§10): canonical class for dropdown menu list items. Replaces `onMouseOver`/`onMouseOut` inline hover on status, snooze, tone, and similar dropdowns. |
| 2026-05-11 | Shared hook `lib/agent/use-tab-indicator.ts` created (A5). Progress ring draw-on documented as A6 (C3 pattern from anim-preview). |
| 2026-05-11 | `.agent-hover-link` added as §12 — hover-only colour shift for non-anchor text within control groups. Deliberate exceptions section added: E1 (RemindersSection urgency headers — semantic colour overrides canonical class). Primary button theme-awareness section added with G4 Playwright measurement fix note. |
| 2026-05-11 | `.agent-sidebar-label` added — 11px/600/uppercase/0.06em tracking/coral-deep. Replaces `glass-section-label text-slate-900/40` on all TransactionSidebar section labels (Progress, Exchange Forecast, Key Dates, Agent, Price & Fees). |
| 2026-05-12 | `.agent-row-exit` added as §6 — row deletion exit (opacity + height collapse, 150ms ease-in). Canonical class count updated from 5 to 6. |
| 2026-05-12 | Four surface/typography classes added (§S1–S4, Hub Stage 2): `.agent-card-hdr-internal` (internal floating card header, 16px marginBottom), `.agent-card-subtitle` (12px/muted, pairs with eyebrow), `.agent-card-title-emphasis` (13px/500/primary, attention/diary cards), `.agent-glass-light` (rgba 0.42 + blur 16px, activity ribbon). Mobile borderLeft orphan fix added to `globals.css` for `.hub-stats-grid > *:nth-child(3)`. |
| 2026-05-12 | §S5 (Work Queue Stage 2): `.agent-card-hdr-warning` added — variant of `.agent-card-hdr` with `--agent-warning-bg` background tint. Applied to `FileAlertsStrip` header. Same flex/padding/border-bottom as base; only background differs. Precedent: `.agent-hover-row-warning` paired warning-tint variant. Resolves Stage 1 Point 2: no inline overrides of canonical classes. |
| 2026-05-12 | **Semantic token family added (Work Queue Stage 2): `--agent-snoozed-*`** — `--agent-snoozed` `#7E22CE`, `--agent-snoozed-bg` `rgba(126,34,206,0.08)`, `--agent-snoozed-border` `rgba(126,34,206,0.30)`, `--agent-snoozed-rgb` `126, 34, 206`. Theme-locked across all six theme blocks (identical hex), joining `--agent-warning-*`, `--agent-danger-*`, `--agent-success-*`, `--agent-info-*` as the fifth semantic state. Replaces theme-fixed Tailwind purple values in `ReminderCard` snoozed mode. Rationale: snoozed is a single semantic state, not a multi-colour urgency hierarchy — E1 is the wrong precedent. |
| 2026-05-12 | **Inventory template §15 added (locked during Work Queue Stage 1 approval):** new mandatory "Canonical contributions" section in `INVENTORY_TEMPLATE.md`. Tracks per-page new canonical classes and tokens with file:line citations, doc entries, and one-sentence reasons. Library maturity expectation: trends toward zero new entries by page 5 of the queue. |
| 2026-05-12 | **Canonical `.agent-segment-pill` at-rest visibility bump — third instance of pill-on-cream visibility issue fixed at canonical level.** At-rest `background: transparent` → `rgba(255,255,255,0.14)`; `border: 1.5px solid var(--agent-border-default)` (theme dark 0.10) → `var(--agent-border-strong)` (theme dark 0.18). Hover escalates via coral-tinted border (`rgba(var(--agent-coral-base-rgb), 0.30)`) + brighter white-alpha bg (0.32) — previews the `.on` selection direction, theme-aware through `--agent-coral-base-rgb`. **Two surfaces (MilestonePanel side tabs, ActivityTimeline filter pills) had hardcoded `rgba(255,255,255,0.6) + rgba(30,45,74,0.18)` band-aid overrides predating this fix. Those overrides rendered slate-blue on Sunset / Heritage / Emerald / Claret / Coastal — only on-theme on Slate. Removing the overrides as part of this commit restores theme-aware rendering retroactively across all five affected themes.** Prior instances (work-queue StatPills, transaction-detail hero pills) were fixed per-surface; this canonical bump supersedes both patterns. |
| 2026-05-12 | **Tab/pill canonical split locked — V4-as-hierarchy + V2-as-lesser (supersedes the 2026-05-12 visibility bump above).** Two canonicals, each with a clear role: `.agent-tab` (V4 underline, already exists at agent-system.css:769–805) is the **top-level navigation** treatment — page tabs, primary section nav, single-select orientation. Quiet at rest so content owns visual weight. `.agent-segment-pill` is rewritten to the **V2 solid-filled** spec — `background: rgba(255,255,255,0.50)`, `border: 1px solid rgba(255,255,255,0.55)`, `.on` is solid `var(--agent-coral-deep)` with white text + coral glow shadow. Mid-content selection — filter chips, sub-element pills, forecast month pills. The prior at-rest visibility bump is overwritten by this V2 spec; the band-aid-removal logic remains valid (MilestonePanel side tabs now use `.agent-tab`, ActivityTimeline filter pills inherit the new V2 canonical). **New canonical class added: `.agent-tab-bar-static`** — apply alongside `.agent-tab-bar` when the consumer does NOT render the `useTabIndicator` sliding underline. Renders the active 2px coral underline via `.agent-tab[aria-selected="true"]::after` pinned to the tab's bottom — no JS, no client component required. Use cases (this commit): transaction-list status tabs, MilestonePanel Vendor/Purchaser side tabs. The original sliding-indicator pattern at `.agent-tab-bar` (with `useTabIndicator` hook) remains the canonical choice when animation parity matters (transaction-detail top tabs). Per-consumer mapping documented in `C:\Users\ellis\.claude\plans\drifting-dancing-rossum.md`. |
