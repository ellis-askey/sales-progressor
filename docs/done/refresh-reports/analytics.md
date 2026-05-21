# Analytics Page Refresh — Completion Report

## Summary

A full-pass refresh of the agent analytics page (`/agent/analytics`) covering 11 sections: header cleanup, smart fee sublines, conversion rates, inline fee editing, owner-line labelling, period-comparison deltas, empty-state handling, a fee forecast card, CSV export, a complete mobile rebuild, and a sortable team leaderboard. The page is now substantially more informative, actionable, and mobile-first.

---

## Changes by section

### Section 1 — Page header cleanup + period selector wording

**What changed:**
- Removed the `ANALYTICS` eyebrow label (sidebar already provides context)
- Removed the static "All team" sub-line
- Sub-line now reads "Performance and revenue across your agency." or "Performance and revenue for [Name]." when a team member is selected in the Viewing dropdown
- Period buttons renamed: "Week" → "This week", "Month" → "This month", "Year" → "This year"
- Removed the redundant "current month" subtitle text beneath the period buttons

**Why:** Reduce noise, make the sub-line contextually useful, and make period buttons self-explanatory without a secondary label.

**Files touched:**
- `app/agent/analytics/page.tsx`

---

### Section 2 — Smart dashed-fee values

**What changed:**
- Each of the three fee cards (Total fee pipeline, Fees locked in, Average fee) now shows a clickable coral subline "[N] file(s) need a fee →" when data is missing, linking to the missing-fees list further down the page
- `noFeeExchangedCount` computed separately for the Fees locked in card
- `html { scroll-behavior: smooth; }` added to globals.css so the anchor scroll is animated

**Why:** Connect the dashed values to the actionable surface rather than leaving users to scroll and find the list manually.

**Files touched:**
- `app/agent/analytics/page.tsx`
- `app/globals.css`

---

### Section 3 — Conversion rates as derived stats

**What changed:**
- `exchangeRate` and `completionRate` computed from period data
- `sub2` prop added to `StatCard`
- Exchanged card shows "X% of submitted have exchanged" (hidden when submitted is zero)
- Completed card shows "X% of exchanged have completed" (hidden when exchanged is zero)

**Why:** Turn absolute numbers into a funnel story — the relationship between stages is more useful than raw counts alone.

**Files touched:**
- `app/agent/analytics/page.tsx`

---

### Section 4 — Inline fee edit + "View file" link

**What changed:**
- New `MissingFeeRow` client component replaces the old plain-link rows in the missing-fees list
- Desktop: "Set fee →" opens an inline popover anchored above the button (`bottom: calc(100% + 6px)`) — never clipped at page bottom
- Mobile (<768px): bottom-sheet modal via `createPortal` with drag handle pill and backdrop dismiss
- Fee form matches the existing pattern exactly: Fixed £ / % toggle, `PriceInput` component, VAT exclusive/inclusive `<select>`
- Uses `saveAgentFeeAction` server action (same as `TransactionSidebar.tsx`)
- On save: row disappears (`setDismissed(true)`) + `router.refresh()` to update fee summary cards
- "View file →" secondary link added to each row

**Why:** Avoid navigating away from the analytics page just to set a fee — the most common action should be one click from where the user already is.

**Existing pattern finding:** Fee input uses Fixed £ amount OR percentage of purchase price (toggle), VAT exclusive/inclusive select. Stored as `agentFeeAmount` (pence, Int) and `agentFeePercent` (Decimal) with `agentFeeIsVatInclusive` (Boolean). All handled by the existing `saveAgentFeeAction`.

**Files touched:**
- `components/analytics/MissingFeeRow.tsx` (new)

---

### Section 5 — Row label clarification

**What changed:**
- `ROLE_LABEL` map added: `director → "Director"`, `negotiator → "Negotiator"`, `sales_progressor → "Progressor"`
- `fmtNameShort(name)` helper: "Alex Morgan" → "Alex M."
- `fmtOwnerLine(t)` helper: returns `{ line, awaiting }` for all three ownership cases
  - `self_managed`: agent user name + role
  - `outsourced` with assignedUser: assigned user name + role
  - `outsourced` without assignedUser: "Awaiting assignment" (amber colour, `awaitingAssignment: true`)
- `role: true` added to both `agentUser` and `assignedUser` selects in `getAgentTransactions`

**Why:** The previous display ("Sasdsf") was raw test data with no context. Showing "Alex M. · Negotiator" makes each row immediately scannable.

**Files touched:**
- `app/agent/analytics/page.tsx`
- `lib/services/agent.ts`

---

### Section 6 — Period comparison deltas

**What changed:**
- `getPrevPeriodBounds(period)` helper: returns `{ start, end }` for the immediately preceding period of the same length
- `fmtDelta(curr, prev, periodWord)` helper: returns `{ text, color }` — "↑ 2 vs last month" (green), "↓ 1 vs last week" (amber), "no change vs last month" (muted)
- `hasHistory` guard: deltas only shown when the agency has at least one transaction predating the current period start (hides confusing "no change" for brand-new agencies)
- `sub3` and `sub3Color` props added to `StatCard`
- Three count cards (Files submitted, Exchanged, Completed) show deltas beneath the conversion rate subline

**Why:** Absolute numbers are context-free. "4 files this month" means nothing without "vs 2 last month."

**Files touched:**
- `app/agent/analytics/page.tsx`

---

### Section 7 — Empty / zero-data state

**What changed:**
- **Full empty state** (`transactions.length === 0`): early return showing only the page header + a centred panel with an ascending bar chart SVG icon, the spec heading and four bullet points, and a coral "Submit your first sale" CTA linking to `/agent/transactions/new`
- **Partial empty state banner** (`periodTx.length === 0 && period !== "all"`): soft coral banner between period tabs and stat cards reading "No activity this week/month/year. Try changing the period." with an "All time →" link
- **Missing-fees section** always rendered (when transactions exist), showing "✓ All files have fees set." when the list is empty rather than hiding the section entirely

**Why:** A page full of dashes and zeros for a new agency looks broken. The empty state reassures and guides. The "All files have fees set" confirmation is a positive signal worth showing.

**Files touched:**
- `app/agent/analytics/page.tsx`

---

### Section 8 — Fee forecast

**What changed:**
- `activePeriodTx` (active, pre-exchange files in period), `activeFees`, `forecastPence`, `totalForecastPence`, `lockedPct` computed
- New "Fee forecast" card inserted between the three fee summary cards and the bar charts
- Two side-by-side stats: "If pipeline all exchanges" (total expected) and "Locked in already" (exchanged fees in green)
- Subtle 5px progress bar: locked-in percentage of total, labelled "X% secured · Y% in active pipeline"
- Edge case: "Set fees on active files to see your forecast" with link to `#missing-fees` when no active files have fees

**Why:** Translates fee data into a forward-looking answer ("how much will I make?") rather than just a backward-looking summary.

**Files touched:**
- `app/agent/analytics/page.tsx`

---

### Section 9 — Export CSV

**What changed:**
- New API route `GET /api/agent/analytics-export` — director-only (403 otherwise)
- Accepts `period` and `user` query params, mirrors the page's visibility logic exactly
- Returns `text/csv` with `Content-Disposition: attachment; filename="analytics-[agency]-[period]-[YYYYMMDD].csv"`
- CSV sections: metadata header, OVERVIEW, FEES, FILES MISSING A FEE (conditional), REFERRAL INCOME (conditional) — sections separated by blank lines
- No CSV library; implemented with a `csvCell()` helper that correctly quotes values containing commas or double-quotes
- "Export CSV" button with download arrow SVG added to the analytics page header, director-only, sitting alongside the Viewing dropdown

**Why:** Directors need to share data with accountants and at board meetings. A clean CSV beats a screenshot.

**Files touched:**
- `app/api/agent/analytics-export/route.ts` (new)
- `app/agent/analytics/page.tsx`

---

### Section 10 — Mobile rebuild

**What changed:**

*`app/agent/analytics/page.tsx`:*
- Header: responsive padding (`px-4 sm:px-8`), inner row `flex-col → sm:flex-row`
- Director controls group: `flex-wrap` so Viewing dropdown and Export CSV wrap naturally on narrow screens
- Content div: `px-4 py-5 sm:px-8`
- Period pills: `overflow-x: auto, scrollbarWidth: none` for horizontal scroll; `flexShrink: 0` per pill; padding increased from `5px 14px` to `9px 14px` for larger touch targets
- All six grid sections converted from fixed inline `gridTemplateColumns` to Tailwind responsive classes:
  - Stat cards: `grid-cols-1 sm:grid-cols-3`
  - Pipeline/Exchanged pair: `grid-cols-1 sm:grid-cols-2`
  - Fee cards trio: `grid-cols-1 sm:grid-cols-3`
  - Fee forecast inner grid: `grid-cols-1 sm:grid-cols-2`
  - Charts: `grid-cols-1 md:grid-cols-2` (stacked until 768px)
  - Referral income pair: `grid-cols-1 sm:grid-cols-2`

*`components/analytics/MissingFeeRow.tsx`:*
- Main wrapper changed to `flex-col sm:flex-row` — address/owner stacks, then actions appear below side by side on mobile
- "Set fee →" and "View file →" both given `minHeight: 36, padding: "6px 0"` for adequate touch targets

**Why:** Per Ellis: mobile must be actively good, not just "doesn't break."

**Files touched:**
- `app/agent/analytics/page.tsx`
- `components/analytics/MissingFeeRow.tsx`

---

### Section 11 — Team leaderboard

**What changed:**
- New `LeaderboardTable` client component with full sort and navigation behaviour
- Visibility: `isDirector && !filterUserId && team.length > 1` — hidden when filtered to one user or agency has only one member
- Per-user stats computed by grouping `periodTx` by `agentUser.id`, then mapping over `team` (all members appear, including those with zero files in the period)
- Columns: Negotiator (name · role), Submitted, Exchanged, Conversion (%), Pipeline value, Avg fee, Locked in
- Default sort: Exchanged descending; all numeric columns sortable; alphabetical tie-breaking; nulls sort last on descending
- **Top row**: left `3px coral` border + subtle coral tint background — retained on mobile cards
- **Row click**: navigates to `/agent/analytics?user=${id}` (+ period if non-default), filtering the whole page to that team member
- **"(you)"** appended in muted text when the logged-in director appears in the table
- Desktop: `<table>` with `hidden md:block`; Mobile: cards with a `<select>` sort dropdown + direction toggle, `md:hidden`
- Section appended at the bottom of the page

**Why:** Directors need to see who is performing, not just aggregate totals.

**Files touched:**
- `components/analytics/LeaderboardTable.tsx` (new)
- `app/agent/analytics/page.tsx`

---

## Findings flagged

### Existing pattern findings
- **Fee input pattern**: `TransactionSidebar.tsx` uses a Fixed £ / percentage toggle, `PriceInput` component (pence-based), and a VAT exclusive/inclusive `<select>`. Server action: `saveAgentFeeAction`. `MissingFeeRow` replicates this exactly.
- **New-sale route**: `/agent/transactions/new` (confirmed by file glob).
- **`getAgentTransactions` user role omission**: The service did not include `role` on either `agentUser` or `assignedUser` selects. Added in Section 5 as a prerequisite for labelling.

### Data availability findings
- **Period comparison**: No schema or query changes required — previous period computed by re-filtering the already-loaded `transactions` array against previous-period date bounds. Zero extra database queries.
- **Leaderboard per-user stats**: Also derived in-memory from `periodTx` by grouping on `agentUser.id`. No extra queries.

### Out-of-scope items found
- The solicitor exchange performance section has no mobile card layout (rows use a fixed flex layout with four columns). Works at 640px+ but may be tight at 375px. Flagged for a future pass.
- The `MissingFeeRow` desktop popover uses a fixed width of 230px anchored to the button. On very narrow desktop viewports it may clip. Out of scope for this pass.

---

## Database changes

None. No schema changes were made in this refresh.

---

## New dependencies

None.

---

## Breaking changes

- `getAgentTransactions` now selects `role: true` from both `agentUser` and `assignedUser`. This is additive — callers that don't use `role` are unaffected.
- `globals.css` gains `html { scroll-behavior: smooth; }`. This applies site-wide. No regressions expected.

---

## Files touched (full list)

| File | Change |
|---|---|
| `app/agent/analytics/page.tsx` | Major — all 11 sections |
| `app/globals.css` | Added `html { scroll-behavior: smooth; }` |
| `app/api/agent/analytics-export/route.ts` | New — CSV export API route |
| `components/analytics/MissingFeeRow.tsx` | New — inline fee edit component |
| `components/analytics/LeaderboardTable.tsx` | New — sortable team leaderboard |
| `lib/services/agent.ts` | Added `role: true` to user relation selects |
