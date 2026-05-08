# Analytics Page — Discovery Report

**Route:** `app/agent/analytics/page.tsx`  
**User-facing route:** `/agent/analytics`  
**Date:** 2026-05-08

---

## 1. What this page actually is

Analytics is the **agency-wide performance dashboard** for directors and negotiators. It shows how the pipeline is performing across volume, fees, value, conversion, and speed — for the selected time period. All period-sensitive stats are computed client-side from a single server fetch; changing the period does not trigger a new request.

**Page H1 (verbatim):** `Analytics` (`page.tsx` heading element)  
**Page subtitle (verbatim):** `Performance and revenue across your agency.` — or `Performance and revenue for [name].` when filtered to a specific team member

The page answers: how many files were submitted, exchanged, and completed in this period? What are the fees worth? How fast is the agency moving to exchange? Are there files at risk?

---

## 2. Page structure — top to bottom

Route component: `app/agent/analytics/page.tsx` — async Server Component (~198 lines).

### A. Page header (glassmorphism)

Elements in order:

1. **H1:** "Analytics"
2. **Subtitle:** period-sensitive: "Performance and revenue across your agency." / "Performance and revenue for [name]." when a `?user=` filter is active
3. **AnalyticsFilterClient** — director only; a `<select>` dropdown letting directors switch between "All team" and individual team members. Changing the selection triggers `router.push` with updated `?user=` param, which causes a server re-fetch (this is the ONE case where selecting a value causes a full server round-trip — the period toggle does not).
4. **Export CSV button** — director only; an `<a>` tag linking to `/api/agent/analytics-export?period=[period]&user=[userId]`. Downloads a `.csv` file named `analytics-[agency]-[period]-[date].csv`.
5. **AnalyticsNotifCta** — push notification opt-in button (hidden on mobile, appears in the period tab row on mobile). Checks `localStorage` for prior opt-in. Shows "Enable alerts" button → requests Notification permission → registers service worker → subscribes to `/api/agent/push-subscribe`. On success shows "✓ Alerts on" badge.

### B. Empty state — zero transactions

When `transactions.length === 0` on initial page load: bar chart SVG icon, "Analytics will appear here as you submit sales.", "Once your first file is submitted, you'll see pipeline value, fee tracking, conversion rates, and monthly trends.", and a "+ Submit your first sale" button linking to `/agent/transactions/new`.

### C. AnalyticsClientShell

All content below the header is delegated to `AnalyticsClientShell` at `components/agent/AnalyticsClientShell.tsx` (641 lines). This is a "use client" component. It receives all server-fetched data at mount and uses `useMemo` to recompute all period-sensitive stats on the client.

The shell renders 13 distinct sections in order (see §5).

---

## 3. The data behind the page

### Server fetches (page.tsx)

| Data | Function | Notes |
|---|---|---|
| `transactions` | `getAgentTransactions(vis)` | All transactions visible to the user. Large — includes all fields needed for client-side computation. |
| `solicitorStats` | `getSolicitorExchangeStats(vis)` | Solicitor firm performance. Uses VM19/PM26 as the exchange landmark (fixed before article writing — see §9). Always all-time, not period-sensitive. |
| `monthlyActivity` | `getMonthlyActivity(vis)` | 12-month bucket array: `{ month, created, exchanged }`. Uses VM19/PM26 for exchange count. Always 12 months — not period-sensitive. |
| `kpiSparklines` | `getKpiTrendsForAgency(vis, { start: new Date(0), end: pageNow })` | 8 weekly trailing buckets for submitted/exchanged/completed/submittedValue. Called with ALL-TIME range. Not period-sensitive. Excludes `reconciledAtExchange: true` transactions. Deduplicates per transaction. |
| `filesAtRisk` | `getFilesAtRisk(vis)` | Three counts: overdueChases, stalled, missingEventDate. Not period-sensitive. |
| `noFeeFiles` | Inline query in page.tsx | Active files where fee cannot be computed. Not period-sensitive. |

### Period filtering

All period-sensitive stats (submitted/exchanged/completed counts, values, fees, funnel, speed, referrals, leaderboard, bar chart) are computed **client-side** by filtering `transactions` by `createdAt` within the period window. `getAgentTransactions` fetches all transactions; the client does the windowing.

Period options (4):
- **This week** — last 7 rolling days (not Mon–Sun; `date.getDate() - 7`)
- **This month** — calendar month start to now
- **This year** — Jan 1 to now
- **All time** — no filter (all transactions)

Default period: `"month"`. Validated against `["week", "month", "year", "all"]` server-side; invalid values fall back to `"month"`.

### Visibility model

`resolveAgentVisibility` determines the visibility scope (agencyId-based). Directors with `canViewAllFiles` see all agency transactions; negotiators without that flag see only their own files. The `?user=` filter changes the visibility scope to a specific user's files (director-only; the filter client is only rendered for directors).

---

## 4. Period state and URL management

Period state lives in React state inside `AnalyticsClientShell`. Changing the period:
1. Calls `setPeriod(newPeriod)`
2. Updates the URL via `window.history.replaceState` — updates the address bar without navigation or re-fetch
3. The `?period=` param is omitted from the URL when the period is `"month"` (the default)

This means the URL reflects the current period (shareable/bookmarkable) but no server round-trip occurs on period change. Contrast with the `?user=` filter, which uses `router.push` and triggers a full server re-fetch.

---

## 5. The 13 sections (render order)

### Section 1 — Period tabs

Four pill buttons: "This week" / "This month" / "This year" / "All time". Active pill: coral background + outline. On mobile, the `AnalyticsNotifCta` appears here (right-aligned).

### Section 2 — Partial empty state banner

Shown only when `periodTx.length === 0 && period !== "all"`. Coral-tinted banner: "No activity this [week/month/year]. Try changing the period." with an "All time →" shortcut button.

### Section 3 — Counts (Submitted / Exchanged / Completed)

Three-column glass card. Each column shows:
- Eyebrow label ("Submitted" / "Exchanged" / "Completed")
- Large number (26px, bold, coral / success green / primary)
- Conversion rate note (exchanged: "N% of submitted"; completed: "N% of exchanged") — only shown when denominator > 0
- `KpiSparkline` — 8-week trailing sparkline line chart. **Not period-sensitive.** Uses server-fetched `kpiSparklines` data, which covers all time. Color: coral (submitted), success green (exchanged), secondary (completed).
- `DeltaPill` — period-over-period comparison pill (e.g. "↑ 3 vs last month"). Only shown when `showDelta` is true (i.e. period is not "all" AND there is history before the current period window).

### Section 4 — Conversion funnel + Speed to exchange

Two-column grid (stacked on mobile). Only shown when `periodTx.length > 0`.

**Left — Conversion funnel (`SubmissionFunnel`):**  
Three-stage horizontal bar chart: Submitted → Exchanged → Completed. Bars are proportional to stage counts (max stage = full width). Between stages: a conversion percentage pill (green ≥50%, amber <50%).

**Right — Speed to exchange:**  
Average days from file creation (`createdAt`) to exchange (`exchangedAt`). Computed client-side. Only files where `hasExchanged` AND `exchangedAt` is not null AND the exchange date falls within the period window are included. Shows: large day count, "avg from instruction · N files exchanged", a Fast/Typical/Slow badge, and the `SpeedGauge` component.

Speed thresholds (hardcoded): Fast ≤70 days (green), Typical 71–100 days (amber), Slow >100 days (red). If no exchanges in period: "No exchanges [period]".

### Section 5 — Values (Pipeline value / Value exchanged)

Two-column glass card.

**Left — Pipeline value:** Sum of `purchasePrice` for all period transactions (inc. pre- and post-exchange). 8-week `ValueHeatTiles` bar — relative height tiles, proportional to weekly submitted value. Tooltip on hover.

**Right — Value exchanged:** Sum of `purchasePrice` for exchanged files only. Period-over-period value delta (↑/↓ vs previous period) shown when `showDelta` is true.

### Section 6 — Fees (Fee pipeline / Locked in / Average fee)

Three-column glass card. Fee computation: uses `agentFeeAmount` if set; else derives from `agentFeePercent × purchasePrice`. Then applies VAT: if `agentFeeIsVatInclusive` is true, uses as-is; otherwise multiplies by 1.2. Files with no computable fee are excluded from all fee totals.

- **Fee pipeline:** Sum of all computable fees (inc. VAT) for period transactions. "N need fee →" anchor link to `#missing-fees` section if any active files have no fee.
- **Locked in:** Sum of fees for exchanged files only.
- **Average fee:** Mean fee per file (inc. VAT).

All shown as "—" if no fee data exists.

### Section 7 — Fee forecast

Always shows **current calendar month** regardless of selected period. Two columns:
- **Predicted for [Month Year]:** Fees from active, pre-exchange files whose `expectedExchangeDate` falls within the current calendar month. Shows total amount if fees are set; "No exchanges predicted this month" if none qualify; "N files predicted — set fees to see amount" if files exist but no fees are set.
- **Locked in already:** Same `lockedFeePence` value as Section 6's "Locked in" — fees from files that have already exchanged.

### Section 8 — Charts

Two-column grid (stacked on mobile).

**Left — Volume bar chart (`VolumeBarChart`):**
Period-sensitive. Title changes with period:
- "This week" → "Files submitted — last 7 days" (7 daily bars, label: "Mon 5" style)
- "This month" → "Files submitted — last 6 months" (6 monthly bars)
- "This year" / "All time" → "Files submitted — last 12 months" (12 monthly bars)

Bar color: coral, opacity 0.85 when count > 0 / 0.20 when empty.

**Right — Monthly activity chart (`MonthlyMixChart`):**
**Not period-sensitive.** Always 12 months from server data (`monthlyActivity`). Two bar series side-by-side: "Created" (coral) and "Exchanged" (amber). Legend shown top-right.

### Section 9 — Solicitor exchange performance

Conditional: only shown when `solicitorStats.length > 0`. Not period-sensitive — uses server-fetched data.

Header: "Solicitor exchange performance" / "Average days from instruction to exchange · fastest first"

One row per solicitor firm. Each row: firm name, exchange count, average days to exchange, Fast/Typical/Slow badge (same thresholds as speed section).

The metric uses VM19/PM26 (exchange of contracts) as the exchange landmark — matching the landmark used by `getMonthlyActivity`, `getKpiTrendsForAgency`, and `getFilesAtRisk`. Each solicitor row shows average days from file `createdAt` to the VM19/PM26 completion date.

### Section 10 — Referral income

Conditional: only shown when `referredTxs.length > 0` (i.e. the agency has at least one transaction with a `referredFirmId` set in the selected period). Period-sensitive.

Two-column grid:
- **In pipeline:** Sum of `referralFee` for active pre-exchange referred files. Shows "N files · N without a fee recorded" if any have no referral fee.
- **Exchanged — due:** Sum of `referralFee` for exchanged/completed referred files. Payable on/after completion.

### Section 11 — Files missing a fee

Always rendered (not conditional). Panel with `id="missing-fees"` anchor. Header: "Files missing a fee". Not period-sensitive — uses server-fetched `noFeeFiles` (active files only).

Shows `MissingFeesList`: first 3 files visible by default with "Show all (N)" expand button. Each row: property address, owner/progressor line, "Set fee →" button (opens an inline popover on desktop / bottom sheet on mobile with fixed-amount or percentage fee entry + VAT toggle), "View file →" link. Saving the fee calls `saveAgentFeeAction` server action and triggers `router.refresh()`.

Empty state: "✓ All files have fees set."

### Section 12 — Files at risk

Always rendered. `FilesAtRiskPanel` component. Not period-sensitive — server-fetched `filesAtRisk`. Three rows:

| Row | Label | Sublabel | Link |
|---|---|---|---|
| Overdue chases | "Overdue chases" | "Pending chase tasks past their due date" | `/agent/work-queue` |
| Stalled files | "Stalled files" | "No milestone activity in the last 14 days" | `/agent/work-queue` |
| Missing event dates | "Missing event dates" | "Completed milestones without a required date" | `/agent/dashboard` |

Each row: count badge (red) + "View →" link when count > 0; "✓ Clear" green badge when count is 0. Panel header shows total issue count badge when any > 0.

Stall threshold: 14 days of no milestone activity, file must be at least 7 days old.

### Section 13 — Team leaderboard

Conditional: only shown when `isDirector && !filterUserId && team.length > 1`. Period-sensitive.

Header: "Team leaderboard" / "Performance by team member · [period]"

Table with 6 sortable columns (default sort: Exchanged ↓):

| Column | Value |
|---|---|
| Submitted | File count for the period |
| Exchanged | Exchanged file count |
| Conversion | % of submitted that exchanged (null shown as "—") |
| Pipeline | Purchase value of active pre-exchange files |
| Avg fee | Mean fee (inc. VAT) per file |
| Locked in | Sum of fees for exchanged files |

Each row is clickable — navigates to `/agent/analytics?user=[id]` (and `&period=[period]` if not "month"), filtering to that team member. First row gets coral left border + coral tint background (visually highlighted as top performer for the current sort). "(you)" label appended to the current user's row. Mobile: card layout with sort dropdown + direction toggle.

---

## 6. Role and visibility differences

| Role | Filter client | Export CSV | Leaderboard | Data scope |
|---|---|---|---|---|
| Director (canViewAllFiles) | ✓ Shown | ✓ Shown | ✓ Shown | All agency files |
| Director (own files only) | ✓ Shown (self + team) | ✓ Shown | ✓ Shown | Own files only |
| Negotiator | ✗ Not shown | ✗ Not shown | ✗ Not shown | Own files only |

The `?user=` filter is director-only. When a director filters to a specific team member, the subtitle changes ("for [name]"), the leaderboard is suppressed (`filterUserId` is set), and the Export CSV downloads data for that user only.

Negotiators see the same page layout and all 13 sections, but only for their own files. The page heading and subtitle do not change for negotiators.

---

## 7. Export CSV — what it contains

Route: `GET /api/agent/analytics-export` — director only (403 for other roles).

Params: `?period=` (week/month/year/all), `?user=` (optional user filter).

The CSV is a **summary report**, not a row-per-transaction export. Sections:

1. **Header block:** Agency name, period label, generated date/time
2. **OVERVIEW:** Files submitted, exchanged, completed, pipeline value, value exchanged
3. **FEES:** Total fee pipeline, fees locked in, average fee, files missing a fee count
4. **FILES MISSING A FEE** (conditional): one row per active file with no computable fee — address, owner name (abbreviated first + last initial), role
5. **REFERRAL INCOME** (conditional): in pipeline amount, exchanged-due amount

Filename: `analytics-[agency-slug]-[period-slug]-[YYYYMMDD].csv`

Period filtering for the export mirrors the client-side logic exactly (filters by `createdAt` within the period window).

---

## 8. Empty and edge states

| Condition | What the user sees |
|---|---|
| No transactions at all | Full empty state: bar chart icon, explanation text, "+ Submit your first sale" button |
| Period has no activity (not "all") | Banner: "No activity this [week/month/year]. Try changing the period." + "All time →" button; sections still render with zeros |
| No exchanges in period | Speed to exchange: "No exchanges [period label]"; funnel still shows submitted/completed counts |
| No fees set anywhere | Fee section shows "—" for all three values; missing fees panel shows all active files |
| All fees set | Missing fees panel: "✓ All files have fees set." |
| No solicitor data | Solicitor exchange performance section omitted entirely |
| No referrals | Referral income section omitted entirely |
| Director viewing own team, only 1 member | Leaderboard omitted |
| Director with `?user=` filter active | Leaderboard omitted; filter client still shown |
| No push notifications API key | AnalyticsNotifCta hidden (permission check fails silently) |

---

## 9. Solicitor performance metric — fix applied before article writing

During discovery, `getSolicitorExchangeStats` was found to use **VM12 / PM16** ("Formal mortgage offer received") as its exchange landmark instead of VM19 / PM26 (exchange of contracts). The numbers produced were systematically lower than actual exchange duration.

This was fixed on branch `feature/analytics-solicitor-fix-and-article` before article writing. The function now uses VM19/PM26 — matching the landmark used by every other exchange-measuring function in `lib/services/analytics.ts`.

**Corrected behaviour:** The metric measures average days from file `createdAt` to the date VM19 or PM26 was confirmed complete (whichever applies to the transaction type). This is the same definition of "exchange" used by the KPI sparklines, monthly activity chart, and the files-at-risk stalled check.

**Relationship to Speed to exchange:** Both sections now use VM19/PM26 as the exchange definition, but they are computed differently and aggregate differently:

- **Speed to exchange** (Section 4 in the shell) — client-side. Computes days from `createdAt` to `exchangedAt` per transaction, then averages across files in the selected period. Uses the pre-computed `exchangedAt` field on the `Tx` type, not a direct milestone lookup.
- **Solicitor exchange performance** (Section 9 in the shell) — server-side. Queries milestone completions for VM19/PM26, groups by solicitor firm (both vendor and purchaser sides), and averages per firm across all time (not period-sensitive).

The article should describe both accurately. They measure the same underlying event (exchange) but the speed gauge gives the agency-wide average for the selected period; the solicitor table gives per-firm averages regardless of period.

---

## 10. Navigation context

**How users arrive at Analytics:**
- Sidebar link — "Analytics" is a primary nav item in `AgentShell`
- No inbound links from the Hub or All Files pages
- Director can navigate between user views via the leaderboard (clicking a row) or the filter client

**Where Analytics links out to:**
- Files at risk panel → "View →" links to `/agent/work-queue` (overdue chases, stalled) and `/agent/dashboard` (missing event dates)
- Missing fees section → "View file →" links to `/agent/transactions/[id]`
- Fee forecast → "#missing-fees" anchor link within the same page
- Leaderboard rows → `/agent/analytics?user=[id]` (same page, different filter)
- Export CSV → `/api/agent/analytics-export` (file download)

---

## 11. Naming and framing decisions

**"Submitted"** — used consistently throughout to mean a file has been created (a sale has been registered). Not "instructions received" or "file opened." The page uses "submitted" and the `createdAt` date as the anchor for all period filtering.

**"Locked in"** — fees from exchanged files. Used in both the Fees section and the leaderboard column. Contracts are exchanged = fee is now contractually due.

**"Fee pipeline"** — sum of all fees (including pre-exchange files). Distinct from "locked in."

**"Fee forecast"** — the current month's predicted fee income based on expected exchange dates. Always current calendar month regardless of the period tab selected. Not period-sensitive by design: the question is always "what am I expecting this month?"

**"Conversion funnel"** — Submitted → Exchanged → Completed. Percentages are: (exchanged / submitted) and (completed / exchanged). These are point-in-time ratios from the selected period's data, not cohort-tracked conversions.

**"Files at risk"** — the three signal types are not about deal quality; they are operational signals: administrative tasks overdue, files without recent milestone activity, and milestone data gaps. The section is present regardless of period — it always reflects current state.

**Period labels on the page:** "This week" / "This month" / "This year" / "All time". In-sentence: lowercase versions ("this month", "all time").

**"Speed to exchange"** and **"Solicitor exchange performance"** both measure exchange speed against the same underlying event (VM19/PM26 confirmed), but they differ in how they compute and aggregate. Speed is the agency-wide average for the selected period, computed client-side from `createdAt → exchangedAt`. Solicitor performance is per-firm, server-computed, not period-sensitive, and groups each transaction under both its vendor solicitor and purchaser solicitor firms. The two figures will differ because they aggregate over different scopes and time windows. The article should describe both clearly and distinguish them without implying one is "right" and the other "wrong".
