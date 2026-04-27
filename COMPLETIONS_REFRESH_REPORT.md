# Completions Page Refresh — Completion Report

## Summary

Full UX refresh of the agent-side Completions page (`/agent/completions`), plus two structural changes: removal of the "Exchanged — Awaiting Completion" strip from the agent My Files page, and creation of an Exchanges placeholder page with sidebar tab. The completions page now shows pipeline value, time-since-exchange, solicitor info, improved days-relative wording, a "Set date →" CTA, fully clickable cards, an upgraded empty state, and a responsive mobile layout. No business logic or data isolation was changed.

---

## Changes by section

### Section 1 — Page header cleanup + summary stat row

**What changed:**
- Removed `<p className="agent-eyebrow">Agent Portal</p>` — sidebar already establishes context
- Subtitle changed from "Your files that have exchanged and are working towards completion." → "Files that have exchanged and are heading to completion." — drops the redundant "Your", reads more active
- Added stat row beneath subtitle: coloured anchor links (`1 overdue · 1 this week · 1 next week · 1 later · 1 no date`) — each segment links to its corresponding group section via `#section-{key}` anchor
- Zero-count segments omitted; entire row hidden when all groups empty
- Added `id="section-{key}"` attributes to every group container div to make the anchor links functional
- Each anchor has `minHeight: 44` for touch targets

**Why:** Eyebrow duplicated the sidebar. Stat row gives instant triage without scrolling. Anchor links let agents jump directly to the group they care about.

**Files touched:**
- `app/agent/completions/page.tsx`

---

### Section 2 — Pipeline value summary per group

**What changed:**
- Added `fmtCompact()` helper: under £1M shows full value (e.g. "£475,000"), £1M+ shows compact (e.g. "£2.88M")
- Top-of-page context line: `"5 files · £2.88M awaiting completion"` — between stat row and first group
- Per-group header: right-aligned total value (e.g. `£325,000`) next to the group label and count; omitted when all prices are missing in that group (no £0 displayed)
- Footnote below group header when at least some prices are missing but group value is shown: `"(N files with no price)"`

**Why:** Surfaces financial weight of the pipeline. Directors use this for cashflow; agents use it for prioritisation.

**Files touched:**
- `app/agent/completions/page.tsx`

---

### Section 3 — Card structure: exchange date, solicitors, days-relative wording

**What changed:**

**Data layer — `getAgentCompletions` extended:**
- `milestoneCompletions` select changed to cover both exchange defs (VM12/PM16) AND completion defs (VM13/PM17) in a single query pass, adding `completedAt` and `milestoneDefinitionId` to the select
- The JS filter and map split them in-memory — no extra DB query
- Three new fields returned per file: `exchangedAt: Date | null`, `vendorSolicitorName: string | null`, `purchaserSolicitorName: string | null`
- `vendorSolicitorFirm` and `purchaserSolicitorFirm` added to the Prisma select — these relations already exist on `PropertyTransaction`, no schema change

**3a — Time-since-exchange line:**
- Below the price/purchaser row: `"Exchanged 9 Apr · 18 days ago"` / `"Exchanged yesterday"` / `"Exchanged today"` / `"Exchange date not recorded"` (defensive fallback for data anomalies)

**3b — Solicitor info line:**
- One combined line: `"Vendor sol: Jones & Co · Purchaser sol: Smith LLP"`
- If one is missing: italic `"not set"` for that side (structure always visible so the gap is obvious)
- If both missing: single `"No solicitors set"` line in amber-brown tone (`#b45309`) — subtle warning, not alarming
- On mobile: splits into two stacked lines rather than one truncated line

**3c — Days-relative wording:**
- `-4 days` → `"4 days overdue"` in red (`#dc2626`)
- `3 days` → `"in 3 days"`
- Same day → `"today"` in amber
- Tomorrow → `"tomorrow"`
- `No date set` retained for no_date group

**Why:** "Triggered by / Grace period" style system internals replaced with agent-facing context: how long since exchange gives urgency; solicitor names are the first thing needed before making a call.

**Files touched:**
- `lib/services/agent.ts` (`getAgentCompletions`)
- `app/agent/completions/page.tsx`

---

### Section 4 — "No completion date set" group: "Set date →" CTA

**What changed:**
- Cards in the `no_date` group: the right-side date/days column is replaced with a small bordered pill: `"Set date →"`
- Styled as secondary/muted — small font, subtle border, does not compete with the date display on other cards
- The entire card is a `<Link>` to `/agent/transactions/[id]`, so clicking anywhere (including the pill) navigates to the file

**Focus param note:** The spec proposed `/agent/transactions/[id]?focus=completion-date` with a scroll+highlight handler on the transaction page. The transaction page does not currently support focus params — implementing it was flagged out-of-scope in the spec unless it required only a small addition. Deferred — the link navigates to the file correctly; the scroll-to-field behaviour is a future pass.

**Why:** Agents can see at a glance that a date is missing and can navigate directly to the file to set it.

**Files touched:**
- `app/agent/completions/page.tsx`

---

### Section 5 — Card click behaviour

**What changed:**
- Cards were `<div>` elements with no navigation — converted to `<Link href="/agent/transactions/[id]">` wrapping the entire card content
- `hover:shadow-md transition-shadow` applied for a subtle desktop lift indicating clickability
- Mobile tap state handled by the browser's native link interaction

**Audit findings:** Cards were previously non-clickable divs — this was a gap. Fixed.

**Files touched:**
- `app/agent/completions/page.tsx`

---

### Section 6 — Empty state upgrade

**What changed:**
- Icon: `ClockCountdown` (thin weight, 40px, muted) from `@phosphor-icons/react` — "waiting" tone, already installed
- Heading: `"No files awaiting completion"` — unchanged
- Line 1: `"Once a file exchanges, it'll appear here as it heads toward completion."`
- Line 2 (new): `"We'll track target dates, days remaining, and surface anything that drifts past its date."`

**Why:** Two-line description makes the page purpose clear on first visit. Icon provides visual anchor without over-celebrating an empty state.

**Files touched:**
- `app/agent/completions/page.tsx`

---

### Section 7 — Mobile pass

**What changed:**

**Card layout restructure:**
- Two separate layout blocks per card: `hidden md:flex` (desktop: left info + right date) and `flex md:hidden` (mobile: full-width stack)
- Mobile stack order: address → price/purchaser → exchange line → solicitor lines → date bottom-right
- Address on mobile: wraps to second line rather than truncating (important data)
- Solicitor info on mobile: two separate stacked lines instead of one truncated `·`-separated line
- Date/days and "Set date →" CTA: move to a `flex justify-end` bottom row on mobile; stay top-right on desktop

**Outer padding:** `px-8 py-7` → `px-4 md:px-8 py-5 md:py-7` — 16px horizontal on mobile, 32px on desktop

**Group header:** Added `flex-wrap` — value total wraps to second line on very narrow screens rather than overflowing

**Stat row:** Already had `flexWrap: wrap`; `minHeight: 44` already on each anchor for 44px touch targets

**Pipeline total line:** Single short line — fits comfortably at 375px without change

**Files touched:**
- `app/agent/completions/page.tsx`

---

## My Files page — section removed

**Confirmed:** The My Files page (`/agent/dashboard`) itself is intact. The header, user name, stats row, "+ New sale" CTA, "Send note to progressor" CTA, ForecastStrip, file list with filter tabs, and AgentRequestsPanel all remain.

**What was removed:** The "Exchanged — Awaiting Completion" section rendered by `PostExchangeStrip`.

**Exact removals from `app/agent/dashboard/page.tsx`:**
1. `import { PostExchangeStrip } from "@/components/transactions/PostExchangeStrip"` — removed
2. `getExchangedNotCompleting` removed from the named import on the transactions service line
3. `getExchangedNotCompleting(...)` call removed from the `Promise.all` array
4. `postExchangeGroups` removed from the destructuring
5. JSX block `{postExchangeGroups.length > 0 && (<PostExchangeStrip ... />)}` removed

**`PostExchangeStrip` component NOT deleted** — still used by `app/dashboard/page.tsx` (the sales progressor dashboard), which is a separate page and not in scope for this pass.

**`getExchangedNotCompleting` service function NOT removed** — still called by the progressor dashboard.

**Files touched:**
- `app/agent/dashboard/page.tsx` (edited — section removed)
- `components/transactions/PostExchangeStrip.tsx` (untouched)
- `lib/services/transactions.ts` (untouched)

---

## Exchanges placeholder — files created

**New files:**
- `app/agent/exchanges/page.tsx` — placeholder page with glass header, "Exchanges" H1, subtitle "Files moving toward exchange.", and a centred coming-soon message with `HardHat` icon
- No new route directory files needed beyond the page itself

**Sidebar tab added in `components/layout/AgentShell.tsx`:**
- `Handshake` icon added to imports (from `@phosphor-icons/react`)
- Nav entry `{ href: "/agent/exchanges", label: "Exchanges", Icon: Handshake }` inserted above Completions
- Active state, mobile drawer close behaviour, and hover states all inherited from the shared nav item rendering — no special handling needed

**Access control:** The page calls `requireSession()` which requires an authenticated session. The agent layout (`app/agent/layout.tsx`) already restricts the entire `/agent/*` route group to `negotiator` and `director` roles — the Exchanges page inherits this gate automatically.

**Metadata:**
```ts
export const metadata = {
  title: "Exchanges · Sales Progressor",
  description: "Files moving toward exchange — coming soon.",
};
```

**Files touched:**
- `app/agent/exchanges/page.tsx` (new)
- `components/layout/AgentShell.tsx`

---

## Findings flagged

### Data availability findings
- **Exchange date (`exchangedAt`)** ✅ — `completedAt` on VM12/PM16 `MilestoneCompletion` records; fetched in the same query pass as the completion-gate check
- **Vendor and purchaser solicitor names** ✅ — `vendorSolicitorFirm.name` / `purchaserSolicitorFirm.name` exist on `PropertyTransaction`; added to select without schema change
- **Card clickability** ⚠️ previously non-clickable — fixed by wrapping cards in `<Link>`

### Out-of-scope items found
- **`?focus=completion-date` handler on transaction page** — Link navigates to the file correctly; scroll-to-field and highlight behaviour on the transaction page is deferred. Flagged in Section 4.

---

## Database changes
None. No Prisma schema changes. `vendorSolicitorFirm` and `purchaserSolicitorFirm` were already defined relations on `PropertyTransaction`.

---

## New dependencies
None. `Handshake`, `HardHat`, `ClockCountdown` are all from `@phosphor-icons/react`, already installed.

---

## Breaking changes
- **`getAgentCompletions` return type extended** — three new fields added (`exchangedAt`, `vendorSolicitorName`, `purchaserSolicitorName`). Additive change; no existing callers break.
- **`PostExchangeStrip` removed from agent My Files page** — the progressor dashboard still renders it via `app/dashboard/page.tsx`. No other callers affected.

---

## Files touched (full list)
- `app/agent/completions/page.tsx` — full rewrite (sections 1–7)
- `lib/services/agent.ts` — `getAgentCompletions` extended (section 3)
- `app/agent/dashboard/page.tsx` — PostExchangeStrip section removed (section 8)
- `app/agent/exchanges/page.tsx` — new placeholder page (section 9)
- `components/layout/AgentShell.tsx` — Exchanges nav tab added (section 9)
- `COMPLETIONS_REFRESH_REPORT.md` — this file
