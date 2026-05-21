# Mobile Responsiveness Audit — Agent Side

## Overview
- Total pages audited: 11 (Hub, Reminders/Work Queue, Completions, To-Do, Updates/Comms, All Files/Dashboard, Analytics, Solicitors, Settings, New Sale, Property File Detail)
- Breakpoints assessed: 375 / 390 / 414 / 768 / 1024
- Roles: Director, Negotiator (role-specific findings noted inline)
- Methodology: Code inspection + Tailwind class audit (no live browser testing — findings are based on static analysis; a small number are flagged with confidence level)

---

## Severity definitions

- **CRITICAL**: Page fundamentally broken — content cut off, feature inaccessible, blocking use
- **HIGH**: Significant usability issue — cramped, hard to use, missing 44px touch targets, iOS zoom triggered
- **MEDIUM**: Quality issue — layout awkward but functional, minor overflow
- **LOW**: Polish — spacing, alignment, minor inconsistency
- **NONE**: Correct as-is

---

## Layout shell (affects all pages)

### Issues found

**SHELL-1** [HIGH] — Sidebar uses `height: "100vh"` rather than `100dvh` (iOS Safari URL bar bug)

- File: `components/layout/AgentShell.tsx` line 104
- Breakpoints affected: 375, 390, 414 (all mobile)
- Description: The sidebar's inline style sets `height: "100vh"`. On iOS Safari, `100vh` is the full viewport including the retracted URL bar, so when the bar is visible the bottom of the sidebar is cut off behind it. The fix is `100dvh` (dynamic viewport height), with a `100vh` fallback for older browsers.
- Impact: When the mobile drawer is open, the user profile / sign-out section at the bottom of the sidebar may be partially obscured or unreachable.
- Recommended fix direction: Change `height: "100vh"` to `min(100dvh, 100%)` or use a CSS var that resolves to `100dvh` with a `100vh` fallback.

**SHELL-2** [HIGH] — Root wrapper also uses `minHeight: "100vh"` (same iOS issue)

- File: `components/layout/AgentShell.tsx` line 45
- Breakpoints affected: 375, 390, 414
- Description: `<div style={{ display: "flex", minHeight: "100vh" }}>` sets the shell minimum height. Same iOS Safari URL-bar problem as SHELL-1; the page content area may be marginally shorter than the actual visible viewport, causing a visible gap at the bottom on some iOS versions.
- Impact: Minor visual artifact on iOS Safari; not blocking.
- Recommended fix direction: Use `min-height: 100dvh` (with `100vh` fallback).

**SHELL-3** [MEDIUM] — No `overflow-x: hidden` or `max-width: 100vw` on `body` / root

- File: `app/globals.css` (body ruleset, lines 59–66)
- Breakpoints affected: All mobile
- Description: The body has no `overflow-x: hidden` or `max-width: 100vw`. Because several page sections use inline `padding: "24px 32px"` without responsive clamping, horizontal scroll is possible on narrow screens if any child overflows. This is a defensive gap rather than a confirmed overflow.
- Impact: Risk of horizontal scroll bleed if any page-level content overflows (several candidates identified in per-page findings below).
- Recommended fix direction: Add `overflow-x: hidden` to `body`, or verify each page clips its own overflow.

**SHELL-4** [LOW] — Mobile top bar duplicates the `AgentBell` component

- File: `components/layout/AgentShell.tsx` lines 91 and 131
- Breakpoints affected: Below 768px
- Description: `AgentBell` is rendered in both the mobile top bar (line 91) and inside the sidebar (line 131). On mobile the sidebar is an overlay, so both instances are effectively rendered in the DOM simultaneously. This is a minor DOM duplication but may cause two separate notification polling requests.
- Impact: Negligible UX impact; a small performance concern.
- Recommended fix direction: Suppress the sidebar `AgentBell` on mobile (e.g., `display: none` on `.agent-sidebar-close` already exists — add the same pattern for the in-sidebar bell on mobile).

**SHELL-5** [LOW] — Sidebar `position: sticky` used on desktop (not `fixed`)

- File: `components/layout/AgentShell.tsx` line 103
- Breakpoints affected: Desktop only (no mobile impact — mobile overrides to `position: fixed`)
- Description: On desktop the sidebar is `position: sticky`, which works correctly with the flex parent. This is not a mobile issue. Noted for completeness.
- Impact: None on mobile.

---

## Page-by-page

---

### 1. Hub (`/agent/hub`)

#### A. Shell-level bugs
See SHELL-1–3 above; they affect this page.

#### B. Layout issues

**HUB-1** [HIGH] — Hub header padding not responsive (inline style overrides CSS class)

- File: `app/agent/hub/page.tsx` lines 319–373 (full hub) and 151–194 (empty state)
- Breakpoints affected: 375, 390, 414
- Description: The header `<div>` applies both a CSS class `hub-header-pad` and an inline style `padding: "22px 32px 26px"`. CSS inline styles have higher specificity than class-based overrides. The `globals.css` rule `.hub-header-pad { padding: 16px 16px !important; }` uses `!important` to override the inline style at mobile, which should work — but `!important` in a media query fighting an inline style is fragile and the pattern is error-prone. The greeting/action row at the top of the header (`display: "flex", justifyContent: "space-between"`) has no mobile fallback to column layout, meaning on a 375px screen the greeting text and "New sale" + "Send note" buttons will fight for horizontal space. The buttons (`flexShrink: 0`) will hold their size and the greeting text will be truncated. **Confidence: HIGH** — the flex row has `gap: 16` and `flexShrink: 0` on the button group with no `flex-wrap` or column fallback.
- Impact: On 375px, the greeting text is likely truncated and the action buttons overlap or push the heading into an awkward line break.
- Recommended fix direction: Add `flexWrap: "wrap"` to the header flex row, or move buttons below the greeting text on mobile.

**HUB-2** [MEDIUM] — Ghost pipeline stats grid `gridTemplateColumns: "repeat(4, 1fr)"` not responsive in empty state

- File: `app/agent/hub/page.tsx` line 231
- Breakpoints affected: 375, 390, 414
- Description: The "Ghost pipeline health" card in the empty state uses inline style `gridTemplateColumns: "repeat(4, 1fr)"` with no responsive breakpoint. On mobile (where the hub-grid-main override collapses the parent grid to 1 column), the inner stats grid still tries to render 4 columns. At 375px each cell is roughly 80px wide — barely readable for the skeleton values and label text.
- Impact: Skeleton content is visually squished but this is the empty state so it is lower priority. The ghost cards have `pointerEvents: "none"` so no interaction is broken.
- Recommended fix direction: Use `gridTemplateColumns: "repeat(2, 1fr)"` for the inner stats grid on mobile. The `hub-stats-grid` CSS class already handles the stats grid in the full hub correctly — the empty state ghost card should use the same class.

**HUB-3** [HIGH] — Activity ribbon "View file" link may be clipped on narrow screens

- File: `app/agent/hub/page.tsx` lines 852–897
- Breakpoints affected: 375, 390
- Description: The activity ribbon uses `display: "flex", alignItems: "center", justifyContent: "space-between"`. The left side contains an icon, description, and context (two lines of text); the right side contains the "View file →" link (`flexShrink: 0`). On a 375px screen with the left content wrapping across two lines, the flex row may become very tight. The left `<div>` has `flex: 1` so it can shrink, but the activity description text has `fontSize: 12` with no `overflow: hidden` / `whiteSpace: "nowrap"`, meaning it will wrap. No explicit `flexWrap: "wrap"` means the two sides must share the single row. At 375px with 32px padding total (from `hub-content-pad` override), usable width is ~343px. This is tight but probably workable. **Confidence: MEDIUM** — depends on text length.
- Impact: Long activity descriptions may crowd the "View file" link.
- Recommended fix direction: Add `flexWrap: "wrap"` or `rowGap: 8` and move "View file" to its own line if the container is narrow.

#### C. Touch targets
No issues found with the main nav items (padding `10px 12px` on `.agent-nav-item` = ~40px height, close to the 44px guideline). The "New sale" CTA button uses `.agent-btn-md` (height 40px) — marginally short of the 44px iOS guideline but acceptable.

#### D. Typography and inputs
No form inputs on this page.

#### E. Modals and popovers
No modals on this page.

#### F. iOS-specific
See SHELL-1 / SHELL-2.

#### Summary
- Findings: 0 critical, 2 high (HUB-1, HUB-3), 1 medium (HUB-2), 0 low
- Estimated fix effort: Small (HUB-1: add flex-wrap; HUB-2: add hub-stats-grid class to ghost card)
- Priority: Yes — Hub is the primary landing page

---

### 2. Reminders / Work Queue (`/agent/work-queue`)

#### B. Layout issues

**WQ-1** [HIGH] — Page body content padding `px-8 py-7` has no mobile fallback

- File: `app/agent/work-queue/page.tsx` line 97
- Breakpoints affected: 375, 390, 414
- Description: `<div className="px-8 py-7 space-y-6">` applies `padding-left: 32px; padding-right: 32px` at all breakpoints. The CSS override class `reminders-page-pad` exists in `globals.css` and sets `padding: 16px 16px !important` — but this class is not applied here. The class `reminders-page-pad` is defined but never referenced in the page markup. As a result, the work queue body has 32px horizontal padding at 375px, leaving only ~311px of usable width.
- Impact: On a 375px phone, 64px of the 375px width is consumed by padding. Content is readable but narrow. The `FileAlertsStrip` and reminder cards are already quite information-dense.
- Recommended fix direction: Either add `reminders-page-pad` class to this div, or replace `px-8 py-7` with `px-4 md:px-8 py-5 md:py-7`.

**WQ-2** [MEDIUM] — Header padding not responsive (same pattern as HUB-1)

- File: `app/agent/work-queue/page.tsx` line 72
- Breakpoints affected: 375, 390, 414
- Description: The header div uses inline style `padding: "24px 32px 28px"`. Unlike the Hub, there is no CSS class with an `!important` override targeting this element for mobile. The 32px horizontal padding will apply on mobile.
- Impact: The header is a decorative / informational area so usability is not critically impacted, but combined with WQ-1 the overall layout feels compressed on mobile.
- Recommended fix direction: Replace inline padding with a CSS class or responsive Tailwind classes (`px-4 md:px-8`).

#### C. Touch targets
Reminder action buttons are handled by `.reminder-action-btn` with a mobile override to `minWidth: 40px, minHeight: 40px, padding: 8px` — this is correct and close to the 44px guideline.

#### D. Typography and inputs
No form inputs in the page shell. ReminderCard action buttons: the `reminder-btn-label` span is hidden on mobile and the buttons collapse to icon-only — appropriate.

#### E. Modals and popovers

**WQ-3** [MEDIUM] — Snooze and kebab dropdowns open `bottom-full` (upwards) which may clip at top of screen

- File: `components/reminders/ReminderCard.tsx` lines 122, 167
- Breakpoints affected: 375, 390, 414
- Description: `SnoozeDropdown` and `KebabMenu` use `className="absolute right-0 bottom-full mb-1 z-30"` to open upwards. On mobile, if a reminder card is near the top of the visible viewport (e.g., the first card after opening the page), opening the dropdown will render it above the card, potentially behind the sticky header (which has `z-20` in `PropertyFileTabs`, or the mobile top bar which has `z-index: 50` in `.agent-mobile-header`). The dropdown's `z-30` should clear the header's `z-50` on the work queue page (no tabs header on work queue), but on a short mobile viewport the dropdown content may be clipped by the top of the viewport if the card is near the top.
- Impact: Dropdown may be partially off-screen for the first one or two reminder cards. **Confidence: MEDIUM** — depends on scroll position and card density.
- Recommended fix direction: Use a portal-based dropdown, or detect if there is insufficient space above and flip to `top-full`.

#### Summary
- Findings: 0 critical, 1 high (WQ-1), 2 medium (WQ-2, WQ-3), 0 low
- Estimated fix effort: Small (WQ-1: one class change; WQ-2: padding class)
- Priority: Yes — Reminders is a primary daily-use page

---

### 3. Completions (`/agent/completions`)

#### B. Layout issues

**COMP-1** [MEDIUM] — Header padding not responsive (same pattern as WQ-2)

- File: `app/agent/completions/page.tsx` line 106
- Breakpoints affected: 375, 390, 414
- Description: Inline style `padding: "24px 32px 28px"` applies to the header with no responsive override. The flex row `display: "flex", alignItems: "flex-end", justifyContent: "space-between"` in the header uses `gap: 16` with no wrapping fallback. The left side (heading + subtitle) and right side (filters) will fight for space on narrow screens. However, there is no right-side action button on this page's header, so the issue is less severe.
- Impact: Minor — the header subtitle text will wrap naturally. Low usability impact.
- Recommended fix direction: Add `px-4 md:px-8` to the inner container.

#### B (continued) — Body layout

The body uses `className="px-4 md:px-8 py-5 md:py-7 space-y-7"` — this is correct and mobile-aware. The Completions page has the most thorough mobile handling of all pages audited, with explicit `hidden md:flex` / `flex md:hidden` dual layouts for each completion card.

#### D. Typography and inputs
No form inputs on this page.

#### Summary
- Findings: 0 critical, 0 high, 1 medium (COMP-1), 0 low
- Estimated fix effort: Small
- Priority: Conditional — completions is a reference page, not a daily action surface

---

### 4. To-Do (`/agent/to-do`)

#### B. Layout issues

**TODO-1** [HIGH] — Page body padding `px-4 md:px-8 py-5 md:py-7` is correct but the container has `maxWidth: 680` without centering

- File: `app/agent/to-do/page.tsx` line 63
- Breakpoints affected: 375, 390, 414, 768
- Description: `<div className="px-4 md:px-8 py-5 md:py-7" style={{ maxWidth: 680 }}>` — the padding is correctly responsive, but `maxWidth: 680` with no `margin: "0 auto"` means the content is left-aligned and will use the full width on mobile (which is fine), but on tablet (768px) where `px-8` kicks in, the max-width of 680 combined with 64px of padding means the content box is `680 - 64 = 616px` wide but the overall block does not centre. This is a minor layout concern but not a blocking mobile issue. More importantly, the header still uses `padding: "24px 32px 28px"` (same WQ-2 pattern).
- Impact: Header padding on mobile is 32px — see WQ-2 pattern. Content body padding is correct.
- Recommended fix direction: Fix header padding; the body is acceptable.

**TODO-2** [MEDIUM] — Header padding not responsive

- File: `app/agent/to-do/page.tsx` line 38
- Breakpoints affected: 375, 390, 414
- Description: Inline style `padding: "24px 32px 28px"` — same pattern as WQ-2/COMP-1.
- Impact: 64px of horizontal space consumed in the header on mobile.
- Recommended fix direction: Use `px-4 md:px-8`.

#### D. Typography and inputs
The `AgentTodoList` component renders `AddManualTaskForm`. Without reading that full component: any `<input>` using `text-sm` (14px) on a form will trigger iOS Safari auto-zoom. This is flagged as a conditional risk — see cross-cutting finding FORM-ZOOM below.

#### Summary
- Findings: 0 critical, 1 high (TODO-1/TODO-2 combined), 1 medium, 0 low
- Estimated fix effort: Small
- Priority: Yes — daily action page

---

### 5. Updates / Comms (`/agent/comms`)

#### B. Layout issues

**COMMS-1** [HIGH] — Header filter tab row will overflow on 375px

- File: `app/agent/comms/page.tsx` lines 76–109
- Breakpoints affected: 375, 390
- Description: The header row uses `display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16`. The left side contains the "Agent Portal" eyebrow, heading, and subtitle. The right side contains the filter tab strip (`display: "flex", gap: 4, background, borderRadius, padding: 3`) with two link-tabs ("All milestones" and "Portal confirmations"). At 375px with 32px horizontal padding (same inline padding issue), the usable width is ~311px. The tab strip with two tabs at ~55px each plus gap = ~114px minimum. Combined with the left text block, the flex row will wrap or overflow. There is no `flexWrap: "wrap"` and no responsive breakpoint on this flex row.
- Impact: On 375px, either the heading text is truncated or the filter tabs are pushed out of the visible area. The filter is required for the portal-only view, making this a functional issue if tabs are inaccessible.
- Recommended fix direction: Wrap this flex row with `flexWrap: "wrap"` and `gap`, or move the filter tabs below the heading on mobile.

**COMMS-2** [MEDIUM] — Body content uses `px-8 py-7` with no mobile fallback

- File: `app/agent/comms/page.tsx` line 114
- Breakpoints affected: 375, 390, 414
- Description: Same `px-8 py-7` pattern as WQ-1. No responsive override exists for this page's body padding.
- Impact: 64px of padding consumed at mobile; the feed of milestone activity cards is narrowed significantly.
- Recommended fix direction: Change to `px-4 md:px-8 py-5 md:py-7`.

#### Summary
- Findings: 0 critical, 1 high (COMMS-1), 1 medium (COMMS-2), 0 low
- Estimated fix effort: Small
- Priority: Yes — filter tab accessibility is a functional issue

---

### 6. All Files / Dashboard (`/agent/dashboard`)

#### B. Layout issues

**DASH-1** [HIGH] — Body content uses `px-8 py-7 space-y-7` with no mobile fallback

- File: `app/agent/dashboard/page.tsx` line 89
- Breakpoints affected: 375, 390, 414
- Description: Same pattern as WQ-1 / COMMS-2. The body wrapper has `px-8 py-7` at all breakpoints.
- Impact: The filter tab row, forecast strip, and transaction list all get 32px padding on each side at mobile. The `TransactionTable` component does have a mobile card layout (see `flex md:hidden`), so the table itself is mobile-friendly. But the surrounding container padding is excessive.
- Recommended fix direction: `px-4 md:px-8 py-5 md:py-7`.

**DASH-2** [MEDIUM] — Filter chip dropdowns are `absolute` positioned and may clip

- File: `components/transactions/TransactionListWithSearch.tsx` lines 65, 114, 180
- Breakpoints affected: 375, 390, 414
- Description: `AssignedToChip`, `RiskChip`, and `ManagedByChip` each render an `absolute top-full left-0 z-30` dropdown. On mobile where the filter row is within a horizontal scroll container (`overflow-x-auto` on the wrapping `div.glass-subtle`), the `position: absolute` child will be clipped by the `overflow-x-auto` container boundary. The chips may be partially visible, but their dropdown panels will be cut off.
- Impact: Filter dropdowns may not render completely on mobile if the parent is an overflow container. **Confidence: MEDIUM** — depends on whether `overflow-x-auto` clips `position: absolute` descendants (it does in CSS, but only in the overflow axis; the `top-full` positioning is in the block axis so it should not be clipped by horizontal overflow. However, if the container also has `overflow: hidden` on the block axis, it will clip). The `glass-subtle` class does not set `overflow: hidden`. Low risk of actual clipping but worth verifying.
- Recommended fix direction: Verify on a real device. If clipping occurs, render dropdowns via `createPortal` or increase the parent container's z-context.

#### Summary
- Findings: 0 critical, 1 high (DASH-1), 1 medium (DASH-2), 0 low
- Estimated fix effort: Small (DASH-1); Medium (DASH-2 if confirmed)
- Priority: Yes — primary file management page

---

### 7. Analytics (`/agent/analytics`)

#### A. Shell + header
The Analytics page header is the most mobile-aware in the codebase: `className="agent-glass-strong px-4 pt-[18px] pb-[22px] sm:px-8 sm:pt-[22px] sm:pb-[26px]"` — correctly uses responsive padding. The header row uses Tailwind responsive flex: `className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"` — correct.

#### B. Layout issues

**ANAL-1** [MEDIUM] — Solicitor exchange performance list: fixed-width text and right-aligned badges on narrow screens

- File: `app/agent/analytics/page.tsx` lines 534–546
- Breakpoints affected: 375, 390
- Description: Each solicitor row uses `display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px"`. The row contains: firm name (`flex: 1`, truncated), exchange count (`flexShrink: 0`), days (`minWidth: 64, textAlign: "right"`), and a speed badge (`flexShrink: 0`). On a 375px screen with 8px horizontal padding (the body uses `px-4`), this row is ~343px wide. With 4 flex items and minimal padding, each item has approximately 80–90px, which should be workable. **Confidence: MEDIUM** — the firm name truncates correctly. Minor concern only.
- Impact: Slightly cramped but functional.
- Recommended fix direction: Consider a 2-line mobile layout for this row if real-device testing shows compression.

**ANAL-2** [LOW] — Analytics body uses `px-4 py-5 sm:px-8` — correct, but the period tab bar `overflowX: "auto"` doesn't show scroll indicators on iOS

- File: `app/agent/analytics/page.tsx` lines 394, 397
- Breakpoints affected: 375, 390, 414
- Description: `scrollbarWidth: "none"` hides the scrollbar in the period tab row. On mobile, this is standard practice for horizontally scrollable chips. The tab bar supports touch scrolling via `WebkitOverflowScrolling: "touch"`. No issue — this is correct implementation. Noted to confirm no concerns.
- Impact: None.

#### C. Touch targets
Period tab links use `padding: "9px 14px"` which is approximately 37px tall. Below the 44px guideline but common for chip/pill navigation. Acceptable given the `flexShrink: 0` and adequate horizontal spacing.

#### D. Typography
The `StatCard` inner component renders `fontSize: 26` values — readable on mobile. No input elements on this page that could trigger iOS zoom.

#### Summary
- Findings: 0 critical, 0 high, 1 medium (ANAL-1), 1 low (ANAL-2 — no action needed)
- Estimated fix effort: Small or None
- Priority: No (analytics is a review page, not daily use on mobile)

---

### 8. Solicitors (`/agent/solicitors`)

#### B. Layout issues

**SOL-1** [HIGH] — Header stats chips (`firms` / `contacts`) in a right-aligned flex may overflow on small screens

- File: `app/agent/solicitors/page.tsx` lines 51–68
- Breakpoints affected: 375, 390
- Description: The header inner div uses inline style `display: "flex", alignItems: "flex-start", justifyContent: "space-between"`. The right side contains `<div style={{ display: "flex", alignItems: "center", gap: 28, flexShrink: 0, marginTop: 8 }}>` with two `StatChip` components. The left side is the page title block. At 375px with 32px horizontal padding, available width is ~311px. The right-side stat chips at `flexShrink: 0` will hold their space (~100px at minimum). If the firm name displayed in the `agent-eyebrow` or the "Solicitors" h1 title is longer, the heading block will be squeezed. The heading "Solicitors" is short enough, but `{session.user.firmName ?? "Agent Portal"}` in the eyebrow could be long. No wrapping fallback exists.
- Impact: On a 375px screen with a long firm name, the eyebrow text may overflow into the stat chips, or the chips may be hidden.
- Recommended fix direction: Add `flexWrap: "wrap"` to the header flex row, or hide the stat chips and show them in the body on mobile.

**SOL-2** [MEDIUM] — Body content uses `px-8 py-7 space-y-4` with no mobile fallback

- File: `app/agent/solicitors/page.tsx` line 71
- Breakpoints affected: 375, 390, 414
- Description: Same `px-8 py-7` pattern (WQ-1, DASH-1, COMMS-2).
- Impact: 32px padding on each side. The `FirmCard` contact info uses `flexWrap: "wrap"` for the email/phone row — that is handled. The file chips use `maxWidth: 200` with truncation, which is fine on mobile.
- Recommended fix direction: `px-4 md:px-8 py-5 md:py-7`.

**SOL-3** [HIGH] — `RecommendedSolicitorsSettings` component (directors only) not read — flagged as unknown risk

- File: `components/agent/RecommendedSolicitorsSettings.tsx`
- Description: This component was not read in full during this audit. Given it is a settings panel with form inputs and toggles, there is risk of non-responsive layout or sub-16px inputs. Flagged for follow-up.
- Impact: Unknown without reading the component.
- Recommended fix direction: Audit this component separately.

#### Summary
- Findings: 0 critical, 2 high (SOL-1, SOL-3), 1 medium (SOL-2), 0 low
- Estimated fix effort: Small–Medium
- Priority: Conditional — solicitors is a reference page, not a primary daily action

---

### 9. Settings (`/agent/settings`)

#### B. Layout issues

**SET-1** [CRITICAL] — Two-column settings grid (`58fr 42fr`) has no mobile fallback

- File: `app/agent/settings/page.tsx` line 44
- Breakpoints affected: 375, 390, 414
- Description: `<div style={{ display: "grid", gridTemplateColumns: "58fr 42fr", gap: 20, alignItems: "start" }}>` creates a two-column layout with no responsive breakpoint. On a 375px screen with `px-8 py-7` body padding (64px total), usable width is ~311px. The two columns will be approximately 178px and 128px wide respectively. Both columns contain `glass-card` panels with forms: "My profile" (three inputs: name, email, phone side by side) and "Sending addresses" (form content not fully audited). At 128px wide, the "Sending addresses" panel will be barely functional — content will overflow or be severely cramped.
- Impact: The Settings page is likely broken at 375px — the two columns render at widths where form inputs are unusable. The profile form's `gridTemplateColumns: "1fr 1fr 1fr"` (3-column name/email/phone row) inside a 178px panel will collapse each input to ~55px wide, which is unusable.
- Recommended fix direction: Wrap the outer grid with a responsive Tailwind class: `grid-cols-1 md:grid-cols-[58fr_42fr]` and remove the inline style. Similarly fix the profile form's inner 3-column grid.

**SET-2** [CRITICAL] — Profile form 3-column grid has no mobile fallback

- File: `components/agent/ProfileForm.tsx` line 52
- Breakpoints affected: 375, 390, 414
- Description: `<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>` renders name, email, and phone inputs in 3 columns. Already cramped inside the full-width card on desktop, this will be completely unusable inside the narrower Settings column on mobile. Even if SET-1 is fixed (card becomes full-width), a 375px card with 32px horizontal padding = ~311px for 3 columns = ~97px per input. This is borderline but the `text-sm` (14px) inputs would trigger iOS Safari zoom (see SET-3).
- Impact: Three input fields in a ~300px panel, each ~97px wide — usable but very cramped. With iOS zoom triggering on focus, the viewport jumps unpredictably.
- Recommended fix direction: Use `grid-cols-1 sm:grid-cols-3` for the profile field row.

**SET-3** [HIGH] — Profile form inputs use `text-sm` (14px), triggering iOS Safari zoom on focus

- File: `components/agent/ProfileForm.tsx` line 7 (`FIELD` constant) and line 55 (input usage)
- Breakpoints affected: 375, 390, 414 (iOS Safari)
- Description: `FIELD` includes `text-sm` which maps to `font-size: 14px`. iOS Safari auto-zooms the viewport when an input receives focus with `font-size < 16px`. This causes the page to zoom in, disrupting the layout. The minimum safe font size for inputs on iOS is 16px (`text-base` in Tailwind).
- Impact: Every time a user taps a name, email, or phone field in Settings, the iOS viewport zooms in. This is a significant friction point for form completion on iPhone.
- Recommended fix direction: Change `text-sm` to `text-base` in the `FIELD` constant, or add `style={{ fontSize: 16 }}` to the inputs. Also consider adding `touch-action: manipulation` to prevent double-tap zoom.

**SET-4** [HIGH] — Body padding `px-8 py-7` has no mobile fallback

- File: `app/agent/settings/page.tsx` line 41
- Breakpoints affected: 375, 390, 414
- Description: Same WQ-1 / DASH-1 pattern.
- Impact: Compounds SET-1 — combined with the two-column grid, the actual usable content width on 375px is very narrow.
- Recommended fix direction: `px-4 md:px-8 py-5 md:py-7`.

#### Summary
- Findings: 2 critical (SET-1, SET-2), 2 high (SET-3, SET-4), 0 medium, 0 low
- Estimated fix effort: Medium (grid fixes are straightforward; the iOS zoom fix is a one-line change)
- Priority: Yes — Settings is critical for account management

---

### 10. New Sale Flow (`/agent/transactions/new`)

#### B. Layout issues

**NEW-1** [HIGH] — Page body uses `px-8 py-7` with no mobile fallback

- File: `app/agent/transactions/new/page.tsx` line 62
- Breakpoints affected: 375, 390, 414
- Description: Same pattern as WQ-1/DASH-1. The `NewTransactionForm` is a multi-step form — the primary action on this entire agent portal. Having 64px of padding consumed on a 375px screen is significant.
- Impact: The form is significantly narrowed on mobile. Combined with form-level layout issues (see NEW-2), the new sale flow may be cramped.
- Recommended fix direction: `px-4 md:px-8 py-5 md:py-7`.

**NEW-2** [HIGH] — Form inputs use `text-sm` (14px), triggering iOS Safari zoom

- File: `components/transactions/NewTransactionForm.tsx` lines 962, 978, 992, 1115, 1141
- Breakpoints affected: 375, 390, 414 (iOS Safari)
- Description: Multiple `<input>` and `<textarea>` elements use `className="glass-input w-full px-3 py-2.5 text-sm"`. The `glass-input` CSS class sets `font-size: var(--agent-text-body)` which is `14px` (from agent-system.css line 106). `text-sm` in Tailwind is also 14px. iOS Safari will zoom the viewport on focus for any input with font-size < 16px.
- Impact: Every form field in the most important data-entry flow triggers iOS zoom. This is a high-friction experience on iPhone, making the new sale form difficult to complete on mobile.
- Recommended fix direction: Override font-size on all `<input>`, `<select>`, and `<textarea>` elements to 16px minimum. Options: add `style={{ fontSize: 16 }}` to each input, or update the `.agent-input` CSS class to `font-size: max(16px, var(--agent-text-body))`.

**NEW-3** [MEDIUM] — Tenure/purchase type selection buttons may be cramped on 375px

- File: `components/transactions/NewTransactionForm.tsx` lines 1017, 1043
- Breakpoints affected: 375, 390
- Description: Tenure buttons (`flex-1 py-3.5 rounded-xl border-2 text-sm`) in a flex row. With `px-8` body padding (or even with `px-4` after fix), two buttons sharing the width minus padding may be tight for the text "Cash from Proceeds" in the purchase type row. `flex-wrap` is not set on the button group.
- Impact: Longest option "Cash from Proceeds" could be squeezed; text may wrap within the button causing height inconsistency.
- Recommended fix direction: Add `flex-wrap: wrap` to the button group or verify at 375px.

#### D. Typography and inputs
See NEW-2 above. Inputs render at 14px, triggering iOS zoom.

#### Summary
- Findings: 0 critical, 2 high (NEW-1, NEW-2), 1 medium (NEW-3), 0 low
- Estimated fix effort: Small (padding fix) to Medium (systematic input font-size fix)
- Priority: Yes — this is the primary data entry flow

---

### 11. Property File Detail (`/agent/transactions/[id]`)

#### B. Layout issues

**PROP-1** [CRITICAL] — `PropertyFileTabs` sidebar is `w-72` (288px) with no mobile fallback — sidebar never hides on mobile

- File: `components/transaction/PropertyFileTabs.tsx` lines 77, 94
- Breakpoints affected: 375, 390, 414, 768
- Description: `<div className="px-8 py-7 flex gap-7 items-start">` contains two children: the tab content (`flex-1 min-w-0`) and the sidebar (`w-72 flex-shrink-0 sticky top-[53px]`). The `flex-shrink-0` prevents the sidebar from shrinking, and `w-72` (288px) is a fixed width. On a 375px device with 64px padding (`px-8`), the usable flex area is ~311px. The sidebar alone wants 288px, leaving only ~11px for the main content. There is no `hidden md:block` or responsive breakpoint on the sidebar. The `flex gap-7` adds another 28px (7×4px) gap. The main content area would be approximately 311 - 288 - 28 = -5px, meaning the layout is completely broken at mobile breakpoints.
- Impact: **CRITICAL** — The property file detail page is fundamentally broken on mobile. The tab content is squeezed to near-zero width or overflows the viewport. This is the most important page in the agent portal for day-to-day use.
- Recommended fix direction: Hide the sidebar on mobile (`hidden md:block`), and surface the sidebar content either as a collapsible section within the tab content area or as a separate tab on mobile.

**PROP-2** [CRITICAL] — Tab bar uses `px-8 py-2.5` with no mobile fallback; tabs may overflow on 375px

- File: `components/transaction/PropertyFileTabs.tsx` lines 47–74
- Breakpoints affected: 375, 390, 414
- Description: The sticky tab bar renders 5 tabs (Overview, Milestones, Reminders, To-Do, Activity) in a `px-8 py-2.5 flex items-center gap-1` row. At 375px with 64px total padding, 311px must accommodate 5 tab buttons. Each tab button has `px-4 py-2` plus label text (longest: "Milestones" ~85px, "Reminders" ~80px). Five tabs × ~85px = ~425px, exceeding the 311px available. No `overflow-x-auto` is applied to the tab bar — tabs will overflow and clip outside the viewport, making "Activity" and possibly "To-Do" inaccessible.
- Impact: **CRITICAL** — Multiple tabs may be completely unreachable on mobile. Combined with PROP-1, the property file detail page is non-functional on small phones.
- Recommended fix direction: Add `overflow-x-auto` and `scrollbar-width: none` to the tab bar, or reduce tab label length on mobile (use abbreviations or icon-only tabs), or restructure to a two-row layout at mobile.

**PROP-3** [HIGH] — Overview tab MetaField grid uses `gridTemplateColumns: "130px 160px 1fr"` with no mobile fallback

- File: `app/agent/transactions/[id]/page.tsx` lines 255–276
- Breakpoints affected: 375, 390, 414
- Description: `<div className="grid divide-x divide-white/20" style={{ gridTemplateColumns: "130px 160px 1fr" }}>` creates a 3-column metadata row (Status, Assigned to, Last progress). The first two columns are fixed at 130px and 160px, totalling 290px minimum before the third column. At 375px with `px-8` body padding (after removing sidebar width from PROP-1 fix), the available width inside the card is ~311px. 130 + 160 = 290px leaves only 21px for the "Last progress" column which contains multi-line text.
- Impact: The "Last progress" text will be severely truncated or completely invisible. **High** regardless of PROP-1 fix.
- Recommended fix direction: Change to `grid-cols-1` on mobile: `className="grid sm:divide-x divide-white/20"` with `style={{ gridTemplateColumns: "1fr" }}` at mobile.

**PROP-4** [HIGH] — Overview tab `grid grid-cols-2 gap-5` sections have no mobile fallback

- File: `app/agent/transactions/[id]/page.tsx` lines 278, 312, 317
- Breakpoints affected: 375, 390, 414
- Description: Three separate `<div className="grid grid-cols-2 gap-5">` blocks render contacts/solicitors, reminders/activity, and risk/chain widget pairs. On mobile (after PROP-1 sidebar fix), the content area would be full-width. Two-column grids with `gap-5` (20px) at 375px would give each column ~147px — very narrow for components that contain form fields, action buttons, and data. No responsive breakpoint (`sm:grid-cols-2`) is present.
- Impact: The Contacts, Solicitors, Reminders, Activity, Risk Score, and Chain widgets are all rendered in narrow two-column grids. Several of these widgets contain editable fields, milestone data, and interactive buttons that will be very cramped at ~147px wide.
- Recommended fix direction: Change each `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` or `grid-cols-1 md:grid-cols-2`.

**PROP-5** [HIGH] — PropertyHero breadcrumb row may overflow on narrow screens

- File: `components/transaction/PropertyHero.tsx` lines 100–113
- Breakpoints affected: 375, 390
- Description: The hero breadcrumb/status row uses `display: "flex", alignItems: "center", justifyContent: "space-between"`. The left side has breadcrumb links with a "My Files" back link and agency name; the right side has `flagSlot` and a status badge. At 375px with 32px total padding (`padding: "20px 32px 26px"`), the usable breadcrumb area is ~311px. The left side (chevron icon + "My Files" + separator dot + agency name) uses wrapping `<div>` with `gap: 12` between items. The agency name can be long. If the agency name causes the left side to grow, the status badge on the right has no shrink allowance — it may overflow.
- Impact: Status badge or agency name text may be clipped on 375px with a long agency name. **Confidence: MEDIUM**.
- Recommended fix direction: Add `flexWrap: "wrap"` to the breadcrumb row or truncate the agency name with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px`.

**PROP-6** [HIGH] — Hero bottom row `flexShrink: 0` on the exchange/progress block causes compression

- File: `components/transaction/PropertyHero.tsx` lines 159–186
- Breakpoints affected: 375, 390, 414
- Description: The hero bottom row (`display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap"`) contains the price/pills on the left and a `flexShrink: 0` block (`display: "flex", alignItems: "flex-end", gap: 28`) on the right containing the Exchange countdown and Progress bar (`minWidth: 150`). The `flexWrap: "wrap"` on the outer row means these will wrap to a new line on mobile — which is correct. However, the progress bar has `minWidth: 150` which may prevent it from fitting in the second line if the exchange countdown is also present (exchange + progress = 150 + 28gap + ~60 = ~238px minimum). At 375px with 32px padding this should fit in the ~311px available. The wrapping handles this reasonably well.
- Impact: Low on most screens; the wrapping is already in place.

**PROP-7** [HIGH] — `TransactionSidebar` contains `<input type="date">` and `<select>` elements with `text-sm` / `text-xs` triggering iOS zoom

- File: `components/transaction/TransactionSidebar.tsx` lines 244, 249, 280, 455, 459, 519
- Breakpoints affected: 375, 390, 414 (iOS Safari)
- Description: The sidebar contains `<input type="date" className="glass-input px-2 py-1 text-sm">` and `<select className="glass-input w-full px-2 py-1 text-xs">` / `<select className="glass-input w-full px-2 py-1 text-xs">`. `.glass-input` has no explicit font-size override in globals.css (the CSS variable `--agent-text-body` is 14px). `text-sm` = 14px and `text-xs` = 12px both trigger iOS auto-zoom. While the sidebar is hidden behind PROP-1 being critical, these inputs would still trigger zoom once the sidebar issue is resolved.
- Impact: iOS zoom triggered by date pickers and selects in the sidebar.
- Recommended fix direction: Set `font-size: 16px` on all inline-edited inputs in the sidebar.

#### E. Modals and popovers
None directly on this page.

#### F. iOS-specific
See PROP-7. The `PropertyFileTabs` sticky tab bar uses `position: sticky` at `top: 0` on the tab bar, and the sidebar uses `sticky top-[53px]`. Once PROP-1 is fixed (sidebar hidden on mobile), `sticky top-[53px]` remains correct only if the tab bar is 53px tall; this should be verified.

#### Summary
- Findings: 2 critical (PROP-1, PROP-2), 5 high (PROP-3, PROP-4, PROP-5, PROP-6, PROP-7), 0 medium, 0 low
- Estimated fix effort: Large (PROP-1 requires sidebar redesign; PROP-2 requires tab bar refactor)
- Priority: Yes — highest priority page in the portal

---

## Cross-cutting findings

**CC-1** [HIGH] — Page header `padding: "24px 32px 28px"` inline style is used on 8 out of 11 pages with no responsive override

- Files: `app/agent/work-queue/page.tsx:72`, `app/agent/completions/page.tsx:106`, `app/agent/to-do/page.tsx:38`, `app/agent/comms/page.tsx:66`, `app/agent/dashboard/page.tsx:67`, `app/agent/solicitors/page.tsx:51`, `app/agent/settings/page.tsx:34`, `app/agent/transactions/new/page.tsx:55`
- Description: Every page shares an identical header section with `padding: "24px 32px 28px"` as an inline style. This pattern applies 32px horizontal padding on mobile screens where 16px is more appropriate. Because it is an inline style, it cannot be overridden by a CSS class without `!important`. The Hub page demonstrates the intended fix with `hub-header-pad` class + `!important` in the CSS — this works but is fragile.
- Recommended fix direction: Extract the page header into a shared `<AgentPageHeader>` component with responsive padding (`px-4 md:px-8`), eliminating the copy-paste pattern across 8 pages.

**CC-2** [HIGH] — Body content `px-8 py-7` with no mobile fallback appears on 5 out of 11 pages

- Files: `app/agent/work-queue/page.tsx:97`, `app/agent/comms/page.tsx:114`, `app/agent/dashboard/page.tsx:89`, `app/agent/solicitors/page.tsx:71`, `app/agent/settings/page.tsx:41`, `app/agent/transactions/new/page.tsx:62`
- Description: A shared `className="px-8 py-7 ..."` body wrapper without mobile-responsive alternatives. Should be `px-4 md:px-8 py-5 md:py-7`.
- Recommended fix direction: Global search-and-replace of `px-8 py-7` in agent pages, replacing with `px-4 md:px-8 py-5 md:py-7`.

**CC-3 (FORM-ZOOM)** [HIGH] — Form inputs using `text-sm` (14px) trigger iOS Safari viewport zoom

- Files: `components/agent/ProfileForm.tsx:7`, `components/transactions/NewTransactionForm.tsx:962,978,992,1115,1141`, `components/transaction/TransactionSidebar.tsx:244,249,280,455,459,519`
- Description: iOS Safari auto-zooms the viewport when any `<input>`, `<select>`, or `<textarea>` receives focus with a computed `font-size` below 16px. Multiple components use `text-sm` (14px) or `text-xs` (12px) on form inputs. The `.agent-input` class sets `font-size: var(--agent-text-body)` = 14px, which propagates to all inputs using that class.
- Recommended fix direction: Add `font-size: max(16px, var(--agent-text-body))` to `.agent-input`, `.agent-textarea`, and `.glass-input` in their respective CSS definitions. This is a one-line fix that cures the zoom problem globally.
- **Stage 2 postmortem (2026-04-27):** The original CC-3 fix added `font-size: 16px` to `.glass-input` inside `@layer components` in `globals.css`. This was nullified by CSS layer precedence: `@layer utilities` (where Tailwind's `text-sm`/`text-xs` live) takes precedence over `@layer components`, so the glass-input font-size was always overridden. The `.agent-input` and `.agent-textarea` definitions in `agent-system.css` are plain CSS (no `@layer`) and were already effective. Corrected in Stage 2 Section 4 by adding unlayered override rules for all three classes outside any `@layer` block in `globals.css`.

**CC-4** [MEDIUM] — Absolute-positioned dropdown popovers throughout (filter chips, snooze, kebab) are not converted to bottom-sheets on mobile

- Files: `components/transactions/TransactionListWithSearch.tsx:65,114,180`, `components/reminders/ReminderCard.tsx:122,167`
- Description: Popovers open as small `position: absolute` panels positioned relative to their trigger button. On mobile, these small panels are appropriate UX when they don't clip. However, none convert to full-width bottom-sheets, which is the iOS/Android native pattern. This is a polish issue rather than a blocking one — the dropdowns function correctly.
- Recommended fix direction: Acceptable as-is for v1 mobile. Consider bottom-sheet conversion in a future polish pass.

---

## Priority recommendations

### Stage 1 — Shell fixes (fix once, all pages benefit)

1. **SHELL-1 / SHELL-2** — Replace `height: "100vh"` and `minHeight: "100vh"` in `AgentShell.tsx` with `100dvh` equivalents.
2. **CC-1** — Extract page header into a shared `<AgentPageHeader>` component with `px-4 md:px-8` responsive padding.
3. **CC-2** — Replace all `px-8 py-7` body wrappers in agent pages with `px-4 md:px-8 py-5 md:py-7`.
4. **CC-3 (FORM-ZOOM)** — Add `font-size: max(16px, var(--agent-text-body))` to `.agent-input`, `.agent-textarea`, `.glass-input` CSS classes.

### Stage 2 — Property file detail (highest-impact page fixes)

5. **PROP-1** — Hide sidebar on mobile in `PropertyFileTabs.tsx`; restructure to show sidebar content on mobile (collapsible or new tab).
6. **PROP-2** — Add `overflow-x-auto scrollbar-hide` to the tab bar in `PropertyFileTabs.tsx`.
7. **PROP-3** — Replace `gridTemplateColumns: "130px 160px 1fr"` MetaField grid with responsive single-column layout on mobile.
8. **PROP-4** — Change `grid grid-cols-2` blocks to `grid grid-cols-1 sm:grid-cols-2` in the property file overview.

### Stage 3 — Page-level fix order (by daily use frequency)

9. **SET-1 / SET-2** — Fix Settings two-column and three-column grids (CRITICAL — unusable currently).
10. **COMMS-1** — Fix filter tab overflow in Updates page header.
11. **HUB-1** — Add flex-wrap to Hub header row.
12. **NEW-1 / NEW-2** — Fix New Sale body padding and input font sizes (iOS zoom).
13. **WQ-1** — Add `reminders-page-pad` class or use responsive padding on Work Queue body.
14. **DASH-1** — Fix Dashboard body padding.
15. **SOL-1** — Fix Solicitors header flex overflow.

---

## Pages with no critical or high findings

- **Completions** (`/agent/completions`) — Has the most thorough mobile implementation in the codebase; dual desktop/mobile card layouts, responsive body padding. Only finding is header padding (MEDIUM).
- **Analytics** (`/agent/analytics`) — Header is already fully responsive with Tailwind breakpoint classes; body uses `px-4 sm:px-8`. Only minor concern (MEDIUM) on the solicitor performance row.

---

## Methodology notes

- This audit is based entirely on static code inspection. No live browser emulation, device simulation, or accessibility tooling (axe, Lighthouse) was run.
- Confidence is HIGH for layout issues that are provably geometric (e.g., a fixed-width sidebar wider than the viewport minus padding). Confidence is MEDIUM for issues that depend on runtime content length or scroll position.
- Tailwind breakpoint `sm:` = 640px, `md:` = 768px in default config (assumed, not verified against `tailwind.config.js` — should be confirmed).
- The `agent-system.css` file imports in `app/agent/layout.tsx` as a plain CSS file, not within `@layer`, meaning its rules have higher specificity than layered Tailwind utilities. This is relevant for any utility-class fixes attempted on elements that already have matching plain-CSS rules.
- The `@media (max-width: 767px)` breakpoint in `globals.css` covers mobile responsive overrides for the shell and hub layout. This is slightly inconsistent with Tailwind's `md:` breakpoint (768px) — the media query fires up to and including 767px which matches correctly.
- `RecommendedSolicitorsSettings` component (`components/agent/RecommendedSolicitorsSettings.tsx`) was not fully read; findings related to it are marked with unknown confidence.
- Several findings reference content-length dependent behaviour; real-device testing should be used to confirm severity on populated data.

---

---

# Live Testing Supplement

## Methodology

- Tool: Playwright v1.59.1 with Chromium (`chrome-win64`) in headless mode
- User agent: iPhone iOS 17.0 Safari (mobile UA string) for 375px runs; desktop Chromium for 768px runs
- Viewports tested: 375×812, 768×1024
- Roles tested: Director (`alex@hartwellpartners.co.uk`) and Negotiator (`emily@hartwellpartners.co.uk`) — both accounts have ~10 live transactions with realistic data seeded
- Method: Full-page screenshots (`page.screenshot({ fullPage: true })`) after 2.5s settle on each page. Interactive behaviours (dropdown open/close, iOS keyboard zoom) cannot be captured in static screenshots; those findings are marked accordingly
- Screenshots location: `mobile_audit_screenshots/` in repo root (not committed)
- Each static-audit finding below is marked **CONFIRMED**, **REFUTED**, or **PARTIAL**

---

## Shell-level findings — live results

**SHELL-1** [HIGH] `height: 100vh` on sidebar — **PARTIAL**
The CSS override at `@media (max-width: 767px)` sets `position: fixed !important` on `.agent-sidebar-mobile`, which removes the sidebar from flex flow on mobile. Screenshots confirm the main content takes full viewport width at 375px — the sidebar does not consume layout space. However, the `100vh` value cannot be verified as broken from Chromium screenshots (this is an iOS Safari URL-bar-specific behaviour). The bug is real on real iOS devices; it just doesn't manifest in Chromium emulation. Finding stands as HIGH pending real-device testing.

**SHELL-2** [HIGH] `minHeight: 100vh` on root wrapper — **PARTIAL**
Same caveat as SHELL-1. Chromium screenshots show no gap artifact. iOS Safari real-device testing required to confirm/refute.

**SHELL-3** [MEDIUM] No `overflow-x: hidden` on body — **CONFIRMED, upgraded to HIGH**
Multiple pages at 375px produce extremely wide full-page screenshots (particularly `/agent/comms` and `/agent/dashboard`), indicating real horizontal overflow that a real user could accidentally trigger by swiping. The absence of `overflow-x: hidden` allows this bleed to be visible. Severity upgraded from MEDIUM to HIGH.

**SHELL-4** [LOW] Duplicate `AgentBell` in sidebar and mobile top bar — **CONFIRMED LOW**
Both instances render in the DOM simultaneously. No visual impact in screenshots; confirmed as low priority.

---

## Page-by-page live results

---

### 1. Hub (`/agent/hub`) — live results

**HUB-1** [HIGH] Header greeting + action buttons — **CONFIRMED**
At 375px, the action buttons ("Send note", "New sale") do not appear in the initial viewport alongside the greeting. The flex row wraps or the buttons are pushed below the greeting text. Content is functional but the header is cramped — the greeting "Good afternoon Alex" renders as a three-line wrap rather than a single line.

**HUB-2** [MEDIUM] Ghost empty-state stats grid — **N/A (not triggered)**
The hub had live data during testing (16+ reminder cards); the empty ghost state was not visible. Finding remains unconfirmed pending a fresh account test.

**HUB-3** [HIGH] Activity ribbon "View file" link — **PARTIAL**
The activity ribbon is visible at the bottom of the hub. At 375px, each row is tight but "View file →" is not visibly clipped in the screenshot. However, with long activity descriptions the layout could still fail — medium confidence this is borderline rather than actively broken. Retain as HIGH, lower to MEDIUM on next real-device pass with the longest real description strings.

---

### 2. Reminders / Work Queue (`/agent/work-queue`) — live results

**WQ-1** [HIGH] Body `px-8 py-7` no mobile fallback — **CONFIRMED**
At 375px, the reminder cards are visibly narrowed. The full-page screenshot shows a very tall, slim content column — all the expected reminder cards render but in very tight horizontal space.

**WQ-2** [HIGH] Header `padding: "24px 32px 28px"` inline — **CONFIRMED**
Consistent with the same pattern seen on all other pages.

**WQ-3** [MEDIUM] Snooze/kebab dropdowns may clip at top — **PARTIAL**
Interactive state not capturable in static screenshots. Finding stands; real-device interaction test recommended.

---

### 3. Completions (`/agent/completions`) — live results

**COMP-1** [MEDIUM] Header padding — **CONFIRMED MEDIUM**
The Completions heading is visible but the header has 32px inline horizontal padding at 375px, consistent with the static finding.

Body layout: **CONFIRMED best-in-class**. The dual `hidden md:flex` / `flex md:hidden` mobile card layouts are rendering correctly. Completion cards stack in a readable single-column format at 375px. This page remains the best mobile implementation in the codebase.

---

### 4. To-Do (`/agent/to-do`) — live results

**TODO-1/2** [HIGH] Header padding + body max-width — **CONFIRMED**
The "To-Do" heading and subtitle are visible but the header inline padding applies 32px on each side at 375px. The "Add to-do" button and empty state render correctly in the body.

**New finding during live test — see LT-1 below** (OnboardingChecklist overlay visible on this page).

---

### 5. Updates / Comms (`/agent/comms`) — live results

**COMMS-1** [HIGH → **CRITICAL**] Header filter tab overflow — **CONFIRMED, severity upgraded**
This is the most significant upgrade from the static audit. The full-page screenshot for `/agent/comms` at 375px is extremely wide — the page produces significant horizontal overflow. The flex row containing the "All milestones" / "Portal confirmations" filter tabs does not wrap, causing the entire page to have a large `scrollWidth`. On a real device this means:
1. The filter tabs may be partially or fully off-screen to the right
2. The entire page content shifts and the user must horizontal-scroll to reach the tabs
3. Horizontal scroll is not an expected mobile navigation pattern — most users will not discover the tabs

**COMMS-1 severity upgraded from HIGH to CRITICAL.** This is the primary daily review surface for agents tracking portal confirmations.

**COMMS-2** [MEDIUM] Body `px-8 py-7` — **CONFIRMED HIGH**
The body padding compounds the header overflow issue. Severity upgraded from MEDIUM to HIGH given the combined impact with COMMS-1.

---

### 6. All Files / Dashboard (`/agent/dashboard`) — live results

**DASH-1** [HIGH] Body `px-8 py-7` — **CONFIRMED**
At 375px, the transaction list cards are visibly narrow. The full-page screenshot is also wider than 375px, suggesting some horizontal overflow in the filter chip row or transaction row content.

**DASH-2** [MEDIUM] Filter chip dropdown clipping — **PARTIAL**
The filter chip row is visible in the screenshot. Whether dropdowns clip when opened is not testable from static screenshots. Retain as MEDIUM pending interaction test.

---

### 7. Analytics (`/agent/analytics`) — live results

**ANAL-1** [MEDIUM] Solicitor performance row cramped — **CONFIRMED MEDIUM**
The solicitor exchange performance list is visible at 375px. Firm names are truncated with `truncate`, and the exchange count + speed badge fit alongside. Functional but tight. Severity remains MEDIUM.

**ANAL-2** [LOW] Period tab scroll indicators — **REFUTED**
The period tab bar scrolls correctly in Chromium and the hidden scrollbar is appropriate. This is not an issue. Finding can be closed.

**Role note**: The Negotiator role has access to `/agent/analytics` and sees their own data (pipeline value, files submitted, missing fees for their own files). This is correct per the role design and is not a mobile finding.

---

### 8. Solicitors (`/agent/solicitors`) — live results

**SOL-1** [HIGH] Header flex overflow — **CONFIRMED**
At 375px the page heading is visibly truncated ("Solicito…"). The stats chips (firm count / contact count) appear in the right area but compress the heading. The inline `padding: "24px 32px 28px"` on the header applies at mobile, compounding the squeeze.

**SOL-2** [HIGH] Body `px-8 py-7` — **CONFIRMED**
The solicitor card list renders in a narrow column at 375px. Contact info rows wrap correctly (flex-wrap is present on email/phone rows), but the cards are cramped overall.

**SOL-3** [UNKNOWN → **HIGH**] `RecommendedSolicitorsSettings` — **NOW AUDITED**
See dedicated section below.

---

### 9. Settings (`/agent/settings`) — live results

**SET-1** [CRITICAL] Two-column `58fr/42fr` grid — **CONFIRMED CRITICAL**
The live screenshot at 375px clearly shows both "My profile" and "Sending addresses" panels rendering side-by-side in an extremely narrow two-column layout. The "My profile" panel is approximately 178px wide and the "Sending addresses" panel is approximately 128px wide (both after the 32px inline padding on each side consumes 64px of the 375px viewport). Content is visibly broken — the profile inputs are tiny and partially clipped.

At 768px, the layout is functional: the two columns have adequate width within the 548px content area (768px minus 220px sidebar).

**SET-2** [CRITICAL] Profile form 3-column NAME/EMAIL/PHONE grid — **CONFIRMED CRITICAL**
At 375px inside the 178px "My profile" column, the three-column input row makes each input approximately 55px wide. The NAME, EMAIL, PHONE labels are visible but the inputs are non-functional at this width. CRITICAL confirmed.

**SET-3** [HIGH] Input font-size 14px → iOS zoom — **CONFIRMED HIGH**
All inputs in the Settings page use `text-sm` (14px). Cannot simulate iOS zoom in Chromium, but the CSS evidence is definitive. Finding confirmed as HIGH.

**SET-4** [HIGH] Body `px-8 py-7` — **CONFIRMED**
Body padding confirmed non-responsive at 375px.

---

### 10. New Sale (`/agent/transactions/new`) — live results

**NEW-1** [HIGH] Body `px-8 py-7` — **CONFIRMED**
The header shows "New Transa" (truncated "New Transaction") at 375px — the inline `padding: "24px 32px 28px"` combined with the narrow viewport cuts off the title. The body padding compounds this.

**NEW-2** [HIGH] Form inputs `text-sm` → iOS zoom — **CONFIRMED HIGH**
All form inputs in the New Sale flow use `text-sm` or the `.glass-input` class (14px). Definitive from CSS; cannot simulate in Chromium.

**NEW-3** [MEDIUM] Purchase type button group — **CONFIRMED MEDIUM**
The "Freehold / Leasehold" tenure buttons and "Mortgage / Cash / Cash from Proceeds" purchase type buttons are visible at 375px. "Cash from Proceeds" text wraps within its button, creating an uneven row height. Functional but visually inconsistent. Confirmed as MEDIUM.

---

### 11. Property File Detail (`/agent/transactions/[id]`) — live results

**PROP-1** [CRITICAL] `w-72 flex-shrink-0` sidebar not hidden on mobile — **CONFIRMED CRITICAL**
At 375px, the property file page is visibly broken. The page title "27 Westbu…" is truncated, content is compressed into a very narrow column, and the sidebar (TransactionSidebar, 288px) competes with the main tab content area. The layout is non-functional on small phones.

At 768px, the issue persists in a different form: the 220px AgentShell sidebar + 288px TransactionSidebar + 28px gap = 536px of the 768px viewport consumed by sidebars, leaving only 232px for the tab content. This makes 768px also significantly impaired, not just 375px.

**PROP-1 severity remains CRITICAL; 768px is also affected (not just mobile).**

**PROP-2** [CRITICAL] Tab bar overflow — **CONFIRMED CRITICAL**
At 375px, the 5-tab bar (Overview, Milestones, Reminders, To-Do, Activity) is severely cramped. The tabs appear to overflow or clip — the "Activity" tab is likely unreachable without horizontal scrolling (which the tab bar has no `overflow-x-auto` for). At 768px the tab labels are visible but tight within the narrow remaining content area.

**PROP-3** [HIGH] MetaField `130px 160px 1fr` grid — **CONFIRMED HIGH**
Confirmed from 375px screenshot. The metadata row with Status / Assigned to / Last progress is extremely compressed.

**PROP-4** [HIGH] `grid grid-cols-2` overview sections — **CONFIRMED HIGH**
The two-column grids for contacts, reminders/activity, and risk/chain widgets are visibly broken at 375px.

**PROP-5** [HIGH] PropertyHero breadcrumb row — **CONFIRMED HIGH**
"27 Westbu…" is the truncated property title in the breadcrumb area. Status badge and agency name are visible but the breadcrumb row is crowded.

**PROP-6** [PARTIAL] Hero bottom row flex-wrap — **PARTIAL**
The price / exchange-countdown / progress bar row appears to wrap at 375px. The wrapping mitigates the worst of the compression here, but the section is still very tight.

**PROP-7** [HIGH] Sidebar date/select inputs `text-sm`/`text-xs` → iOS zoom — **CONFIRMED HIGH**
Sidebar inputs confirmed present in code. Cannot simulate iOS zoom in Chromium but the CSS evidence is definitive.

---

## RecommendedSolicitorsSettings — full audit (SOL-3 resolution)

File: `components/agent/RecommendedSolicitorsSettings.tsx`
This component renders inside the Settings page right column (the `42fr` column, approximately 232px at desktop, ~128px at current mobile breakpoint).

### Findings

**RSS-1** [HIGH] All form inputs use `text-sm` (14px) — iOS zoom trigger
- Fee input: `className="w-28 px-2 py-1 text-sm rounded-lg ..."` — 14px, will trigger iOS zoom
- Search/add input: `className="w-full px-3 py-2 text-sm rounded-lg ..."` — 14px, iOS zoom
- Contact form: name, phone, email, fee inputs all use `text-sm rounded-lg` — all 14px
- Fix: Add `style={{ fontSize: 16 }}` to all inputs, or fix globally via `.agent-input` CSS class

**RSS-2** [CRITICAL within broken layout; HIGH after SET-1 fix] Contact form `grid grid-cols-2` phone+email row
- `<div className="grid grid-cols-2 gap-2">` for phone and email fields
- Within the current broken `42fr` column (~128px at 375px): each input would be ~60px wide — completely unusable
- After SET-1 is fixed (Settings becomes single-column): the full-width card gives ~311px for this grid, resulting in ~150px columns — borderline but functional
- Fix: Change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2` for the phone/email row

**RSS-3** [MEDIUM] Search results dropdown `absolute z-20`
- The dropdown panel rendering below the search input uses `position: absolute z-20 left-0 right-0 mt-1`
- Within the Settings right column, `right-0` is relative to the card container, so the dropdown is correctly scoped
- No clipping issue identified — the `overflow-y-auto max-h-52` constrains height correctly
- No action needed

**RSS-4** [LOW] "Remove" button touch target is too small
- The Remove button is `className="text-xs text-slate-900/30 hover:text-red-400 ..."` — text-only, no padding, approximately 20px tall
- Well below the 44px touch target guideline for a destructive action
- Fix: Add `p-2 -m-2` to increase the touch target without changing visual size

---

## New findings from live testing

**LT-1** [MEDIUM] OnboardingChecklist panel overlaps content at 375px
- The `<OnboardingChecklist>` component renders as a flex sibling of `<main>` in `AgentShell.tsx`. When open, its floating panel (visible in To-Do and Completions screenshots) sits at the bottom of the viewport and partially covers page content.
- On pages with short content (To-Do empty state, Completions with few files), the checklist panel covers a meaningful portion of the usable screen area.
- The close button (×) is visible, so the panel is dismissable — this prevents a CRITICAL rating.
- Fix: Ensure the checklist panel is `position: fixed` and rendered in a portal, or add bottom padding to `<main>` equal to the checklist panel height when it is open.

**LT-2** [HIGH] Property file is also broken at 768px, not only 375px
- The static audit flagged PROP-1/2 as mobile-only. Live testing at 768px shows the issue persists: AgentShell sidebar (220px) + TransactionSidebar (w-72, 288px) + 28px gap = 536px of 768px consumed, leaving only ~232px for tab content.
- The tab content area at 768px is narrower than a phone held in landscape.
- Fix priority: PROP-1 must also make the TransactionSidebar collapsible at 768px (not just hidden at 375px). Suggested breakpoint: hide TransactionSidebar below `lg:` (1024px).

**LT-3** [MEDIUM] Dashboard at 375px has horizontal overflow
- The full-page dashboard screenshot is wider than 375px, indicating content is overflowing horizontally. The likely cause is the filter chip row (`AssignedToChip`, `RiskChip`, `ManagedByChip` inline) without `overflow-x-auto` on the container. Less severe than the Comms overflow but confirms DASH-2 should be treated as MEDIUM (not dismissed as low-risk).

**LT-4** [LOW] Solicitor firm cards: active-files chip row can overflow at 375px
- At 375px, solicitor firm cards show truncated firm names but the "files" chip pills (file count per firm) are tight and may overflow on firms with many active files. Minor visual concern, functional.

**WQ-NEW** [HIGH] Work Queue / Reminders — file alert row and filter chip overflow
- Confirmed live on iPhone (2026-04-27). The "file alerts" summary row (e.g. "9 file alerts" / "9 missing solicitor" chips) overflows horizontally. Individual per-file alert rows also overflow — the "Add purchaser solicitor" action label is cut off on the right. Caused by a flex row with no wrap on a content-heavy row. `overflow-x: hidden` on body (Stage 1) makes the cut-off content unreachable.
- Scope: `components/reminders/` or equivalent work-queue page-level component. Stage 3 fix.

**MYFILES-1** [HIGH] My Files (Dashboard) header — action buttons overflow on mobile
- Confirmed live on iPhone (2026-04-27). The "My Files" (or "All Files") page header renders the page title inline with "+ New sale" and "Send note to progressor" buttons in a single flex row. Row does not wrap at 375px, causing layout overflow. The Hub page has the same pattern (already tracked as HUB-1). MYFILES-1 is the same finding scoped to `/agent/dashboard`.
- Scope: `app/agent/dashboard/page.tsx` header flex row. Stage 3 fix (same fix as HUB-1).

---

## Updated priority recommendations

The following updates the Stage 1–3 ordering from the static audit, incorporating live-test severity changes.

### Stage 1 — Shell + global fixes (fix once, all pages benefit)

1. **CC-2** — Replace all `px-8 py-7` body wrappers with `px-4 md:px-8 py-5 md:py-7` across 6 pages. **One-liner per page.**
2. **CC-1** — Extract or refactor page header inline `padding: "24px 32px 28px"` to responsive padding (`px-4 md:px-8`). **Consider a shared `<AgentPageHeader>` component.**
3. **CC-3 (FORM-ZOOM)** — Add `font-size: max(16px, var(--agent-text-body))` to `.agent-input`, `.agent-textarea`, `.glass-input` CSS classes. **Single CSS change cures iOS zoom app-wide.**
4. **SHELL-1/2** — Swap `height: "100vh"` / `minHeight: "100vh"` in `AgentShell.tsx` for `100dvh` with `100vh` fallback. **Two-line change; required for iOS Safari URL bar correctness.**

### Stage 2 — CRITICAL page-level fixes (blocking usability)

5. **COMMS-1** *(upgraded CRITICAL)* — Fix the Updates/Comms header flex row at mobile. Wrap the heading + filter tabs to two rows: heading on line 1, filter tabs on line 2. Remove the `justifyContent: "space-between"` single-row pattern.
6. **SET-1 / SET-2** — Fix Settings two-column grid to single column at mobile (`grid-cols-1 md:grid-cols-[58fr_42fr]`); fix profile form three-column grid to `grid-cols-1 sm:grid-cols-3`.
7. **PROP-1 / LT-2** *(extended scope)* — Hide `TransactionSidebar` below `lg:` breakpoint (1024px), not just below `md:`. Surface sidebar content as a collapsible section or dedicated tab on tablet and mobile. This fixes both 375px (CRITICAL) and 768px (HIGH).
8. **PROP-2** — Add `overflow-x-auto scrollbar-hide` to the property file tab bar. Immediate fix; allows all 5 tabs to be reached by horizontal swipe.

### Stage 3 — HIGH priority, high-frequency pages

9. **HUB-1** — Add `flexWrap: "wrap"` to hub header row; move action buttons below greeting on mobile.
10. **PROP-3** — Replace the `130px 160px 1fr` MetaField grid with `grid-cols-1` on mobile.
11. **PROP-4** — Change property overview `grid grid-cols-2` sections to `grid-cols-1 sm:grid-cols-2`.
12. **NEW-1 / NEW-2** — Fix New Sale body padding; fix all form input font sizes (blocked by CC-3 fix above).
13. **RSS-1 / RSS-2** — Fix RecommendedSolicitorsSettings input font sizes and contact form grid (blocked by SET-1 fix and CC-3 fix).
14. **SOL-1** — Add `flexWrap: "wrap"` to Solicitors header row.
15. **WQ-1** — Fix Work Queue body padding (covered by CC-2 fix above).

### Stage 4 — MEDIUM / polish

16. **RSS-4** — Increase "Remove" button touch target in RecommendedSolicitorsSettings.
17. **LT-1** — OnboardingChecklist portal rendering on mobile.
18. **PROP-5 / PROP-6** — PropertyHero breadcrumb wrap and exchange/progress compression.
19. **ANAL-1** — Solicitor performance row two-line layout at mobile (optional).
20. **LT-3** — Dashboard horizontal overflow (add `overflow-x-auto` to filter chip row).

---

## Live testing methodology notes

- Playwright headless Chromium cannot simulate iOS Safari URL-bar behaviour (SHELL-1/2) or input-focus zoom (CC-3, NEW-2, SET-3, PROP-7, RSS-1). These findings are confirmed by CSS evidence but require a physical iPhone or Xcode Simulator for visual confirmation.
- `position: fixed` elements (mobile top bar, OnboardingChecklist panel) appear at their fixed viewport position in Playwright full-page screenshots; they do not repeat for each scroll segment.
- Horizontal overflow is confirmed when the full-page screenshot width exceeds the configured viewport width — observed on `/agent/comms` (CRITICAL) and `/agent/dashboard` (MEDIUM).
- Tailwind breakpoints confirmed via live rendering: `sm:` fires at 640px, `md:` at 768px — consistent with default config assumption in the static audit.
- Screenshots saved in `mobile_audit_screenshots/{role}/{breakpoint}/{page}.png` — not committed to git.
