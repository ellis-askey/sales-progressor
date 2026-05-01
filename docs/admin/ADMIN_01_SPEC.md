# ADMIN_01 — Command Centre Spec

**Audience:** You (founder, sole user) + Claude Code as implementer
**Status:** Spec, pending discovery report findings to refine doc 02 and 03
**Depends on:** ADMIN_00 discovery report
**Implemented by:** ADMIN_02 (data) → ADMIN_03 (metrics) → this doc (UI)

---

## 1. What this is

A single internal page (`/command`) that gives the founder a complete operational view of the business in one place. Not a customer-facing feature. Not a sales progressor's daily tool — those live in the existing app.

This is the **command centre for growing the company**: signups, activity, retention, content output, where things are working and where they aren't.

The page is single-user (you). It sees everything across every agency. It is the highest-blast-radius surface in the application and is hardened accordingly (see ADMIN_06).

---

## 2. The defining lens: self-progressed vs progressor-managed

Every metric, every list, every chart on this page must be filterable by — and frequently broken down by — the two operating modes:

- **Self-progressed (SP):** The agency uses our agent portal to run their own progression. They are the user; we are the platform.
- **Progressor-managed (PM):** Our internal sales progressor team handles transactions on the agency's behalf. The agency is the customer; we are the service.

These are different businesses with different unit economics, different growth shapes, different failure modes. Treating them as one is the single biggest analytical mistake the page could make.

**Default view:** Side-by-side split.
**Toggleable:** SP only / PM only / combined.
**Persistent:** The selected view is sticky across page loads (stored in the admin user's preferences, not URL).

The exact mechanism for distinguishing the two modes in data is determined by the discovery report (ADMIN_00) and codified in ADMIN_02. The spec assumes a clean distinction will exist by the time this page ships.

---

## 3. The four questions

Every tab, every metric, every chart on the command centre is built to answer one of four questions. If a piece of UI doesn't answer one of these, it doesn't ship.

1. **Where are we leaking?** — Where do users drop out, give up, churn, or fail to convert?
2. **What's improving?** — What is moving in the right direction, and what caused it?
3. **What's worth doubling down on?** — Where is signal strong enough that more investment is justified?
4. **What can we automate so I never touch it again?** — Where are we doing manual work that a rule could do?

This is the editorial line. Vanity metrics — totals, today / this week as headline numbers, "look at how many things have happened" — fail all four questions. They are excluded from headlines but retained as inputs to anomaly detection (the system needs them; the founder doesn't).

Movement is the lead. Every metric that has a meaningful delta surfaces the delta first, the absolute number second.

---

## 4. Information architecture

A single scrollable page is the wrong shape — too much data. Tabs are the right shape. Each tab is a focused dashboard.

```
/command
├── Overview          — daily brief from Insight Engine + headline movements + anomaly strip
├── Insights          — full daily brief, weekly review, signal feed (ADMIN_07)
├── Growth            — funnel drop-offs (lead with the leak), cohorts, acquisition sources
├── Activation        — onboarding step-by-step drop-off chain, first-action analysis
├── Retention         — power-user vs drop-off behavioural patterns
├── Activity          — live feed of every meaningful event
├── Outbound Log      — every email, social post, AI message ever sent (ADMIN_04)
├── Content & Social  — LinkedIn automation, scheduled posts, performance (ADMIN_05)
├── Experiments       — change log + hypothesis + outcome + playbook (ADMIN_08)
├── Automations       — IF/THEN rule engine + fire log + suppression (ADMIN_09)
├── Friction          — rage clicks, abandon points, drop-off chains from PostHog (ADMIN_10)
├── Health            — error rates, AI cost, deliverability, background jobs
├── Revenue           — billable units, MRR shape (when billing exists), revenue per user
└── Audit             — every admin action, every superadmin login, security events
```

Each tab is independently routable: `/command/growth`, `/command/activity`, etc. Deep-linkable. Browser back works.

The SP/PM split toggle lives in the page header and applies to every tab.

The "Activation" tab is split out from Growth because activation is a distinct discipline from acquisition — different mental model, different fixes, different stakes. Same reason "Retention" is its own tab. Lumping them together makes neither serious.

---

## 4. Tab-by-tab specification

### 4.1 Overview

The first thing you see when you open `/command`. Designed to be glanceable in 10 seconds.

**Layout, top to bottom:**

- **Daily brief** (full width, top of page) — the auto-generated insight from ADMIN_07. Three highest-confidence opportunities and leaks shown inline with confidence indicators. Click any → drills to source signals or promotes to experiment.
- **Two columns below:** Left = SP, right = PM. (When toggled to combined, single wide column with a "split" badge on metrics that differ meaningfully.)

**Each column shows, top to bottom:**

- **Headline movement:** Active agencies (last 7d) — but the headline is the **delta** with a "What changed?" annotation expandable to show recent experiments + deploys (per ADMIN_07 §6). The absolute number is secondary.
- **Activity pulse:** A 24-hour heat strip showing logins, milestone confirmations, chases sent. One row per metric, coloured by intensity. Used for anomaly detection — not displayed as a vanity total.
- **Today's deltas (movement card):** Signups today, transactions opened, transactions exchanged, transactions completed. Each as a delta vs trailing 7d avg. The absolute number is shown small under the delta — delta is the lead.
- **Stuck transactions (the leak card):** Count where no milestone has progressed in N days (default 14, configurable). Click → drills into the list.
- **Anomaly strip:** A row of small badges that light up if anything looks off. Examples:
  - "Chase send rate down 40% vs 7d avg"
  - "Signup conversion below 30% (last 24h)"
  - "Anthropic spend tracking +18% vs forecast"
  - "3 agencies with zero activity in 14 days"

The anomaly strip is opinionated — it should make you look at things you wouldn't have thought to check.

### 4.2 Insights

See ADMIN_07 for full spec. Summary: full daily brief, weekly review, signal feed (raw, filterable by confidence), archive of past briefs, "promote to experiment" action.

### 4.3 Growth

The acquisition funnel view. Lead with where it leaks.

**Top of page — funnel diagram, drop-off framed:**
```
Visitors → Signup started → Signup completed → First transaction created → First milestone confirmed → Active week 2 → Active week 4 → Active week 12
```
Each stage shows count, conversion %, and median time to next stage. Side-by-side SP vs PM.

**Cohort table:**
Rows = signup week. Columns = week 1, 2, 4, 8, 12 retention. Each cell = % of cohort still active in that week. Heatmap colouring. Hover for absolute numbers.

**Per-agency leaderboard:**
Sortable table of every agency, with: name, mode (SP/PM), signup date, users, transactions opened (lifetime / 30d), transactions exchanged (lifetime / 30d), last activity, health score (computed — see ADMIN_03).

**Acquisition source:**
If/when UTM/referrer capture is in place (likely a TODO from ADMIN_02): pie chart of signup source. Until then, this card shows "Not yet tracked — see ADMIN_02 §X for instrumentation." Each source row has two action buttons:
- **Double down** — pre-fills an experiment (ADMIN_08) titled "More content like [source]" with the relevant metrics as primary
- **Investigate** — drills into recent signups from that source for qualitative review

These are the "where leaking / what to double down on" actions made one-click. Treat them as buttons, not cosmetic decoration — they should actually create experiments and audit-log the action.

### 4.4 Activation

The win-or-lose tab. This is where most products die quietly.

**Hero — drop-off chain:**
The full activation sequence with drop-off rate as the hero metric (not conversion). Example:

```
Signup completed     ──── 100   →
Add Sale             ──── 73    ↓ 27% drop
Add Solicitor        ──── 44    ↓ 40% drop  ← biggest leak
Set Expected Exchange ─── 38    ↓ 14% drop
First Milestone      ──── 32    ↓ 16% drop
First Chase Sent     ──── 21    ↓ 34% drop
```

Each drop is colour-coded by severity. The biggest leak in the chain is automatically highlighted with a "Fix this" button → creates a draft experiment in ADMIN_08 with the leak as the hypothesis target.

**Friction overlay (when ADMIN_10 PostHog is wired):**
Below each step in the drop-off chain, behavioural detail from PostHog: "47% abandoned via Cancel button," "23% closed the modal," "6% stalled for 2+ minutes." See ADMIN_10 §4.3 for the data shape.

**First-action analysis:**
Cohort table comparing retention by what users did in their first 24h. Example finding: "users who sent their first chase within 24h retain at 78% (n=42); those who didn't retain at 31%." When sample size is meaningful, pattern is promoted to a forced-action recommendation.

**Time-to-X percentiles:**
Median + p25 + p75 time from signup to: first sale added, first solicitor added, first milestone confirmed, first exchange. Lets you see if "activation" is fast or grinding.

### 4.5 Retention

This tells you if people actually give a shit.

**Power user analysis:**
Top decile of users by activity. What they do that others don't. Specific behavioural fingerprints — not just "they log in more."

Example output:
```
Power users (top 10% by activity, n=18) typically:
- Send first chase within 24h of signup (94% vs 31% baseline)
- Add 3+ contacts to first transaction (89% vs 42%)
- Use email parse feature in first week (67% vs 12%)
```

Each pattern, when sample size allows, creates an ADMIN_07 signal and an ADMIN_08 experiment proposal.

**Drop-off analysis (the inverse):**
Users who churned in last 30d. What they didn't do. Example:
```
Users who churned (n=11) typically:
- Never invited a second user (100% vs 38% retained baseline)
- Stopped logging in after week 2 (with no error / friction signals — silent drop)
```

**Time-between-sessions:**
Distribution of gaps between user sessions. Healthy product = tight distribution centred on a meaningful frequency. Long-tail distribution = lots of users barely engaged.

**Feature usage frequency:**
Heatmap of feature × user segment, showing which features each segment actually uses vs ignores.

### 4.6 Activity

The "what's happening right now" view. Live feel, not historical.

**Live activity feed:**
A reverse-chronological scroll of every meaningful event in the last 24 hours: logins, milestone confirmations, chases sent, files uploaded, agencies created, etc. Each row: timestamp, agency, user, action, optional one-line context. Filterable by event type and agency.

This is read off the unified `Event` table introduced in ADMIN_02. Auto-refreshes every 30s when the tab is focused.

**Activity heatmap:**
24h × 7d grid showing volume of all events. Lets you see when your users are actually using the product. SP and PM as separate heatmaps.

**Drill-downs:**
Each event type (logins, milestone confirms, chases sent, etc.) has a small chart card showing trend over last 30d. Click → opens a fuller view.

**Per-user activity:**
Sortable table: user name, agency, mode, last login, sessions (7d), milestone confirms (7d), chases sent (7d), files uploaded (7d). The bottom of this table tells you who has gone quiet.

### 4.7 Outbound Log

See ADMIN_04 for full spec. Summary: every email, every chase, every AI-generated draft, every LinkedIn post — searchable, filterable, with full content visible.

### 4.8 Content & Social

See ADMIN_05 for full spec. Summary: LinkedIn automation control panel — three modes (draft-only, draft + scheduled approval, fully automated), the post queue, performance metrics.

### 4.9 Experiments

See ADMIN_08 for full spec. Summary: every change you make logged with hypothesis + result + outcome. The accumulating playbook of what works.

### 4.10 Automations

See ADMIN_09 for full spec. Summary: IF/THEN rule engine for lifecycle automation — welcome sequences, re-engagement, upsell triggers, internal alerts.

### 4.11 Friction

See ADMIN_10 for full spec. Summary: PostHog-powered behavioural analytics — rage clicks, abandon points, session-level friction signals.

### 4.12 Health

The operational dashboard.

**Cards:**
- **Error rate:** Errors per 1k requests, last 24h vs 7d. Click → list of recent errors with stack traces (if/when error monitoring is wired in — flagged as TODO in ADMIN_02 if not).
- **Slow queries:** Top 20 slowest endpoints by p95 latency, last 24h.
- **AI spend:** Anthropic API spend today, this week, this month. Broken down by Flow 1 (chase generation) vs Flow 2 (email parsing) vs Flow 3 (LinkedIn drafts when ADMIN_05 ships) vs Flow 4 (Insight Engine narration when ADMIN_07 ships). Forecast vs budget if a budget is set.
- **Email deliverability:** SendGrid delivered / bounced / spam-marked, last 7d. (Requires SendGrid event webhook — TODO in ADMIN_02.)
- **Storage:** Supabase Storage usage — total bytes, growth rate, top agencies by storage.
- **Database:** Approximate row counts of the largest tables, growth rate.
- **Background jobs:** Last run, success/fail, duration of every scheduled job (reminder regen, metric rollups, Insight Engine generation, automation evaluators, etc.).

### 4.13 Revenue

Placeholder until billing exists. When it does:

- MRR (SP plan revenue + PM service revenue), broken out by mode
- New / expansion / churn / contraction
- LTV per cohort
- Per-agency revenue
- Outstanding invoices

For now this tab shows: "Revenue tracking not yet wired. Required: billing system integration. See ROADMAP."

### 4.14 Audit

Every admin action ever taken. Every superadmin login (with IP, user-agent, geo). Every impersonation. Every data export. Every settings change.

Append-only. Cannot be deleted from the UI. Backed by a separate `AdminAuditLog` table (see ADMIN_02).

Exists primarily as a security and compliance artefact, but also useful for "what did I change last Tuesday."

---

## 5. Cross-cutting requirements

### 5.1 Refresh model

Three classes of data:
- **Live (≤30s lag):** Activity feed, today's headline numbers. Polled or via SSE.
- **Recent (≤5min lag):** Anomaly strip, deltas, charts covering last 24h.
- **Rolled up (≥1h lag):** Cohort tables, per-agency leaderboards, longer-range trends.

Rolled-up metrics are computed by a scheduled job (see ADMIN_02 §metric rollups). They are NOT computed on page load — that pattern dies the moment you have 50 agencies.

### 5.2 Filtering

Every list and chart must support:
- SP / PM / combined toggle (page-level)
- Date range (page-level, defaults vary by tab)
- Agency filter (multi-select, lives in page header)

Filters are reflected in the URL so any view can be shared/bookmarked.

### 5.3 Drill-down pattern

Every aggregate number is clickable. Clicking opens a side panel (not a new page) showing the underlying records. Side panel has its own filter/search and a "view full list" link to a dedicated page if more depth is needed.

### 5.4 Empty / loading / error states

Every card defines all four states explicitly. No silent loaders. No "Something went wrong" without a reason. If a metric depends on instrumentation that doesn't exist yet, the card says so — pointing to the relevant doc.

### 5.5 Performance budget

Initial page load (Overview tab): under 1.5s on a fresh session, under 500ms on a warm one. Every metric query must hit a pre-aggregated rollup table or be backed by a covering index — no `SELECT * FROM PropertyTransaction WHERE ...` scans.

This is enforced by a load test in CI (see ADMIN_06 §performance gate).

### 5.6 "What changed?" annotation (cross-cutting)

Every metric in the command centre that displays a delta gets a hover/click annotation showing what's correlated with the movement. Three sources:

- **Recent insight signals** related to this metric (last 30 days), from ADMIN_07
- **Recent experiments** tagged with this metric, from ADMIN_08
- **Recent deployments** during the window, from the `Deployment` table introduced in ADMIN_08 §6

This is what closes the loop between "the number moved" and "here's why." Don't ship a delta without it. Implementation is one shared component used by every metric card.

### 5.7 Action buttons (double-down / kill / fix)

Aggregate cards across the command centre support inline actions, not just data display. Three patterns:

- **Double down** — on acquisition source rows, channel performance, content streams. Pre-fills an experiment that says "do more of this."
- **Kill** — on sources / streams / rules with poor performance. Pauses the relevant rule or flags for shutdown. Always with confirm + audit log.
- **Fix this** — on the worst drop-off step in any funnel. Creates a draft experiment with the leak as the hypothesis target.

These are explicit in the ADMIN_01 design because vanilla dashboards make you do the work of going from "I see the problem" to "I act on it." This page does the going-to-action for you.

---

## 6. What this page is NOT

To prevent scope creep:

- It is **not** a customer-facing analytics dashboard. Agencies do not see this. If they want their own data, that's a separate feature.
- It is **not** a sales progressor's working tool. Internal progressors use the same app as everyone else for their day-to-day work. This page sits above the day-to-day.
- It is **not** a CRM. Lead pipeline, deal stage, contact management for prospects — separate tool, separate problem.
- It is **not** a finance system. Invoice generation, payment reconciliation — out of scope. Revenue tab consumes data from a future billing system; it does not own billing logic.
- It is **not** a content management system beyond the LinkedIn workflow specified in ADMIN_05. No blog editing, no website CMS.

---

## 7. Build order

1. **ADMIN_00** — discovery (read-only investigation)
2. **ADMIN_02** — schema + migrations (foundation; nothing else moves without this)
3. **ADMIN_03** — metrics catalogue + rollup jobs (the data layer the UI reads)
4. **ADMIN_06** — auth + audit (must exist before the page is reachable; otherwise we have an unprotected superadmin surface during dev)
5. **ADMIN_10** — PostHog instrumentation + cookie consent (needed for friction signals to flow into ADMIN_07)
6. **ADMIN_07** — Insight Engine (signals + daily brief + weekly review). Needed early because every other tab benefits from "what changed" annotations
7. **ADMIN_08** — Experiment Lab (small but loop-closing; needs Deployment hook)
8. **ADMIN_01** Overview + Insights + Activation + Activity tabs (smallest useful slice with the highest-value tabs)
9. **ADMIN_01** Growth + Retention + Friction + Health tabs
10. **ADMIN_04** Outbound Log
11. **ADMIN_09** — Automation Brain (after CC discovery + your channel decisions)
12. **ADMIN_05** LinkedIn automation (largest external dependency, ship last)
13. **ADMIN_01** Audit tab (small, but depends on every other tab having written audit events)
14. **ADMIN_01** Revenue tab when billing exists

---

## 8. Open questions for you (the founder) — answer before ADMIN_03

These shape what gets measured. I've defaulted them in the catalogue but flag your view:

- **"Active agency" definition:** Logged in within last 7 days? Confirmed a milestone? Sent a chase? (Default: any meaningful action — login, milestone confirm, or chase sent.)
- **"Stuck transaction" threshold:** Days since last milestone change. (Default: 14.)
- **Health score weights:** Which signals matter most? (Default: recency × volume × outcome — see ADMIN_03.)
- **Time zone for daily/weekly buckets:** Europe/London? UTC? Per-agency local? (Default: Europe/London for SP and PM since both businesses are UK-based.)
- **Budget for AI spend alerts:** Monthly £ figure. (Default: no budget; track only.)
- **Voice samples for Insight Engine** (per ADMIN_07 §10) — write 5–10 sentences in the tone you want briefs to use.
- **PostHog DPA + cookie banner copy** (per ADMIN_10 §9) — needed before PostHog goes live.

These can be changed later but defaults need to be set before the rollup jobs are written.
