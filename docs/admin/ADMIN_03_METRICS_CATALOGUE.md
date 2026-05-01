# ADMIN_03 — Metrics Catalogue

**Audience:** Claude Code + you (for sanity-checking definitions)
**Status:** Updated post-discovery (2026-05-01) — SP/PM split model revised for mixed agencies
**Depends on:** ADMIN_02 (provides `Event`, `OutboundMessage`, `DailyMetric`, `WeeklyCohort`)
**Read alongside:** ADMIN_01 (which tab each metric appears on)

---

## 1. How to read this doc

Every metric the command centre displays is defined here, exactly once. Each entry has:

- **Name** — the display label
- **Definition** — what it measures, in plain English
- **Query source** — which table(s) the number is computed from
- **Refresh cadence** — live / 5min / hourly / nightly
- **SP/PM split** — yes/no, and which dimension (see §1a below)
- **Where shown** — which tab(s)
- **Edge cases** — what to do with nulls, ties, zero-divisor

If a metric is not in this doc, it does not appear on the page. Adding new metrics requires updating this doc first.

---

## 1a. SP/PM split — two dimensions, not one

Per ADMIN_02 §2, agencies can mix modes. A single agency may have both self-progressed and progressor-managed transactions on the same day. So "split by SP/PM" means one of two things, depending on what's being measured:

- **Transaction-level split — `serviceType`**: For metrics that count things that happen *to a transaction* (milestones confirmed, chases sent, exchanges, completions, AI drafts generated for a transaction). These split on `PropertyTransaction.serviceType`. An agency with mixed transactions appears in BOTH the SP and PM views.
- **Agency-level split — `modeProfile`**: For metrics that count things that happen *to an agency* (signups, logins, leaderboard rank, cohort retention). These split on `Agency.modeProfile`. An agency appears in exactly one view (SP-predominant, PM-predominant, mixed, or no-recent-activity).

Each metric below specifies which dimension applies.

The page-level SP/PM toggle (ADMIN_01 §5.2) hides metrics from the other slice. Combined view shows everything; SP-only view hides metrics whose split is set to PM and vice versa.

---

## 2. Definitional defaults (your decisions from ADMIN_01 §8)

The following defaults are used throughout this doc until you confirm otherwise:

- **"Active user" =** a user who, in the period in question, logged in OR confirmed a milestone OR sent a chase
- **"Active agency" =** an agency with at least one active user in the period
- **"Stuck transaction" =** a transaction where no milestone has been confirmed or marked not-required for ≥ 14 days, AND status is not `completed`, `withdrawn`, or `on_hold`
- **Time zone** for daily/weekly buckets: Europe/London
- **Week start:** Monday
- **Month start:** 1st of calendar month

If you change any of these in ADMIN_01 §8, every metric definition below that uses them updates automatically.

---

## 3. Overview tab metrics

### 3.1 Active agencies (last 7d)

- **Definition:** Count of distinct agencies with ≥ 1 active user in the past 7 days
- **Query source:** `Event` where `type IN (user_logged_in, milestone_confirmed, chase_sent)` AND `occurredAt >= NOW() - 7d`, grouped by `agencyId`, joined to `Agency.modeProfile`
- **Refresh:** 5 min
- **SP/PM split:** Yes — by `Agency.modeProfile` (agency-level metric)
- **Where shown:** Overview headline number
- **Edge cases:** Agency with `modeProfile = no_recent_activity` → still counted as active if it has events in last 7d (the profile lags activity by up to 24h)
- **Sparkline:** Same metric computed for each of the trailing 30 days, read from `DailyMetric.uniqueActiveUsers > 0` rolled up to agency level

### 3.2 Activity pulse (24h heat strip)

- **Definition:** For each of the last 24 hours, count events of each type (logins, milestone confirms, chases sent)
- **Query source:** `Event` grouped by `date_trunc('hour', occurredAt)` and `type`, filtered to last 24h
- **Refresh:** Live (30s polling)
- **SP/PM split:** Yes (separate strip per mode in split view)
- **Where shown:** Overview
- **Display:** 24 cells per row, coloured by intensity. Colour scale = relative to max in that 24h window per metric

### 3.3 Today's deltas

A card with four sub-metrics. All for "today" defined as Europe/London midnight to now.

| Sub-metric | Definition | Source |
|---|---|---|
| Signups today | New `Agency` rows where `signupAt::date = today` | `Agency` |
| Transactions opened today | `Event.type = transaction_created` today | `Event` |
| Transactions exchanged today | `Event.type = contracts_exchanged` today | `Event` |
| Transactions completed today | `Event.type = sale_completed` today | `Event` |

- **Refresh:** Live (30s)
- **SP/PM split:** Yes
- **WoW delta:** compare to same 7d-ago weekday-of-week, not to yesterday. Express as ±N% with arrow

### 3.4 Stuck transactions

- **Definition:** Count of transactions where the latest `milestone_confirmed` or `milestone_marked_not_required` event was ≥ 14 days ago, AND status NOT IN (`completed`, `withdrawn`, `on_hold`)
- **Query source:** `PropertyTransaction` LEFT JOIN latest `Event` of relevant types, filtered
- **Refresh:** Hourly
- **SP/PM split:** Yes
- **Where shown:** Overview headline + drill-down list
- **Edge cases:** Brand-new transactions with no milestone events yet — count as stuck if `createdAt` is ≥ 14d ago. Treat "no milestone yet" as a milestone event with `occurredAt = createdAt`.

### 3.5 Anomaly strip

A computed list of "things looking off." Each anomaly is a function returning either `null` (nothing wrong) or `{ severity, message, drillDownUrl }`.

Anomalies for v1:

| Anomaly | Trigger |
|---|---|
| Chase send rate down ≥ 30% vs trailing-7d avg | last 24h `chases_sent` / trailing 7d daily avg < 0.7 |
| Signup conversion below 30% (last 24h) | `Event.user_invited` → `Event.user_accepted_invite` ratio in last 24h < 30% |
| AI spend tracking ≥ 15% over forecast | month-to-date `aiSpendCents` / (budget × fraction-of-month-elapsed) ≥ 1.15 — only fires if budget set |
| N agencies with zero activity in 14 days | count agencies with no events in last 14d, surface if > 0 |
| Error rate spike | (requires error monitoring — see ADMIN_01 §4.6) |
| AI generation failure rate spike | last 24h `OutboundMessage.failed` where `isAiGenerated = true` / total AI generations > 5% |

- **Refresh:** 5 min
- **SP/PM split:** No (anomalies are global; can be SP- or PM-specific in their message)
- **Where shown:** Overview anomaly strip
- **Display:** Each anomaly is a small badge with severity colour (info / warn / crit). Click → drill-down

---

## 4. Growth tab metrics

### 4.1 Funnel stages

Each stage is a count of agencies that have crossed it. Cumulative, lifetime.

| Stage | Definition |
|---|---|
| Visitors | (Requires analytics tool — see §8) |
| Signup started | `Event.type = user_invited` distinct `agencyId` (or, for self-serve, distinct visitor that began signup) |
| Signup completed | `Agency` row exists with `signupAt` set |
| First transaction created | Distinct `agencyId` with ≥ 1 `transaction_created` event |
| First milestone confirmed | Distinct `agencyId` with ≥ 1 `milestone_confirmed` event |
| Active week 2 | Agencies with ≥ 1 active event in the second week after signup |
| Active week 4 | Agencies with ≥ 1 active event in the fourth week after signup |
| Active week 12 | Agencies with ≥ 1 active event in the twelfth week after signup |

- **Query source:** `Agency` + `Event`
- **Refresh:** Hourly
- **SP/PM split:** Yes (side-by-side funnels)
- **Conversion %:** Stage N / Stage N-1
- **Median time to next stage:** `percentile_cont(0.5)` of `(occurredAt of stage N+1) - (occurredAt of stage N)` for agencies that crossed both

### 4.2 Cohort retention table

- **Definition:** For each weekly cohort (rows), what % were active in week 1, 2, 4, 8, 12 (columns)
- **Query source:** `WeeklyCohort` (read directly — already pre-computed)
- **Refresh:** Nightly (rollup job)
- **SP/PM split:** Yes (separate table per mode, or overlaid heatmaps)
- **Display:** Heatmap. Cell colour = % retention. Hover shows absolute counts.

### 4.3 Per-agency leaderboard

Sortable table. Columns:

| Column | Definition | Sort default |
|---|---|---|
| Name | `Agency.name` | — |
| Mode | `Agency.modeProfile` | — |
| Signed up | `Agency.signupAt` | desc |
| Users | count of `User` where `agencyId =` | — |
| Transactions (lifetime) | count of `PropertyTransaction` | — |
| Transactions (30d) | count of `PropertyTransaction` where `createdAt >= now()-30d` | — |
| Exchanged (lifetime) | count of `Event.contracts_exchanged` | — |
| Exchanged (30d) | same, last 30d | — |
| Last activity | most recent `Event.occurredAt` for this agency | desc |
| Health score | see §4.4 | — |

- **Refresh:** Hourly
- **SP/PM split:** Filterable, not split (it's one table)

### 4.4 Health score

A 0–100 composite per agency. Designed to make "who needs attention" obvious.

```
score = 0.4 × recency_score
      + 0.3 × volume_score
      + 0.2 × outcome_score
      + 0.1 × engagement_score
```

| Component | 0–100 mapping |
|---|---|
| `recency_score` | 100 if active today, linearly down to 0 at 30 days inactive |
| `volume_score` | log-scaled active transactions (1 = 30, 5 = 60, 20+ = 100) |
| `outcome_score` | exchanges / (active transactions + exchanges) over last 90d, × 100 |
| `engagement_score` | distinct users active in last 7d / total users, × 100 |

- **Refresh:** Nightly
- **SP/PM split:** Score weights identical for both modes; PM agencies trend higher on `engagement_score` because internal users count
- **Edge cases:** Brand-new agency (< 7 days old) → score capped at 50, badge "new" shown

### 4.5 Acquisition source breakdown

- **Definition:** Pie / table of `Agency.signupSource` with counts and conversion rates per source
- **Query source:** `Agency` grouped by `signupSource`
- **Refresh:** Hourly
- **SP/PM split:** Yes
- **Display:** Pie chart of signup volume + table with: source, signups, → first transaction %, → exchanged %
- **Edge cases:** `null` source → "Direct / unknown"

---

## 5. Activity tab metrics

### 5.1 Live activity feed

- **Definition:** Reverse-chronological list of all `Event` rows in last 24h
- **Query source:** `Event` ORDER BY `occurredAt DESC` LIMIT 200
- **Refresh:** Live (30s, when tab focused; pause when blurred)
- **SP/PM split:** Filterable
- **Display:** Each row: relative timestamp, agency name, user name (or "system"), event type as readable label, optional one-line context from `metadata`
- **Filter controls:** Event type multi-select, agency filter, free-text search of agency / user / transaction

### 5.2 Activity heatmap (24h × 7d)

- **Definition:** Count of `Event` rows bucketed by hour-of-day × day-of-week, last 4 weeks
- **Query source:** `Event` grouped by `extract(dow from occurredAt)`, `extract(hour from occurredAt)`
- **Refresh:** Hourly
- **SP/PM split:** Two heatmaps side by side (when split view active)
- **Display:** 7 rows (Mon-Sun) × 24 columns (00-23), cell colour by count
- **Edge cases:** Time zone — bucket using Europe/London local time, not UTC

### 5.3 Per-event-type trend cards

One small chart card per event type. Each shows daily count for last 30 days.

| Card | Event type |
|---|---|
| Logins | `user_logged_in` |
| Milestone confirms | `milestone_confirmed` |
| Chases sent | `chase_sent` |
| AI drafts generated | `chase_message_generated` |
| Files uploaded | `file_uploaded` |
| Transactions created | `transaction_created` |
| Exchanges | `contracts_exchanged` |
| Completions | `sale_completed` |

- **Query source:** `DailyMetric` (each is a column there)
- **Refresh:** Hourly (read from rollup; today's row updated by 5-min job)
- **SP/PM split:** Yes (two lines per chart)

### 5.4 Per-user activity table

| Column | Definition |
|---|---|
| User | `User.name` |
| Agency | joined |
| Mode | `Agency.modeProfile` |
| Last login | most recent `user_logged_in` event |
| Sessions (7d) | count of `user_logged_in` last 7d |
| Milestones (7d) | count of `milestone_confirmed` last 7d |
| Chases (7d) | count of `chase_sent` last 7d |
| Files (7d) | count of `file_uploaded` last 7d |

- **Refresh:** Hourly
- **SP/PM split:** Filterable column
- **Default sort:** Last login asc (so users gone quiet bubble to top)

---

## 6. Health tab metrics

### 6.1 Error rate

- **Definition:** Errors per 1k requests, last 24h vs trailing 7d avg
- **Query source:** Error monitoring tool (TODO — TBD which one)
- **Refresh:** 5 min
- **SP/PM split:** No (infra metric)
- **Status if not wired:** Card shows "Error monitoring not configured. See ADMIN_02 open item #7."

### 6.2 Slow queries

- **Definition:** Top 20 endpoints by p95 latency in last 24h
- **Query source:** Vercel logs / APM tool
- **Refresh:** Hourly
- **Status if not wired:** Card shows "Latency tracking not configured."

### 6.3 AI spend

- **Definition:** Anthropic API spend, today / this week / this month
- **Query source:** `OutboundMessage` summed by `aiTokensInput * input_price + aiTokensOutput * output_price` for the model used. Pricing constants in `lib/command/ai-pricing.ts`, updated when Anthropic changes pricing.
- **Refresh:** 5 min
- **SP/PM split:** Yes (which agency drove the spend)
- **Display:** Three big numbers (today / week / month) + breakdown by flow (chase generation / email parsing / LinkedIn drafts)
- **Forecast vs budget:** If `ADMIN_AI_BUDGET_MONTHLY_USD` env var set, show "£X / £Y, on track / over by Z%"
- **Edge cases:** Pricing changed mid-month → use the price effective at the time of each token. Store the price in `OutboundMessage.aiCostCents` at write time, not derived on read.

### 6.4 Email deliverability

- **Definition:** Sent / delivered / bounced / spam-marked counts, last 7 days, with rates
- **Query source:** `OutboundMessage` where `channel = 'email'`, status counts
- **Refresh:** 5 min
- **Requires:** SendGrid event webhook (per ADMIN_02 §4)
- **SP/PM split:** Yes

### 6.5 Storage usage

- **Definition:** Total bytes in Supabase Storage `transaction-documents` bucket; growth rate; top 10 agencies by storage
- **Query source:** Supabase Storage API (no built-in size; computed by listing + summing — cache aggressively)
- **Refresh:** Daily
- **SP/PM split:** Yes (per-agency rollup)

### 6.6 Database row counts

- **Definition:** Approximate row counts for largest tables, plus growth rate (rows/day, last 7d avg)
- **Query source:** `pg_stat_user_tables.n_live_tup` for fast approximate counts; `DailyMetric` for growth
- **Refresh:** Daily
- **SP/PM split:** No

### 6.7 Background jobs

- **Definition:** Last run timestamp, success/fail status, duration of every scheduled job
- **Query source:** A new `JobRun` table (write-only from each job at start + end). Schema:
  ```prisma
  model JobRun {
    id         String   @id @default(cuid())
    jobName    String
    startedAt  DateTime
    endedAt    DateTime?
    status     String   // running | success | failed
    error      String?
    @@index([jobName, startedAt])
  }
  ```
- **Refresh:** 1 min
- **SP/PM split:** No

---

## 7. Outbound Log metrics

Covered in ADMIN_04. The catalogue here defines only the headline numbers shown on the tab, not the search/filter UI.

| Metric | Definition | Source |
|---|---|---|
| Total messages today | count `OutboundMessage` `createdAt::date = today` | `OutboundMessage` |
| Sent today | count where `sentAt::date = today` | `OutboundMessage` |
| AI-generated today | count where `isAiGenerated = true` and `createdAt::date = today` | `OutboundMessage` |
| Awaiting approval | count where `requiresApproval = true` and `approvedAt IS NULL` and `status != 'cancelled'` | `OutboundMessage` |
| Failed (24h) | count where `failedAt >= now() - 24h` | `OutboundMessage` |

All five: 5-min refresh, SP/PM split.

---

## 7a. Activation tab metrics

The Activation tab (ADMIN_01 §4.4) is the win-or-lose page. Drop-off is the lead, not conversion.

### 7a.1 Drop-off chain

For each step in the activation sequence, compute:

- Entries: count of agencies that reached this step
- Completions: count that completed it
- Drop rate = (entries − completions) / entries
- Median time at step (for those who completed)
- Median time at step (for those who abandoned, where determinable)

The biggest drop in the chain is auto-flagged as "biggest leak."

- **Query source:** `Event` for step entries/completions, joined on agency
- **Refresh:** Hourly
- **SP/PM split:** Yes (separate chains)
- **Sample-size guard:** Below 30 entries to a step, percentages aren't displayed — only counts

Step definitions are stored in `lib/command/activation-steps.ts` and version-controlled. Initial sequence:

1. Signup completed (`Event.user_logged_in` first occurrence per agency)
2. First user invited (or solo confirmed)
3. First transaction created
4. First contact added
5. First milestone confirmed
6. First chase sent
7. First exchange-blocking milestone confirmed

### 7a.2 First-action retention correlation

For each candidate first-action behaviour (e.g. "sent first chase within 24h"), compute:

- Cohort A: agencies that did the action
- Cohort B: agencies that didn't
- Retention rate at week 4 for each
- Effect size (A retention / B retention)
- Statistical significance (chi-square or Fisher's exact for small samples)

- **Query source:** `Event` + `WeeklyCohort`
- **Refresh:** Nightly
- **Sample-size guard:** Both cohorts ≥ 20; otherwise card shows "insufficient data"
- **Confidence:** Surfaces in ADMIN_07 §3 catalogue as `cohort_pattern` signal type
- **SP/PM split:** Yes (different first-actions matter for each mode)

### 7a.3 Time-to-X percentiles

Median, p25, p75 for time from signup to:
- First sale added
- First solicitor added
- First milestone confirmed
- First exchange

- **Query source:** `Event` window functions
- **Refresh:** Daily
- **SP/PM split:** Yes
- **Display:** Box-and-whisker per metric, with target line if set

---

## 7b. Retention tab metrics

### 7b.1 Power user fingerprint

For top decile of users by activity score (last 30d), identify behavioural patterns that distinguish them from the bottom 50%.

Patterns evaluated:
- Use of specific features (email parse, AI chase generation, file upload, etc.)
- Frequency patterns (logs in 5+ days/week, single-session days, etc.)
- Speed-to-first-action sequences

For each pattern: compute prevalence in power vs baseline, effect size, sample size.

- **Query source:** `Event` aggregations
- **Refresh:** Nightly
- **Sample-size guard:** Top decile must have ≥ 15 users; baseline ≥ 50
- **Output:** Feeds `power_user_pattern` signals in ADMIN_07
- **SP/PM split:** Yes

### 7b.2 Drop-off fingerprint (the inverse)

Same shape, but for users who churned in the last 30d. What did they NOT do that retained users did?

- **Sample-size guard:** Churned cohort must be ≥ 10 — otherwise mark "insufficient churn data" (which is itself a positive signal)
- **Output:** Feeds drop-off-targeted automation rule proposals (ADMIN_09)

### 7b.3 Time-between-sessions distribution

Histogram of gaps between consecutive `user_logged_in` events per user, last 90 days.

- **Query source:** `Event` window functions
- **Refresh:** Daily
- **Display:** Histogram + median + tail percentiles
- **SP/PM split:** Yes
- **Insight signal:** If median gap exceeds N days (TBD), `engagement_gap_widening` signal raised

### 7b.4 Feature usage frequency

Heatmap — feature × user segment. Each cell = % of users in that segment who used that feature in the last 30 days.

Segments: by signup cohort age (0–30d, 30–90d, 90d+), by mode (SP / PM), by activity tier (top decile / mid 80% / bottom decile).

- **Query source:** `Event` grouped by event type proxy for feature
- **Refresh:** Daily
- **Display:** Heatmap, cells linkable to drill-down user list

---

## 7c. Insights / Experiments / Automations metrics

These tabs are mostly content rather than metric dashboards, but each has headline counters:

### 7c.1 Insights tab

| Metric | Source |
|---|---|
| Signals raised today / week | count `Signal` rows |
| Signals acknowledged | count where `acknowledged = true` |
| Signals promoted to experiments | count where related `Experiment.sourceSignalId` exists |
| Confidence distribution | histogram of `Signal.confidence` |

Refresh: live for today's count, hourly for the rest.

### 7c.2 Experiments tab

| Metric | Source |
|---|---|
| Active experiments | count `Experiment` where `status = active` |
| Concluded this quarter | count where `status = concluded` and `concludedAt >= quarter start` |
| Win rate | concluded with `outcome = win` / total concluded (last 90d) |
| Inconclusive rate | concluded with `outcome = inconclusive` / total concluded (last 90d) |
| Median experiment duration | median (`concludedAt − startedAt`) for concluded |

Win rate matters for self-calibration: persistently low = hypotheses are weak; persistently high = playing it too safe.

### 7c.3 Automations tab

| Metric | Source |
|---|---|
| Active rules | count `AutomationRule` where `active = true` and `shadowMode = false` |
| Shadow rules | count where `shadowMode = true` |
| Fires today | count `AutomationFire` `firedAt::date = today` |
| Sent today | count where `outcome = sent` |
| Suppressed today | count where `outcome = suppressed` |
| Suppression rate | suppressed / total fires (last 7d) — high = something wrong |
| Bounce rate per rule | from SendGrid event data, per rule |
| Spam rate per rule | from SendGrid event data, per rule |

Bounce > 2% or spam > 0.1% per rule auto-pauses the rule (ADMIN_09 §8.4).

---

## 7d. Friction tab metrics

Sourced from PostHog (ADMIN_10). Computed via PostHog API + cached.

| Metric | Definition |
|---|---|
| Rage click clusters (7d) | PostHog `rageclick` event count, grouped by element selector |
| Funnel abandon rate per step | PostHog funnel insight per defined funnel |
| Sessions with friction indicators (7d) | sessions with ≥ 2 of: rage click, dead click, scroll thrash, form error |
| Top dead-click elements | elements clicked ≥ N times that have no handler |

Refresh: 15 min (PostHog API rate-limited).

These also feed `rage_click_cluster`, `funnel_abandonment`, `session_friction` signal types in ADMIN_07.

---

## 8. Unaddressed measurement gaps

These are real metrics from ADMIN_01 that we cannot compute today. Each one is paired with what's needed to enable it.

| Metric | Blocked on |
|---|---|
| Visitor count (top of funnel) | PostHog instrumentation (ADMIN_10) |
| Page load p95 | APM / front-end RUM tool |
| Error rate | Error monitoring (Sentry recommended) |
| Slow queries | DB-level slow query log or APM |
| Outbound email opens / clicks | SendGrid event webhook (ADMIN_02 §4) |
| LinkedIn post impressions / clicks | LinkedIn API access (ADMIN_05) |
| Per-session journey | PostHog session recording — disabled in v1, can enable later (ADMIN_10 §3.3) |

Each gap is surfaced in the relevant tab card as "Not yet wired — see [doc reference]," not silently hidden.

---

## 9. Refresh cadence summary

| Cadence | Mechanism | Powers |
|---|---|---|
| Live (30s) | Client polling on focused tab | Activity feed, today's deltas, AI spend, anomaly strip |
| 5 min | Lightweight job updating today's `DailyMetric` row + cache | Active agencies, deliverability, error rate, today's deltas (rollup write) |
| Hourly | Job recomputing rolling-window aggregates | Stuck transactions, leaderboard, per-event trends, heatmap |
| Nightly (02:00 London) | Full rollup job | `DailyMetric` for yesterday, `WeeklyCohort` recompute, `Event` retention sweep |

All cadences run via Vercel Cron (per ADMIN_02 §5). If a different runner is in place, the discovery report tells us and we adjust.

---

## 10. Confirmation checklist before ADMIN_01 implementation begins

You should be able to say yes to each of these before any UI is built:

- [ ] All metrics in §3–7 have a definition you agree with
- [ ] The "active user/agency" definition in §2 is correct
- [ ] The "stuck transaction" threshold (14d) is correct
- [ ] The health score weights in §4.4 are correct
- [ ] The anomaly thresholds in §3.5 are correct (especially the 15% AI overspend)
- [ ] The Europe/London timezone is correct for daily/weekly buckets
- [ ] The list of unaddressed gaps in §8 is acceptable for v1

Anything you want changed: change it here first, then ADMIN_01 / ADMIN_02 follow.
