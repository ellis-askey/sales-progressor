# /agent/analytics — Stage 1 Inventory

**Route:** `/agent/analytics`
**Date:** 2026-05-18
**Status:** Stage 1 Draft — pending Ellis sign-off
*All amendments tracked in Section 14.*

---

## Section 1 — Page identity

| Field | Value |
|---|---|
| Route | `/agent/analytics` |
| File | `app/agent/analytics/page.tsx` |
| Component type | Server Component (async); renders `AnalyticsClientShell` as the primary client shell |
| Who sees it | Director (full feature set) · Negotiator (own data only — no team filter, no leaderboard, no referral stats) |
| How they reach it | Sidebar nav → Analytics |
| Reachable without a transaction | Yes — zero-transaction empty state renders hero card without client shell |

### Complexity classification: **LARGE**

PAGE_LIST.md flagged this as "Medium (may rise to Large)". After reading all chart components and data sources, this classifies as **Large**. Drivers:

1. **6 distinct visualisations** — 3 Recharts-based (VolumeBarChart, MonthlyMixChart, KpiSparkline ×3) + 3 custom (SubmissionFunnel SVG, ValueHeatTiles HTML, SpeedGauge HTML/CSS)
2. **15 rendered sections** inside AnalyticsClientShell — period tabs, 3 KPI cards, funnel + speed, values, fees, fee forecast, 2 bar charts, solicitor table, 3 referral sections, missing fees list, risk panel, leaderboard
3. **Complex client-side metric derivation** — all period calculations (submission counts, pipeline value, fee totals, conversion rate, speed-to-exchange) are derived client-side from the raw `transactions` array; no server recalculation on period change
4. **Director-only feature set** — team filter, leaderboard, two solicitor/broker referral firm tables, period referral income section — roughly 30% of page sections are director-gated
5. **Inline fee editor embedded in analytics** — `MissingFeeRow` has a popover (desktop) / bottom sheet (mobile) with its own state machine and server action call
6. **Chart theming gap** — Recharts renders with JS-side color props; it does not inherit CSS custom properties natively. Current colour values are hardcoded strings in the component props, not token references
7. **Mobile unknowns** — `MonthlyMixChart` (12 bars × 9px fixed width) likely overflows at 375px; `SubmissionFunnel` (custom SVG) and `ValueHeatTiles` (custom HTML) have no explicit mobile handling; Stage 2 will need to make explicit decisions per chart

---

## Section 2 — Components rendered

*Stage 4 scope declarations are mandatory. Each entry carries exactly one.*

| Component | File | Stage 4 scope | Notes |
|---|---|---|---|
| `PageHeader` | `components/layout/PageHeader.tsx` | No changes — already matches polish | Shared across agent app |
| `AnalyticsFilterClient` | `components/agent/AnalyticsFilterClient.tsx` | Match polish page | Native `<select>` — may need glass-input styling; directors only |
| `AnalyticsNotifCta` | `components/analytics/AnalyticsNotifCta.tsx` | Out of scope | Push notification infrastructure; state machine + Notification API |
| `AnalyticsClientShell` | `components/agent/AnalyticsClientShell.tsx` | Match polish page | Primary client shell; contains all layout logic and metric derivation |
| `VolumeBarChart` | `components/analytics/AnalyticsCharts.tsx` | Match polish page | Recharts; likely mocked in Stage 2 with static data |
| `MonthlyMixChart` | `components/analytics/AnalyticsCharts.tsx` | Match polish page | Recharts; likely mocked; 12-month grouped bar |
| `KpiSparkline` | `components/analytics/KpiSparkline.tsx` | Match polish page | Recharts sparkline ×3 (Submitted, Exchanged, Completed) |
| `SubmissionFunnel` | `components/analytics/SubmissionFunnel.tsx` | Match polish page | Custom SVG; can render with static data in Stage 2 |
| `ValueHeatTiles` | `components/analytics/ValueHeatTiles.tsx` | Match polish page | Custom HTML divs; variable-height tiles |
| `SpeedGauge` | `components/analytics/SpeedGauge.tsx` | Match polish page | Custom HTML/CSS gauge; fixed 130-day scale |
| `DeltaPill` | `components/analytics/DeltaPill.tsx` | Match polish page | Period-over-period comparison badge |
| `FilesAtRiskPanel` | `components/analytics/FilesAtRiskPanel.tsx` | Match polish page | 3-category risk list |
| `MissingFeesList` | `components/analytics/MissingFeesList.tsx` | Match polish page | Expandable list; "show all" toggle |
| `MissingFeeRow` | `components/analytics/MissingFeeRow.tsx` | Match polish page | Inline fee editor; popover on desktop, bottom sheet on mobile |
| `LeaderboardTable` | `components/analytics/LeaderboardTable.tsx` | Match polish page | Full table on desktop, card layout on mobile; directors only |

---

## Section 3 — Data dependencies

| Data | Source | Shape | Notes |
|---|---|---|---|
| `transactions` | `getAgentTransactions(vis)` in `lib/services/agent.ts` | `Transaction[]` — id, address, status, purchasePrice, fee fields, milestoneCompletions, contacts, agentUser, assignedUser | All non-draft transactions; period filtering happens client-side from this array |
| `team` | `getAgencyTeam(agencyId, firmName)` in `lib/services/agent.ts` | `{id, name, role}[]` | Directors + negotiators only; `[]` for negotiators (not called) |
| `solicitorStats` | `getSolicitorExchangeStats(vis)` in `lib/services/analytics.ts` | `{firmId, firmName, exchangeCount, avgDaysToExchange}[]` | Sorted fastest-first; derived from milestone completions × 2 queries |
| `monthlyActivity` | `getMonthlyActivity(vis)` in `lib/services/analytics.ts` | `{month: string, created: number, exchanged: number}[]` (12 buckets) | Always 12 entries; zero-filled buckets if no activity. Month format: "Jan 25" |
| `kpiSparklines` | `getKpiTrendsForAgency(vis, range)` in `lib/services/analytics.ts` | `{labels: string[], submitted: number[], exchanged: number[], completed: number[], submittedValue: number[]}` | 8 weekly buckets, newest→oldest; `range.end = pageNow` |
| `filesAtRisk` | `getFilesAtRisk(vis)` in `lib/services/analytics.ts` | `{overdueChases, stalled, missingEventDate}` each `{count: number, transactionIds: string[]}` | Counts can be 0; IDs capped at 50 per category |
| `referralStats` | `getReferralStats(agencyId)` in `lib/services/analytics.ts` | `{firmId, firmName, referralCount, feeExpectedPence, feeReceivedPence, pendingCount}[]` | Directors only; `[]` passed to shell for negotiators |
| `brokerReferralStats` | `getBrokerReferralStats(agencyId)` in `lib/services/analytics.ts` | Same shape as `referralStats` | Directors only; `.catch(() => [])` swallows errors silently |
| `noFeeFiles` | Derived server-side from `transactions` | `{id, propertyAddress, ownerLine: string\|null, awaitingAssignment: boolean}[]` | Active txs where `calcFeeIncVat(t) === null` |
| `isDirector` | `session.user.role === "director"` | `boolean` | Gates team filter, leaderboard, referral sections |
| `filterUserId` | `searchParams.user` | `string \| null` | Director drill-down to individual; overrides visibility scope |
| `period` | `searchParams.period` | `"week" \| "month" \| "year" \| "all"` | Initial period passed as prop; client-side state thereafter |

**Null / missing data handling:**

- `transactions.length === 0` → Page renders hero card empty state; `AnalyticsClientShell` not rendered at all
- `transactions.length > 0` but no activity in selected period → Banner inside shell: "No activity this week/month/year. Try changing the period."
- `KpiSparkline` all-zero data → Renders empty 28px height spacer (no visible chart)
- `solicitorStats.length === 0` → Section hidden (conditional render in shell)
- `referralStats.length === 0` → Conveyancer referral section hidden
- `brokerReferralStats.length === 0` → Broker referral section hidden
- `referredTxs.length === 0` → Period referral section hidden
- `speedToExchange.count === 0` → "No exchanges {period}" placeholder in speed section
- `noFeeFiles.length === 0` → Missing fees section not rendered (server-side filter)

All 7 server queries run in parallel via `Promise.all()` at page render time. No loading skeleton — page is fully server-rendered before hydration.

---

## Section 4 — States

### Standard states

| State | Trigger | What renders |
|---|---|---|
| Zero transactions | No non-draft transactions for this agent/agency | Hero card: "Analytics will appear here as you submit sales" with CTA link; no client shell |
| Loaded — default | Page load with ≥1 transaction | Full analytics dashboard in selected period |
| Director — all team | `isDirector && !filterUserId` | Full dashboard + team filter + leaderboard + referral sections |
| Director — individual filter | `isDirector && filterUserId` set | Dashboard scoped to that user; leaderboard hidden; "Viewing: {name}" shown |
| Negotiator view | `role !== "director"` | Own data only; no team filter rendered; no leaderboard; no referral stats |

### Page-specific states

| State | Trigger | What renders |
|---|---|---|
| Partial empty — no period activity | `period !== "all" && periodTx.length === 0` | Yellow banner "No activity this week/month/year. Try changing the period." + "All time →" link |
| Period: This week | `period === "week"` | 7-day window for all metrics |
| Period: This month | `period === "month"` | Calendar-month window |
| Period: This year | `period === "year"` | Year-to-date window |
| Period: All time | `period === "all"` | Full history; partial-empty banner never shown |
| No exchanges in period | `speedToExchange.count === 0` | "No exchanges {period}" in funnel/speed section |
| Fee forecast — no predicted files | `thisMonthForecastTx.length === 0` | "No exchanges predicted this month" |
| Fee forecast — files, no fees | predicted files exist but `calcFee === null` | "{n} file(s) predicted — set fees to see amount" |
| Fee forecast — files with fees | `thisMonthFeePence > 0` | `{fmtGBP(thisMonthFeePence)}` + file count + "Locked in already" sub-row |
| MissingFeesList: collapsed | `showAll = false` | First 3 missing-fee rows; "Show all" button |
| MissingFeesList: expanded | `showAll = true` | All missing-fee rows; "Show less" button |
| MissingFeeRow: popover open | Set fee button clicked (desktop) | Inline fee editor floated near button |
| MissingFeeRow: bottom sheet open | Set fee button clicked (mobile, `window.innerWidth < 768`) | Full-screen bottom sheet fee editor |
| MissingFeeRow: saved | `saveAgentFeeAction` succeeds | Row dismisses with animation |
| Push CTA: subscribed | Push permission granted | "✓ Alerts on" pill |
| Push CTA: denied | Notification API denied | Button hidden |

---

## Section 5 — Interactive elements

| Element | Location | Action | Disabled when | Disabled behaviour |
|---|---|---|---|---|
| Period tabs (This week / This month / This year / All time) | Top of client shell | Sets `period` state; recalculates all derived metrics client-side (no server round-trip) | — | Always active |
| Team filter `<select>` | PageHeader (directors only) | Navigates to `?user=<id>` or clears param for "All team" | Negotiator role | Not rendered |
| Leaderboard column header clicks | LeaderboardTable (directors only) | Toggles sort key / direction | — | Caret direction flips |
| Leaderboard row click | LeaderboardTable | Navigate to `?user=<id>` (drill-down) | — | — |
| "All time →" link | Partial-empty banner | Sets `period` to "all" | `period === "all"` | Banner is hidden |
| "{n} need fee →" link | Fees section | Scrolls to `#missing-fees` anchor | `noFeeTransactionCount === 0` | Not rendered |
| FilesAtRiskPanel "View" links | Risk panel (×3) | Navigate to work-queue filtered view | `count === 0` | Replaced by "✓ Clear" text |
| MissingFeesList "Show all" / "Show less" | Missing fees section | Expands/collapses file list | — | — |
| "Set fee" button | MissingFeeRow | Opens fee editor (popover or bottom sheet) | — | — |
| Fee type toggle (£ / %) | MissingFeeRow editor | Switches fixed amount ↔ percentage | — | — |
| VAT toggle (+ VAT / Inc VAT) | MissingFeeRow editor | Switches VAT treatment | — | — |
| "Save" button | MissingFeeRow editor | Calls `saveAgentFeeAction`; dismisses row on success | Amount field empty | Disabled styling |
| "Cancel" / close | MissingFeeRow editor | Dismisses editor without saving | — | — |
| Push notification CTA | PageHeader | Requests push permission via Notification API | Already subscribed or denied | Shows "✓ Alerts on" or hidden |
| Chart hover (Recharts tooltips) | VolumeBarChart, MonthlyMixChart, KpiSparkline | Shows tooltip with value + label | No data | Tooltip not shown |

---

## Section 6 — Conditional renders

```
// Page level (app/agent/analytics/page.tsx)
transactions.length === 0
  → hero card empty state (no AnalyticsClientShell)

// Inside AnalyticsClientShell
period !== "all" && periodTx.length === 0
  → partial-empty banner ("No activity…")

periodTx.length > 0
  → SubmissionFunnel + SpeedGauge section

showDelta (period !== "all" && showDelta === true)
  → DeltaPill on "Value exchanged"

noFeeTransactionCount > 0
  → "{n} need fee →" link in fees section

solicitorStats.length > 0
  → "Solicitor exchange performance" section

referralStats.length > 0
  → "Referral income · Conveyancers" section

brokerReferralStats.length > 0
  → "Referral income · Brokers" section

referredTxs.length > 0
  → "Referral income — {period}" section

noFeeFiles (passed as prop) — rendered in MissingFeesList
  → Entire "Files missing a fee" section

showLeaderboard (isDirector && !filterUserId && team.length > 1)
  → "Team leaderboard" section

isDirector && team.length > 1
  → Team filter dropdown in PageHeader

isDirector && filterUserId
  → "Viewing: {selectedName}" label near filter

// Fee forecast (three-branch)
thisMonthForecastTx.length === 0
  → "No exchanges predicted this month"
thisMonthForecastTx.length > 0 && thisMonthFeePence === 0
  → "{n} files predicted — set fees to see amount"
thisMonthFeePence > 0
  → GBP amount + "Locked in already" sub-row
```

---

## Section 7 — Copy inventory

*Verbatim rule: every distinct string is a separate entry, including variant forms. Flags are inline.*

### Page header

```
Analytics
What's moving, what's stalling, and where your pipeline stands.
← FLAG: subtitle is description, not instruction — review for voice pass
```

### Zero-transaction empty state (page.tsx)

```
Analytics will appear here as you submit sales.
[CTA link — text TBD, reads page source to confirm]    ← needs raw text verification
```

### Period tabs

```
This week
This month
This year
All time
```

### Partial-empty banner

```
No activity this week. Try changing the period.
No activity this month. Try changing the period.
No activity this year. Try changing the period.
All time →
```

### KPI count cards

```
Submitted
Exchanged
Completed
```

### Funnel + Speed section

```
Conversion funnel — this week        ← "this week" / "this month" / "this year" / "all time"
Speed to exchange
{n} days
avg from instruction · {n} file exchanged
avg from instruction · {n} files exchanged
No exchanges this week               ← / this month / this year / all time
```

### Values section

```
Pipeline value
Purchase prices
Value exchanged
Exchanged files
↑ {£X} vs last week     ← / month / year
↓ {£X} vs last week
no change
```

### Fees section

```
Fee pipeline
Inc. VAT where set
{n} need fee →
Locked in
Exchanged files
Average fee
Inc. VAT per file
```

### Fee forecast section

```
Fee forecast
Predicted for {month label}          ← e.g. "Predicted for May 2026"
No exchanges predicted this month
{n} file predicted — set fees to see amount
{n} files predicted — set fees to see amount
set fees to see amount               ← link text within the above
{£X}                                 ← formatted GBP forecast
{n} file · inc. VAT where set
{n} files · inc. VAT where set
Locked in already
from exchanged files
```

### Charts section

```
Files submitted — last 7 days        ← period = "week"
Files submitted — last 6 months      ← period = "month"
Files submitted — last 12 months     ← period = "year"
Files submitted — all time (last 12 months)   ← period = "all"
Monthly activity — last 12 months
Created                              ← legend label (MonthlyMixChart)
Exchanged                            ← legend label (MonthlyMixChart)
```

### VolumeBarChart tooltip

```
{n} file · {label}
{n} files · {label}
```

### MonthlyMixChart tooltip

```
{month label}
{n} created
{n} exchanged
```

### Solicitor exchange performance section

```
Solicitor exchange performance
Average days from instruction to exchange · fastest first
← FLAG: long descriptor — review for voice pass
{n} exchange
{n} exchanges
{n} days
```

### Referral income — by firm (conveyancers)

```
Referral income · Conveyancers
All-time solicitor referral fees by firm
← FLAG: "All-time" heading is ambiguous when period is filtered
{n} referral
{n} referrals
{£X} received
{£X} pending
```

### Referral income — by firm (brokers)

```
Referral income · Brokers
All-time mortgage broker referral fees
← FLAG: same "all-time" ambiguity
{n} referral
{n} referrals
{£X} received
{£X} pending
```

### Referral income — period filtered

```
Referral income — this week          ← / this month / this year / all time
In pipeline
Active, pre-exchange
Exchanged — due
Payable on/after completion
{n} file
{n} files
{n} file · {m} without a fee recorded
{n} files · {m} without a fee recorded
```

### Files missing a fee section

```
Files missing a fee
Set the agent fee to include these files in your pipeline total.
← FLAG: imperative instruction — fine for descriptive text, verify voice
Show all                             ← MissingFeesList toggle
All files have fees set              ← empty state (with checkmark icon)
Set fee                              ← MissingFeeRow button
```

### MissingFeeRow fee editor

```
£                                    ← type toggle
%                                    ← type toggle
+ VAT
Inc VAT
Save
Cancel
```

### Files at risk section (FilesAtRiskPanel)

```
[Section heading — not confirmed; needs raw read of FilesAtRiskPanel.tsx]   ← TODO
Overdue chases
Stalled files
Missing event dates
✓ Clear
View
```

### Team leaderboard section

```
Team leaderboard
Performance by team member · this week    ← / this month / this year / all time
Submitted                            ← column header
Exchanged                            ← column header
Conversion                           ← column header
Pipeline Value                       ← column header
Avg Fee                              ← column header
Locked In                            ← column header
—                                    ← conversion when no data
```

### AnalyticsFilterClient

```
All team                             ← default option
{name}                               ← team member option
{name} (Director)                    ← director suffix
```

### AnalyticsNotifCta

```
✓ Alerts on                          ← subscribed state
[button label TBD — needs raw read]  ← TODO
```

---

## Section 8 — Desktop view

**Breakpoint:** ≥ 768px (md)
**Layout:** Single-column scroll within AgentShell; content max-width constrained by shell padding
**Navigation:** AgentShell sidebar visible; page occupies main content area

**Page-specific layout elements:**
- PageHeader row: title + subtitle left; team filter + push CTA right (directors only)
- Period tabs row: 4 pills (This week / This month / This year / All time) left-aligned below header
- Partial-empty banner (conditional): spans full width below tabs
- 3-column KPI row: Submitted · Exchanged · Completed, each with sparkline + count + DeltaPill
- 2-column row: SubmissionFunnel (left, ~60%) + SpeedGauge (right, ~40%)
- 2-column row: Values (left) · Fees (right)
- Full-width: Fee forecast
- 2-column row: VolumeBarChart (left) · MonthlyMixChart (right)
- Full-width: ValueHeatTiles (purchase price heatmap)
- Full-width: Solicitor exchange performance table (conditional)
- 2-column row: Referral conveyancers · Referral brokers (conditional, directors)
- Full-width: Referral income period (conditional)
- Full-width: Files missing a fee (conditional, expandable)
- Full-width: Files at risk panel
- Full-width: Team leaderboard (conditional, directors)

```
┌─────────────────────────────────────────────────────────────┐
│ Analytics                        [Filter: All team ▾] [🔔]  │
│ What's moving, what's stalling…                              │
├─────────────────────────────────────────────────────────────┤
│ [This week] [This month] [This year] [All time]              │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│ │  Submitted   │  │  Exchanged   │  │  Completed   │        │
│ │  ~~~sparkling│  │  ~~~spark    │  │  ~~~spark    │        │
│ │  42          │  │  17  ↑5      │  │  8           │        │
│ └──────────────┘  └──────────────┘  └──────────────┘        │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐  ┌─────────────────────┐      │
│ │  Conversion funnel        │  │  Speed to exchange  │      │
│ │  [Sub▶─48%─▶Exc▶─83%─▶Cmp│  │  ████░░ 74 days     │      │
│ └───────────────────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐  ┌──────────────────────┐      │
│ │  Pipeline value  £8.2m   │  │  Fee pipeline  £124k │      │
│ │  Value exchanged £2.1m   │  │  Locked in     £48k  │      │
│ │  ↑ £320k vs last month   │  │  Average fee   £7,100│      │
│ └──────────────────────────┘  └──────────────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  Fee forecast  Predicted for May 2026  £32,400              │
│  3 files · inc. VAT where set   Locked in already: £12,000  │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐  ┌──────────────────────┐      │
│ │ Files submitted (bars)   │  │ Monthly activity     │      │
│ │ ▁▃▅▇▆▂▄ (last 7 days)   │  │ ▂▃▅▇▆▄ created       │      │
│ └──────────────────────────┘  │ ▁▂▄▅▃▂ exchanged     │      │
│                                └──────────────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  [Value heatmap — 8 weeks of variable-height tiles]          │
├─────────────────────────────────────────────────────────────┤
│  Solicitor exchange performance  (table)  [conditional]      │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐  ┌──────────────────────┐      │
│ │ Referral · Conveyancers  │  │ Referral · Brokers   │      │
│ └──────────────────────────┘  └──────────────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  Referral income — this week  (conditional)                  │
├─────────────────────────────────────────────────────────────┤
│  Files missing a fee  (expandable list)  [conditional]       │
├─────────────────────────────────────────────────────────────┤
│  Files at risk  (3-category panel)                           │
├─────────────────────────────────────────────────────────────┤
│  Team leaderboard  (sortable table)  [directors only]        │
└─────────────────────────────────────────────────────────────┘
```

---

## Section 9 — Mobile view (375 px)

**Breakpoint:** < 768px (below md)
**Layout:** Single-column scroll; all two-column rows collapse to single column

### Confirmed mobile behaviours

- `LeaderboardTable`: switches from HTML table to card-based layout with sort `<select>` dropdown + direction toggle button
- `MissingFeeRow`: fee editor opens as a full-screen bottom sheet (`window.innerWidth < 768` check) instead of positioned popover
- `MonthlyMixChart`: Recharts `ResponsiveContainer` wraps the chart — will resize width, but fixed 9px bar width × 12 months × 2 series (24 bars) may cause crowding or wrapping at 375px — **Stage 2 decision required**
- `VolumeBarChart`: Recharts `ResponsiveContainer` — should resize; dynamic bar width (10–36px based on data length) gives some resilience
- `KpiSparkline`: 28px height, minimal chart — should render fine at any width

### Chart signal-type classification and mobile treatment

**Classification rule:**
- **PRIMARY** — agents use this to make decisions; must be usable on mobile. Hide-on-mobile is not acceptable.
- **REFERENCE** — background context, occasional scan; hiding on mobile is acceptable if the alternative would break readability.

**MonthlyMixChart purpose:** 12-month pipeline trend showing intake (files created) vs output (files exchanged) per month. The value is seeing the full annual arc — growth, decline, seasonality. All 12 months are needed for the trend to be meaningful; truncating to 6 months defeats the chart's purpose.

| Chart | Signal type | Reasoning | Mobile treatment |
|---|---|---|---|
| `VolumeBarChart` | REFERENCE | The KPI count card (Submitted) carries the primary signal; the bar breakdown adds temporal distribution that is useful at a desk, not on the move | **Hide on mobile** — count card is sufficient |
| `MonthlyMixChart` | REFERENCE | Strategic 12-month trend; not a daily decision tool. Horizontal scroll hides data and is excluded. Truncating to 6 months defeats the chart's purpose. Hiding is the correct call. | **Hide on mobile** — 24 bars at 9px fixed width overflow at 375px; reference classification makes this straightforward |
| `KpiSparkline` | REFERENCE | Trend context supporting the KPI count; the count is the primary signal | **Render as-is** — 28px height, no fixed widths; scales naturally at any width |
| `SubmissionFunnel` | PRIMARY | Directly answers "what is my conversion rate?" — actionable on mobile | **Must work at 375px** — Stage 2: set explicit `width: 100%` on SVG container; verify proportional bar widths scale correctly. If SVG does not reflow: fall back to a text-based layout (three numbers with conversion % between them as plain text rows) |
| `ValueHeatTiles` | REFERENCE | Value distribution context; the £ figure in the values card carries the primary signal | **Hide on mobile** |
| `SpeedGauge` | PRIMARY | Directly tells agents whether they are fast, typical, or slow — actionable on mobile | **Must work at 375px** — Stage 2: add `width: 100%` constraint on gauge track; verify marker position and zone labels remain readable at narrow width |

### Mobile layout sketch (375 px)

```
┌──────────────────────┐
│ Analytics       [🔔] │
│ What's moving…       │
├──────────────────────┤
│ [Week][Month][Year]  │
│ [All time]           │
├──────────────────────┤
│ ┌──────────────────┐ │
│ │   Submitted 42   │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │   Exchanged 17   │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │   Completed 8    │ │
│ └──────────────────┘ │
├──────────────────────┤
│ [Conversion funnel]  │  ← PRIMARY: must work
│ (stacked below)      │
│ [Speed gauge]        │  ← PRIMARY: must work
├──────────────────────┤
│ [Pipeline value]     │
│ [Fee pipeline]       │
├──────────────────────┤
│ [Fee forecast]       │
├──────────────────────┤
│ — VolumeBarChart     │  ← REFERENCE: hidden
│ — MonthlyMixChart    │  ← REFERENCE: hidden
│ — ValueHeatTiles     │  ← REFERENCE: hidden
├──────────────────────┤
│ [Solicitor table]    │
├──────────────────────┤
│ [Referral panels]    │
├──────────────────────┤
│ [Missing fees]       │
│ [Risk panel]         │
├──────────────────────┤
│ [Leaderboard cards]  │
└──────────────────────┘
```

---

## Section 10 — Animations/transitions already in place

| Element | Animation | Source |
|---|---|---|
| MissingFeeRow — row dismiss after save | Slide/fade exit | `MissingFeeRow.tsx` (client-side state; exact class TBD — needs raw read) |
| MissingFeesList — show/hide toggle | Currently unknown — no `agent-acc` pattern confirmed | `MissingFeesList.tsx` |
| MissingFeeRow — popover appearance | None confirmed; appears to render inline | `MissingFeeRow.tsx` |
| KpiSparkline | `animation={false}` — explicitly disabled in Recharts | `KpiSparkline.tsx` |
| LeaderboardTable — sort direction | No animation confirmed | `LeaderboardTable.tsx` |

Note: Recharts charts (VolumeBarChart, MonthlyMixChart) may have default entry animations unless explicitly disabled. `KpiSparkline` has `animation={false}`. Others not confirmed — Stage 2 should check.

---

## Section 10.5 — Global animation and interaction inheritance

### Animation classes (from `agent-system.css` / audit standards)

| Class | Required on | Current status | Action |
|---|---|---|---|
| `agent-acc` + `agent-acc-body` | MissingFeesList show/hide toggle | Unknown — likely plain JS show/hide | Replace with `agent-acc` accordion pattern in Stage 4 |
| `agent-dropdown-out` / `agent-dropdown-in` | Any dropdown (AnalyticsFilterClient uses native `<select>` — N/A) | N/A for native select | No action |
| Ghost opacity `0.35` | Zero-transaction empty state hero card | Unknown — needs raw read of empty state JSX | Verify in Stage 4 |

### Interactive-state classes

| Class | Required on | Current status | Action |
|---|---|---|---|
| `agent-segment-pill` | Period tabs (This week / This month / This year / All time) | Unknown — likely custom styled spans | Replace with `agent-segment-pill` in Stage 4 |
| `agent-hover-row` | MissingFeeRow in list | Unknown | Audit in Stage 4 |
| `agent-circle-btn` | No circle toggles on this page | N/A | — |
| `agent-link` | "All time →", "need fee →", "View" links in risk panel | Some likely have inline color styles | Audit in Stage 4 |
| `agent-glass` / `glass-card` | KPI cards, chart wrapper cards, section cards | Unknown — likely `glass-card` throughout | Standardise to `agent-glass` for section cards in Stage 4 |
| `agent-glass-strong` | Empty state (zero-transaction hero card) | Unknown | Verify in Stage 4 |
| `agent-btn` | "Save" button in MissingFeeRow | Likely custom styled | Replace with `agent-btn agent-btn-primary` in Stage 4 |
| Focus rings | Period tabs, leaderboard column headers, "Set fee" buttons, all interactive elements | Unknown — Recharts chart hover targets have no keyboard focus | Audit each interactive element in Stage 4 |
| `agent-acc-hdr:focus-visible` | Any accordion header | MissingFeesList toggle is a plain `<button>` | Ensure focus ring in Stage 4 |

**Chart colour tokenisation — Stage 2 will implement (high leverage):**

Recharts accepts colour via props (e.g. `fill="#FF6B4A"`, `stroke="#FF8A65"`). These are currently hardcoded strings that do not read CSS custom properties. This means theme switching and night mode do not propagate to chart colours.

Chart colours are either **semantic** (mapped to danger/warning/success/info) or **brand accent** (coral for "our files/data"). Mapping:

| Chart / element | Current value | Token mapping |
|---|---|---|
| VolumeBarChart bars | `#FF6B4A` | `--agent-coral` (brand) |
| MonthlyMixChart "Created" bars | `#FF6B4A` | `--agent-coral` (brand) |
| MonthlyMixChart "Exchanged" bars | `#F59E0B` | `--agent-warning` (semantic) |
| KpiSparkline default stroke | `#FF8A65` | `--agent-coral` (brand) |
| SubmissionFunnel: submitted | coral | `--agent-coral` |
| SubmissionFunnel: exchanged | warning | `--agent-warning` |
| SubmissionFunnel: completed | green | `--agent-success` |
| ValueHeatTiles: intensity fill | `rgba(255,107,74,…)` | `rgba(var(--agent-coral-rgb), …)` |
| SpeedGauge: fast zone | green | `--agent-success` |
| SpeedGauge: typical zone | orange | `--agent-warning` |
| SpeedGauge: slow zone | red | `--agent-danger` |

**Implementation — single utility function, used across all Recharts components:**

```tsx
function getThemeColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName).trim() || fallback;
}
```

Pass to Recharts props at render time. Re-compute on theme change via a `useEffect` keyed on a theme prop or event listener. Custom SVG/HTML charts (SubmissionFunnel, ValueHeatTiles, SpeedGauge) use `var(--token-name)` directly in inline styles.

Section 13 chart rows reflect this expectation. Stage 2 implements the helper function.

---

## Section 11 — Known edge cases

- **Long address strings in LeaderboardTable / MissingFeesList**: property addresses truncate inconsistently across layouts — verify truncation at both desktop and mobile
- **Very large transaction volumes**: LeaderboardTable renders all team rows without virtualisation; performance impact unknown beyond ~20 team members
- **MonthlyMixChart at mobile**: 12 months × 2 bar series × 9px fixed bar width ≈ 300px minimum — likely overflows at 375px
- **Solicitor exchange section with one solicitor**: section renders with single row; visual balance of table with one entry may look odd
- **Fee forecast month label**: `thisMonthLabel` — if `pageNow` crosses midnight during the request, the predicted-month label could be the previous month for the first few ms after midnight
- **brokerReferralStats silent error swallow**: `.catch(() => [])` hides any database error; if the query fails, the broker section silently disappears — no error state rendered
- **Director filtering to themselves**: `?user={ownUserId}` hides the leaderboard, so a director cannot see how they compare to the team when viewing their own stats
- **MissingFeeRow portal positioning**: popover uses `createPortal` to escape stacking contexts — if the page layout changes scroll container, the popover may misalign
- **KpiSparkline zero-data**: renders an invisible 28px spacer instead of the sparkline; the KPI card still shows the count but has an empty area where the sparkline would be — may look broken to users with no history
- **Period tab "All time" + no solicitors**: if solicitorStats is empty and period is "all", the solicitor section is absent — users may not know why

---

## Section 12 — Out of scope for redesign

- Push notification opt-in flow (`AnalyticsNotifCta`) — Notification API + service worker + VAPID key infrastructure
- `saveAgentFeeAction` server action and its database writes
- Analytics data computation logic in `lib/services/analytics.ts` — query structure, aggregation, bucket definitions
- Period URL-param persistence (`?period=week`) — routing concern
- Director drill-down URL param (`?user=<id>`) — routing concern
- PostHog analytics event in `AnalyticsFilterClient` — tracking hook
- Leaderboard sort persistence — currently ephemeral client state, intentional
- Data freshness / "As of" timestamp — managed by AgentShell, not this page
- `resolveAgentVisibility` / `buildTxWhere` security scoping

---

## Section 13 — Per-section visual specification

*Polish-page structure = what we build in Stage 2. Production component = what Stage 4 wires in. Visual parity gate: every entry in "Stage 4 changes required" must be verifiable against the polish page before sign-off.*

| Section | Polish-page structure | Production component(s) | Current state vs polish | Stage 4 changes required |
|---|---|---|---|---|
| Page header | `PageHeader` with title, subtitle; team filter `<select>` right; push CTA right | `PageHeader`, `AnalyticsFilterClient`, `AnalyticsNotifCta` | Likely already uses PageHeader; filter may use non-glass `<select>` | Apply `glass-input` to select; verify token alignment on filter label |
| Period tabs | Row of 4 `agent-segment-pill` pills; active pill distinct | AnalyticsClientShell period state | Likely custom styled spans; no `agent-segment-pill` class confirmed | Replace with `agent-segment-pill` pattern |
| Partial-empty banner | Amber-tinted `glass-card` or `agent-glass` surface; warning text; "All time →" `agent-link` | AnalyticsClientShell conditional | Unknown surface class | Verify surface token; ensure "All time →" uses `agent-link` |
| KPI count cards (×3) | `glass-card` surface; large count; `KpiSparkline` mini-chart below count; `DeltaPill` inline | `KpiSparkline`, `DeltaPill` | Surface class unknown; sparkline colour hardcoded | Verify `glass-card`; wire sparkline colour to token |
| Conversion funnel | `glass-card`; custom SVG funnel; stage labels; conversion % badges between stages; coral/warning/success stage colours | `SubmissionFunnel` | SVG colours hardcoded; stage colours inline | Stage 2: decide if colours should tokenise; Stage 4: apply tokens |
| Speed to exchange | `glass-card`; horizontal gradient gauge; zone labels below; circular marker | `SpeedGauge` | Custom HTML/CSS; colours inline | Verify day label; apply token colours to zones |
| Pipeline values | `glass-card`; two value rows (pipeline / exchanged); `DeltaPill` | AnalyticsClientShell | Surface unknown | Verify `glass-card`; token audit on value text colours |
| Fees | `glass-card`; fee pipeline / locked in / avg fee rows; noFee link uses `agent-link` | AnalyticsClientShell, MissingFeesList | Surface unknown; noFee link colour unknown | Verify surface; `agent-link` on "{n} need fee →" |
| Fee forecast | `glass-card` or `agent-glass`; single prominent forecast value; sub-row for "Locked in already" | AnalyticsClientShell | Surface unknown | Verify surface; token audit on forecast typography |
| Volume bar chart | `glass-card` wrapper; Recharts bar chart; bar colour `var(--agent-coral)`; subtle grid | `VolumeBarChart` | Bars use hardcoded `"#FF6B4A"` coral; grid uses inline stroke | Stage 4: pass `var(--agent-coral)` from JS context; verify grid token |
| Monthly activity chart | `glass-card` wrapper; grouped bar chart; "Created" coral + "Exchanged" warning; manual legend above | `MonthlyMixChart` | Colours hardcoded `"#FF6B4A"` / `"#F59E0B"` | Stage 4: wire to tokens; verify legend aligns with existing pattern |
| Value heatmap | `glass-card` wrapper; coral tiles with opacity intensity; week labels below | `ValueHeatTiles` | Coral uses `rgba(255,107,74,…)` hardcoded | Stage 4: replace with `rgba(var(--agent-coral-rgb), …)` |
| Solicitor exchange table | `glass-card`; clean list; firm name + exchange count + avg days badge; fastest-first order | AnalyticsClientShell inline JSX | Surface unknown; badge colours unknown | Verify surface; apply token to days badge |
| Referral income (firm tables ×2) | `glass-card`; firm name + count + received + pending per row | AnalyticsClientShell inline JSX | Surface unknown | Verify `glass-card`; token audit |
| Referral income (period) | `glass-card`; "In pipeline" + "Exchanged — due" rows; file counts | AnalyticsClientShell inline JSX | Surface unknown | Verify surface |
| Files missing a fee | `agent-glass` section card; `MissingFeesList` inside; `MissingFeeRow` with `agent-hover-row` | `MissingFeesList`, `MissingFeeRow` | Surface likely `glass-card`; show/hide may not use `agent-acc` | Replace `glass-card` → `agent-glass`; `agent-acc` for show/hide; `agent-hover-row` on rows; `agent-btn-primary` on Save |
| Files at risk | `agent-glass` section card; 3 rows (overdue/stalled/missing); `agent-link` on View | `FilesAtRiskPanel` | Surface unknown; View link colour unknown | Verify surface token; `agent-link` on View |
| Team leaderboard | `agent-glass` section card; desktop sortable table; mobile card + sort dropdown | `LeaderboardTable` | Surface likely `glass-card`; highlight row uses coral inline border | Verify surface; replace inline coral border with `var(--agent-coral)` token |
| Zero-transaction empty state | `agent-glass-strong`; centred; headline; CTA button | page.tsx server render | Surface unknown; CTA button class unknown | Replace surface with `agent-glass-strong`; ghost opacity 0.35 if any ghost elements |

---

## Section 14 — Amendments

| Date | Discovery | Added to |
|---|---|---|
| 2026-05-18 | Chart signal-type classification (PRIMARY / REFERENCE) resolved; mobile treatment decided per chart | Section 9 |
| 2026-05-18 | MonthlyMixChart purpose stated: 12-month annual trend — all 12 months required | Section 9 |
| 2026-05-18 | Chart colour tokenisation: `getThemeColor` helper approach; semantic + brand colour mappings per chart | Section 10.5 |
| 2026-05-18 | "All-time" referral section heading ambiguity: classified as THEORETICAL — logged to POST_LAUNCH_FIXES.md | docs/POST_LAUNCH_FIXES.md |

---

## Section 15 — Canonical contributions

*Only new classes/tokens introduced by this page's Stage 4 work. Nothing here until Stage 4 ships.*

### New canonical classes

| Class | Description | First use (file:line) |
|---|---|---|
| — | — | — |

### New canonical tokens

| Token | Value | First use (file:line) |
|---|---|---|
| — | — | — |
