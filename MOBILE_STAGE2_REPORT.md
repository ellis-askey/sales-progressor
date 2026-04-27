# Mobile Fixes — Stage 2 Completion Report

## Summary

Stage 2 addressed property file page responsiveness, the Comms filter tab overflow, Settings layout issues, and several mid-stage bugs uncovered during real-device testing. Ten audit findings were resolved across six planned sections. Five additional bugs were caught and fixed as mid-stage fixes — including a CSS cascade layering bug that had silently kept iOS zoom active despite the Stage 1 CC-3 fix. All changes are layout/class-level; no database schema, API, or business logic was modified. TypeScript remained clean throughout.

---

## Changes by section

### Section 1 — COMMS-1

**Findings resolved:** COMMS-1

**What changed:**
- Comms page header: replaced inline `display:flex; justify-content:space-between` row with responsive Tailwind
- Mobile: heading + subtitle stack above filter tabs (flex-col); filter tab container goes full-width with each tab `flex-1` (50/50 split); tab vertical padding increased to `py-2.5` (≥44px touch target)
- Desktop (`md:`): reverts to original side-by-side layout with tabs at natural width

**File touched:**
- `app/agent/comms/page.tsx`

---

### Section 2 — SET-1, SET-2

**Findings resolved:** SET-1, SET-2

**What changed:**

SET-1 — Settings two-column grid:
- Replaced `display:grid; gridTemplateColumns:'58fr 42fr'` inline style with `grid-cols-1 md:grid-cols-[58fr_42fr]`
- Profile card and Sending addresses card now stack vertically on mobile; side-by-side layout preserved at ≥768px

SET-2 — Profile form three-column grid:
- Replaced `display:grid; gridTemplateColumns:'1fr 1fr 1fr'` inline style with `grid-cols-1 sm:grid-cols-3`
- Name/Email/Phone inputs stack vertically on small screens; three-column layout restores at ≥640px

**Section 2 follow-up — Team card layout overflow (Issue A):**
- Director card: `truncate` added to name/email paragraphs; Director pill wrapped in `flex-shrink-0`
- Negotiator card: `truncate` on name/email; toggle + delete wrapped in `flex-shrink-0` container; delete button touch target increased from 28px (`w-7/h-7`) to 44px (`min-w-[44px]/min-h-[44px]`) for iOS compliance
- Long email addresses now truncate with ellipsis rather than wrapping into the action buttons column

**Files touched:**
- `app/agent/settings/page.tsx`
- `components/agent/ProfileForm.tsx`
- `components/agent/TeamManagement.tsx`

---

### Section 3 — PROP-2

**Findings resolved:** PROP-2

**What changed:**
- Tab bar inner container: added `overflow-x-auto scrollbar-hide` and responsive horizontal padding `px-4 md:px-8`
- Tab buttons: added `flex-shrink-0` so tabs never collapse below their label width
- Auto-scroll: added `useRef` + `useEffect` to scroll the active tab into view on switch (`scrollIntoView` inline/nearest)
- `globals.css`: added `.scrollbar-hide` utility (hides scrollbar without a plugin)
- Deleted orphaned `components/transactions/QuickAddForm.tsx` — confirmed zero imports, 373 lines of dead code removed

**Files touched:**
- `components/transaction/PropertyFileTabs.tsx`
- `app/globals.css`
- `components/transactions/QuickAddForm.tsx` (deleted)

---

### Section 4a — PROP-1, LT-2

**Findings resolved:** PROP-1, LT-2

**What changed:**
- `<lg`: the `w-72` right-column sidebar is now hidden; a "File details" collapsible button appears above tab content, toggling the sidebar open/closed
- Toggle state persists across SPA navigations via a module-scoped variable (`_sessionSidebarOpen`) so re-entering a property file respects the last-used preference
- `≥lg`: existing sticky right-column sidebar unchanged
- Content area padding updated: `px-8 py-7` → `px-4 lg:px-8 py-5 lg:py-7`

**File touched:**
- `components/transaction/PropertyFileTabs.tsx`

---

### Section 4b + 4c — PROP-3, PROP-4

**Findings resolved:** PROP-3, PROP-4

**What changed:**

PROP-3 — MetaField status strip:
- Replaced `gridTemplateColumns:'130px 160px 1fr'` inline style with responsive Tailwind
- Mobile: `grid-cols-2` — Status and Assigned to side-by-side on row 1; Last progress spans `col-span-2` on row 2 with explicit `border-t border-white/20` separator
- Desktop (`md:`): `grid-cols-[130px_160px_1fr] divide-x divide-y-0` — original three-column layout preserved

PROP-4 — Overview two-column grids:
- Three grid rows (Contacts+Solicitors, Reminders+Activity, Risk+Chain): `grid-cols-2` → `grid-cols-1 md:grid-cols-2`
- Each section now stacks vertically on mobile; two-column layout restores at ≥768px

**File touched:**
- `app/agent/transactions/[id]/page.tsx`

---

### Section 4d — PROP-5, PROP-6

**Findings resolved:** PROP-5, PROP-6

**What changed:**

PROP-5 — PropertyHero breadcrumb row:
- Breadcrumb container: `flex-col gap-1.5 mb-4` on mobile → `md:flex-row md:items-center md:justify-between md:mb-[18px]`
- Mobile row 1: "My Files" back link only
- Mobile row 2: agency name (left) + flag slot and status pill (right) — `flex items-center justify-between`
- Desktop: original horizontal layout with separator and right-aligned flag+pill preserved

PROP-6 — PropertyHero bottom row + padding:
- Outer content div: inline `padding:'20px 32px 26px'` replaced with `px-4 pt-5 pb-6 md:px-8 md:pb-7` (16px horizontal on mobile, 32px on desktop)
- Address `h1`: fixed `fontSize:'30px'` → `text-2xl md:text-[30px]` (24px mobile, 30px desktop)
- Bottom row: inline `display:'flex'; flexWrap:'wrap'` → `flex flex-col gap-3 md:flex-row md:items-end md:justify-between` — price/pills above exchange+progress on mobile; side-by-side on desktop
- Progress bar wrapper: `md:min-w-[150px]` on desktop; `flex-1` fills full width when on its own mobile row

**File touched:**
- `components/transaction/PropertyHero.tsx`

---

## Mid-stage fixes

### iOS zoom layer-precedence (CC-3 cascade bug)

**Root cause:** The Stage 1 CC-3 fix added `font-size: 16px` to `.glass-input` inside `@layer components`. Tailwind utility classes (`text-sm`, `text-xs`) live in `@layer utilities`, which the CSS cascade evaluates after `@layer components` regardless of source order. Every `.glass-input` element paired with a Tailwind `text-*` class was silently rendering at 14px or 12px — below the 16px threshold — and zooming on iOS.

**Fix:** Unlayered rules added to `globals.css` for `.glass-input`, `.agent-input`, and `.agent-textarea`. Unlayered CSS beats all `@layer` declarations regardless of specificity, so the 16px floor is now guaranteed.

**Also in this commit:**
- `ActivityTimeline` search input: added `glass-input` class (was bespoke `text-xs` only; had no zoom protection)
- `ManualTaskList`: removed redundant "To-Do" `h2` heading that duplicated the sidebar tab label

**Files touched:** `app/globals.css`, `components/activity/ActivityTimeline.tsx`, `components/todos/ManualTaskList.tsx`

---

### ProfileForm bespoke input zoom

The ProfileForm FIELD constant used a hardcoded `text-sm` class (14px). Because this is not a `glass-input` element, neither the original CC-3 fix nor the layer-precedence fix covered it. Changed FIELD's font size to `text-base` (16px).

**File touched:** `components/agent/ProfileForm.tsx`

---

### PriceInput referral variant zoom

The referral variant of `PriceInput` (`variant="referral"`) applied a bespoke `text-base` class in the input element but was internally using `text-sm` (14px) on the `NumericFormat` wrapper. Changed to `text-base` (16px) to close the last bespoke-input iOS zoom case (used in SolicitorSection and ReferralSection).

**File touched:** `components/ui/PriceInput.tsx`

---

### SolicitorIntelBadge horizontal overflow

The stats row inside `SolicitorIntelBadge` (`flex items-center gap-4`) rendered up to four `<span>` elements in a nowrap flex row. On a 375px viewport this exceeded container width, stretching the page body and causing secondary overflow/clipping across the entire property file page.

**Fix:** Added `flex-wrap` and `gap-y-1` to the stats row. Spans now wrap onto a second line when needed.

**File touched:** `components/solicitors/SolicitorSection.tsx`

---

### PropertyFileTabs `items-start` → `lg:items-start`

**Root cause:** The outer tab+sidebar wrapper used `flex flex-col … items-start`. In a `flex-col` context `items-start` (= `align-items: flex-start`) causes cross-axis sizing to use intrinsic content width rather than stretch. When a property file was entered via `?tab=reminders` (Hub work queue), the Reminders tab content was active first, and its widest child established the container's intrinsic width. Switching tabs did not reset this — the container remained wider than the viewport, causing persistent overflow even after navigating away from the Reminders tab.

**Fix:** Changed `items-start` to `lg:items-start`. Mobile now uses `align-items: stretch` (the default), constraining the tab content wrapper to exactly the container width. The `lg:items-start` rule is preserved for desktop where the sidebar is a right-column flex sibling that should top-align with the content area.

**File touched:** `components/transaction/PropertyFileTabs.tsx`

---

## Audit findings now resolved

| Finding | Severity | Resolution |
|---|---|---|
| COMMS-1 | CRITICAL | Section 1 — filter tabs scrollable + stacked heading on mobile |
| SET-1 | CRITICAL | Section 2 — Settings 58fr/42fr grid responsive |
| SET-2 | CRITICAL | Section 2 — ProfileForm 3-col grid responsive |
| PROP-2 | CRITICAL | Section 3 — tab bar `overflow-x-auto` + `flex-shrink-0` tabs |
| PROP-1 | CRITICAL | Section 4a — `w-72` sidebar hidden below `lg:` |
| LT-2 | CRITICAL | Section 4a — "File details" collapsible added for mobile/tablet |
| PROP-3 | HIGH | Section 4b — MetaField strip responsive grid |
| PROP-4 | HIGH | Section 4c — Overview 2-col grids responsive |
| PROP-5 | HIGH | Section 4d — PropertyHero breadcrumb row responsive |
| PROP-6 | HIGH | Section 4d — PropertyHero bottom row + padding responsive |

---

## Audit findings remaining for Stage 3+

### Stage 3 — HIGH

- **WQ-NEW** [HIGH] — `FileAlertsStrip.tsx` internal flex overflow: multiple alert badge chips (`flex-shrink-0`) + long action link text (`shrink-0 whitespace-nowrap`, e.g. "Add purchaser solicitor →" ≈154px) can exceed the 311px row width on narrow viewports. Confirmed **not resolved** by the PropertyFileTabs `items-start` fix — separate internal overflow requiring its own treatment.
- **MYFILES-1** [HIGH] — My Files header button group overflow on narrow screens
- **HUB-1** [MEDIUM] — Hub header flex row needs `flex-wrap` for greeting + action buttons
- **SOL-1** [MEDIUM] — Solicitors page header flex overflow (stat chips)
- **RSS-2** [MEDIUM] — RecommendedSolicitorsSettings contact form `grid-cols-2` no mobile fallback

### Stage 4 — MEDIUM/LOW (polish)

- **RSS-4** — "Remove" button touch target
- **LT-1** — OnboardingChecklist panel mobile overlap
- **LT-3** — Dashboard filter chip row horizontal overflow
- **HUB-3** — Activity ribbon "View file" crowding
- **ANAL-1** — Solicitor performance row on narrow screens
- **WQ-3** — Snooze/kebab dropdowns may clip at top of viewport
- **NEW-3** — Purchase type button text wrapping

---

## Database changes

None.

## New dependencies

None.

## Breaking changes / visible differences

| Change | User-visible effect |
|---|---|
| Comms filter tabs — full-width flex-1 on mobile | Each tab is 50% of screen width on mobile. At ≥768px, tabs revert to natural width with heading beside them. |
| Settings grid stacked on mobile | Profile card and Sending addresses card appear one above the other on small screens. |
| ProfileForm stacked on mobile | Name, Email, Phone inputs stack vertically below 640px. |
| Property file sidebar hidden below lg | A "File details" chevron-toggle appears above tab content on mobile/tablet. Desktop right sidebar unchanged. |
| MetaField grid — 2-col mobile | Status and Assigned to side-by-side; Last progress on its own row below. Desktop 3-col unchanged. |
| Overview sections — 1-col mobile | Contacts, Solicitors, Reminders, Activity, Risk, Chain stack vertically below 768px. |
| PropertyHero padding — 16px mobile | File header has smaller horizontal padding on mobile. |
| PropertyHero address — 24px mobile | Address heading is 24px on mobile (was 30px fixed). |
| PropertyHero rows stacked on mobile | Breadcrumb and bottom rows now stack on mobile; desktop layouts unchanged. |
| Input font-size 14px/12px → 16px | Glass inputs, agent inputs, and textareas previously rendered at sub-16px due to CSS cascade bug. Now correctly 16px everywhere. This corrects rather than introduces a visual change — these inputs were always supposed to be 16px from Stage 1. |
| SolicitorIntelBadge stat row wraps | Stats wrap to a second line rather than overflowing when more than 2–3 items are present. |

---

## Files touched (full list)

- `app/agent/comms/page.tsx`
- `app/agent/settings/page.tsx`
- `app/agent/transactions/[id]/page.tsx`
- `app/globals.css`
- `components/agent/ProfileForm.tsx`
- `components/agent/TeamManagement.tsx`
- `components/activity/ActivityTimeline.tsx`
- `components/solicitors/SolicitorSection.tsx`
- `components/todos/ManualTaskList.tsx`
- `components/transaction/PropertyFileTabs.tsx`
- `components/transaction/PropertyHero.tsx`
- `components/ui/PriceInput.tsx`
- `components/transactions/QuickAddForm.tsx` (deleted — dead code)

---

## Note

**WQ-NEW remains scoped for Stage 3** — confirmed not resolved by the `items-start` fix. The standalone work queue page (`/agent/work-queue`) uses a simple block layout unrelated to `PropertyFileTabs`. The overflow is an internal issue within `FileAlertsStrip.tsx`: each file row's flex layout can't accommodate multiple alert badge chips alongside the `shrink-0 whitespace-nowrap` action link within the available ~311px width. Requires its own treatment in Stage 3.
