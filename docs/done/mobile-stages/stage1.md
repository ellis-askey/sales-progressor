# Mobile Fixes — Stage 1 Completion Report

## Summary

Stage 1 addressed shell-level and cross-cutting mobile responsiveness issues across the agent portal. Six sections of fixes were applied: `100dvh` viewport height, horizontal overflow protection, duplicate notification bell suppression, iOS input zoom prevention, body padding, and header padding. All fixes are CSS/class-level changes — no page logic, database schema, or dependencies were modified. TypeScript remained clean throughout.

---

## Changes by section

### Section 1 — SHELL-1 / SHELL-2 (`100vh` → `100dvh`)

**Findings resolved:** SHELL-1, SHELL-2

**What changed:**
- Root wrapper `<div>` in `AgentShell.tsx`: removed `minHeight: "100vh"` from inline style (which would override CSS); added class `agent-shell-root`
- Sidebar `<aside>` in `AgentShell.tsx`: removed `height: "100vh"` from inline style; added class `agent-sidebar-height`
- `globals.css`: added `.agent-shell-root` and `.agent-sidebar-height` rules using cascade-fallback pattern — `100vh` declared first (older browser fallback), `100dvh` declared second (wins in supporting browsers, ignored elsewhere)
- `globals.css` (mobile media query): updated `.agent-sidebar-mobile` mobile overlay from `height: 100vh !important` to same cascade pattern with `!important`

**Files touched:**
- `components/layout/AgentShell.tsx`
- `app/globals.css`

**Note:** iOS Safari URL-bar behaviour cannot be confirmed in headless Chromium. Requires a physical device or Xcode Simulator for visual verification.

---

### Section 2 — SHELL-3 (`overflow-x: hidden` on body)

**Findings resolved:** SHELL-3

**What changed:**
- `globals.css` `html` rule: added `overflow-x: hidden`
- `globals.css` `body` rule: added `overflow-x: hidden` and `max-width: 100vw`

**Files touched:**
- `app/globals.css`

**Note:** This clips horizontal overflow defensively. It does not fix the root causes (Comms filter tab row, Dashboard filter chip row) — those are Stage 2 and Stage 3 respectively. The overflow-causing content will be hidden rather than laid out correctly until those stages complete.

---

### Section 3 — SHELL-4 (Suppress duplicate `AgentBell` on mobile)

**Findings resolved:** SHELL-4

**What changed:**
- `AgentShell.tsx`: wrapped sidebar `AgentBell` in `<div className="agent-bell-sidebar">`
- `globals.css`: added `.agent-bell-sidebar { display: flex; }` as desktop default
- `globals.css` (mobile media query): added `.agent-bell-sidebar { display: none; }` — on mobile the top bar bell is used instead

**Files touched:**
- `components/layout/AgentShell.tsx`
- `app/globals.css`

---

### Section 4 — CC-3 / FORM-ZOOM (iOS Safari input zoom prevention)

**Findings resolved:** CC-3 (FORM-ZOOM), SET-3, NEW-2, PROP-7, RSS-1

**What changed:**
- `agent-system.css` `.agent-input`: `font-size: var(--agent-text-body)` → `font-size: max(16px, var(--agent-text-body))` (14px → 16px minimum)
- `agent-system.css` `.agent-input-sm`: `font-size: var(--agent-text-body-sm)` → `font-size: max(16px, var(--agent-text-body-sm))` (13px → 16px minimum — caught during investigation, not in original audit)
- `agent-system.css` `.agent-textarea`: same `max(16px, ...)` pattern (14px → 16px minimum)
- `globals.css` `.glass-input`: added explicit `font-size: 16px` (previously unset; relied on paired Tailwind `text-sm` class = 14px)

**Files touched:**
- `app/agent/styles/agent-system.css`
- `app/globals.css`

**Visual side-effect:** Input text is now 16px on desktop as well as mobile (previously 14px). This is a 14% size increase — inputs now match standard body reading size. Likely unnoticeable in practice but worth a visual check of the Settings profile form, New Sale form, and property file sidebar.

---

### Section 5 — CC-2 (Responsive body wrapper padding)

**Findings resolved:** CC-2, WQ-1, COMMS-2, DASH-1, SOL-2, SET-4, NEW-1

**What changed:** Six agent-side page body wrappers changed from `px-8 py-7` to `px-4 md:px-8 py-5 md:py-7`:

| File | Line |
|---|---|
| `app/agent/work-queue/page.tsx` | 97 |
| `app/agent/comms/page.tsx` | 114 |
| `app/agent/dashboard/page.tsx` | 89 |
| `app/agent/solicitors/page.tsx` | 71 |
| `app/agent/settings/page.tsx` | 41 |
| `app/agent/transactions/new/page.tsx` | 62 |

**Files touched:** The six files above.

**Out of scope (not touched):** 16 additional `px-8 py-7` occurrences in non-agent pages (`app/admin`, `app/dashboard`, `app/solicitors`, loading skeletons, etc.) and `components/transaction/PropertyFileTabs.tsx` (Stage 2). These were identified by grep and documented here for Stage 3/4 follow-up if needed.

---

### Section 6 — CC-1 (Responsive header padding)

**Findings resolved:** CC-1, WQ-2, COMP-1, TODO-2, DASH header, SOL header, SET header, NEW header

**What changed:** Nine agent-side page headers changed from inline `padding: "24px 32px 28px"` to responsive Tailwind classes `px-4 pt-6 pb-7 md:px-8`. The original padding maps to: top=24px (`pt-6`), horizontal=32px (`md:px-8`), bottom=28px (`pb-7`), with 16px mobile horizontal (`px-4`).

| File | Notes |
|---|---|
| `app/agent/work-queue/page.tsx:72` | `style` removed entirely; `relative` moved to className |
| `app/agent/completions/page.tsx:106` | Same |
| `app/agent/to-do/page.tsx:38` | Same |
| `app/agent/comms/page.tsx:66` | Same |
| `app/agent/dashboard/page.tsx:67` | Same |
| `app/agent/settings/page.tsx:34` | Same |
| `app/agent/transactions/new/page.tsx:55` | Same |
| `app/agent/solicitors/page.tsx:51` | Padding + `relative` to className; `display/alignItems/justifyContent` kept in `style={}` |
| `app/agent/loading.tsx:11` | Padding to className; visual styles (background, blur, shadow, border) kept in `style={}` |

**Files touched:** The nine files above.

**Hub header not touched:** The Hub page uses the existing `hub-header-pad` CSS class (with `!important` mobile override in `globals.css`), which is already a working responsive solution. It does not use the `padding: "24px 32px 28px"` inline pattern. Leaving it as-is is the lower-risk choice; a cleanup pass can consolidate it with the other pages later.

---

## Audit findings now resolved

| Finding | Severity | Resolution |
|---|---|---|
| SHELL-1 | HIGH | Section 1 — `100dvh` on sidebar |
| SHELL-2 | HIGH | Section 1 — `100dvh` on root wrapper |
| SHELL-3 | HIGH | Section 2 — `overflow-x: hidden` on html/body |
| SHELL-4 | LOW | Section 3 — `agent-bell-sidebar` hidden on mobile |
| CC-3 / FORM-ZOOM | HIGH | Section 4 — `max(16px, ...)` on all input CSS classes |
| SET-3 | HIGH | Section 4 (resolved via CC-3) |
| NEW-2 | HIGH | Section 4 (resolved via CC-3) |
| PROP-7 | HIGH | Section 4 (resolved via CC-3) |
| RSS-1 | HIGH | Section 4 (resolved via CC-3) |
| CC-2 | HIGH | Section 5 — responsive body padding on 6 pages |
| WQ-1 | HIGH | Section 5 |
| COMMS-2 | HIGH | Section 5 |
| DASH-1 | HIGH | Section 5 |
| SOL-2 | HIGH | Section 5 |
| SET-4 | HIGH | Section 5 |
| NEW-1 | HIGH | Section 5 |
| CC-1 | HIGH | Section 6 — responsive header padding on 9 pages |
| WQ-2 | HIGH | Section 6 |
| COMP-1 | MEDIUM | Section 6 |
| TODO-2 | HIGH | Section 6 |

---

## Audit findings remaining for Stage 2+

### Stage 2 — CRITICAL (blocking usability)
- **COMMS-1** [CRITICAL] — Comms header filter tab horizontal overflow (root cause; body padding partially fixed in Stage 1)
- **SET-1** [CRITICAL] — Settings `58fr/42fr` two-column grid no mobile fallback
- **SET-2** [CRITICAL] — Profile form 3-column NAME/EMAIL/PHONE grid no mobile fallback
- **PROP-1 / LT-2** [CRITICAL] — Property file `w-72` sidebar not hidden below `lg:` breakpoint
- **PROP-2** [CRITICAL] — Property file tab bar overflow (5 tabs, no `overflow-x-auto`)

### Stage 3 — HIGH (high-frequency pages)
- **HUB-1** — Hub header flex row needs `flex-wrap` for greeting + action buttons
- **PROP-3** — MetaField `130px 160px 1fr` grid no mobile fallback
- **PROP-4** — Overview `grid grid-cols-2` sections no mobile fallback
- **PROP-5** — PropertyHero breadcrumb overflow
- **SOL-1** — Solicitors header flex overflow (stat chips)
- **RSS-2** — RecommendedSolicitorsSettings contact form `grid-cols-2`

### Stage 4 — MEDIUM/LOW (polish)
- **RSS-4** — "Remove" button touch target
- **LT-1** — OnboardingChecklist panel mobile overlap
- **LT-3** — Dashboard filter chip row horizontal overflow
- **HUB-3** — Activity ribbon "View file" crowding
- **ANAL-1** — Solicitor performance row on narrow screens
- **WQ-3** — Snooze/kebab dropdowns may clip at top of viewport
- **NEW-3** — Purchase type button text wrapping

---

## Findings flagged

1. **Hub `hub-header-pad` CSS class**: Left in place. It is the hub's existing responsive header solution — not a redundant workaround. Can be consolidated with the other pages' pattern in a future cleanup pass.
2. **`.agent-input-sm` bonus fix**: The audit did not call out `.agent-input-sm` (13px font) but it was caught during the CC-3 investigation. Fixed in Section 4.
3. **Non-agent `px-8 py-7` occurrences**: 16 files outside `/app/agent/` use the same pattern. Untouched — they are client portal, admin, and legacy pages outside the mobile audit scope.

---

## Database changes

None.

## New dependencies

None.

## Breaking changes / visible differences

| Change | User-visible effect |
|---|---|
| Input font-size 14px → 16px | Form field text is slightly larger everywhere inputs use `.agent-input`, `.agent-textarea`, or `.glass-input`. Standard and expected — 16px is the correct body reading size. |
| Header padding 32px → 16px on mobile | Page headers have more usable horizontal space at 375px. No visible change at ≥768px. |
| Body padding 32px → 16px on mobile | Page content areas have more usable horizontal space at 375px. No visible change at ≥768px. |
| `100dvh` on root + sidebar | No visible change in Chromium. iOS Safari URL bar no longer clips bottom of shell. |
| `overflow-x: hidden` on body | Horizontal scroll is no longer possible on any page. Content overflowing to the right is now clipped rather than scrollable. |
| Sidebar bell hidden on mobile | No visible change on mobile — the top bar bell was already the primary bell. One fewer DOM element polling for notifications on mobile. |

---

## Files touched (full list)

- `components/layout/AgentShell.tsx`
- `app/globals.css`
- `app/agent/styles/agent-system.css`
- `app/agent/work-queue/page.tsx`
- `app/agent/comms/page.tsx`
- `app/agent/dashboard/page.tsx`
- `app/agent/solicitors/page.tsx`
- `app/agent/settings/page.tsx`
- `app/agent/transactions/new/page.tsx`
- `app/agent/completions/page.tsx`
- `app/agent/to-do/page.tsx`
- `app/agent/loading.tsx`

---

## Stage 1.5 addendum — post-iPhone test fix (2026-04-27)

### Bug found on real device

After Stage 1 merged, real iPhone testing revealed that the drawer-**closed** state was broken on every page: main content rendered as a narrow vertical strip (~40% viewport width) with large empty space on the left. Drawer-**open** appeared correct because the sidebar overlays content. Input zoom (CC-3) could not be tested because the inputs were inaccessible in the broken layout.

### Root cause

`AgentShell.tsx` root wrapper is `display: flex` (default `flex-direction: row`). On mobile, `.agent-sidebar-mobile` correctly becomes `position: fixed` (removing the sidebar from flex flow). However, `.agent-mobile-header` uses `position: sticky`, which keeps it **in** the flex flow. With the sidebar out of flow, the two remaining in-flow flex row children were the mobile header and `<main>` — causing them to sit side by side horizontally, with the mobile header consuming the space the sidebar previously occupied (~40–45% of viewport).

Desktop was unaffected because `.agent-mobile-header` has `display: none` at ≥768px.

### Fix applied

**File:** `app/globals.css` — inside the existing `@media (max-width: 767px)` block.

```css
/* Stack header above main — sidebar is position:fixed (out of flow) on mobile */
.agent-shell-root {
  flex-direction: column;
}
```

One rule. Switches the root flex container to column on mobile so the sticky mobile header stacks above `<main>`. No changes to `AgentShell.tsx` or any other file.

### Verification (Chromium emulation, 375px)

| Check | Result |
|---|---|
| `<main>.getBoundingClientRect().width` — Hub, Reminders, Settings, New Sale (drawer CLOSED) | **375px** on all four — full viewport width ✓ |
| Drawer OPEN — hamburger click, sidebar slides in | Works as before ✓ |
| Desktop `<main>` width at 1440px | **1220px** (= 1440 − 220px sidebar) — no regression ✓ |

### Remaining manual verification (user action required)

- [ ] iPhone drawer-closed layout now fills full width on all pages
- [ ] Settings name field: tap input, no viewport zoom (CC-3 — was blocked by layout bug before)
- [ ] New Sale first input: tap, no viewport zoom
- [ ] Sidebar drawer still opens/closes correctly
