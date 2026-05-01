# ADMIN_07 — Insight Engine

**Audience:** Claude Code + you
**Status:** Draft
**Depends on:** ADMIN_02 (`Event`, `DailyMetric`, `WeeklyCohort`), ADMIN_03 (metrics catalogue)
**Implements:** the daily/weekly insight layer surfaced across the command centre

---

## 1. What this is

The Insight Engine is the layer that turns the raw data the command centre collects into **decisions you should consider making**. Not dashboards. Not charts. Sentences. Like:

> "Activation dropped 6 points this week. The drop is concentrated in agencies signing up via LinkedIn — they're stalling at 'Add Solicitor.' Suggested action: check whether the LinkedIn landing page sets the wrong expectation about onboarding length."

> "Agencies that send their first chase within 24h of signing up retain at 78%. Those that don't retain at 31%. Sample size is now meaningful (n=42). Strong candidate for forced first-action onboarding."

This is the unfair-advantage layer of the command centre. The other tabs show you what's happening; this one tells you what to do about it.

It runs from day one even with thin data, but it's honest about confidence — see §5.

---

## 2. Two outputs, one pipeline

### 2.1 Daily brief

Generated every morning at 06:00 Europe/London, surfaced in the Overview tab and emailed to you. Format:

```
DAILY BRIEF — Tuesday 12 May
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔥 Biggest opportunity today
[1–3 sentences]
Confidence: ●●●○○ (medium)

⚠️ Biggest leak today
[1–3 sentences]
Confidence: ●●●●○ (high)

✅ What's working
[short list of things trending positively]

📉 What's not
[short list of things trending negatively]

🤔 Worth watching
[low-confidence signals you might want to monitor]
```

### 2.2 Weekly review

Generated every Monday at 07:00 Europe/London. Longer-form, surfaced in the Overview tab and emailed to you.

```
WEEKLY REVIEW — Week of 12 May
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Top 3 improvements this week
1. [headline] — [explanation + numbers]
2. ...
3. ...

Top 3 problems this week
1. [headline] — [explanation + numbers]
2. ...
3. ...

Top 3 experiments to consider
1. [hypothesis] — based on [pattern detected]
2. ...
3. ...

Cohort note
[1–2 sentences on how recent cohorts are tracking vs older ones]

Forecast
[1–2 sentences on where key metrics are heading if current trajectory holds]
```

Both outputs are also accessible historically in a `/command/insights` archive so you can scroll back and see what the engine flagged a month ago vs what actually happened.

---

## 3. How insights are generated

Three layers, in order. Each layer feeds the next.

### Layer 1 — Signal detection (deterministic)

Pure SQL/code. Runs across `Event`, `DailyMetric`, `WeeklyCohort`, and `OutboundMessage`. Produces a list of "signals" — facts about the data, not opinions about them.

Example signals:

```ts
{
  type: 'metric_delta',
  metric: 'activation_rate',
  current: 0.34,
  previous: 0.40,
  windowCurrent: '7d',
  windowPrevious: '7d_prior',
  delta: -0.06,
  pValue: 0.04,
  segments: { byMode: { sp: -0.08, pm: -0.02 } },
}

{
  type: 'cohort_pattern',
  pattern: 'first_action_within_24h_predicts_retention',
  cohortSize: 42,
  truthRate: 0.78,
  controlRate: 0.31,
  significance: 0.01,
}

{
  type: 'funnel_drop',
  step: 'add_solicitor',
  dropRate: 0.40,
  windowDays: 7,
  segments: { signupSource: { linkedin: 0.55, direct: 0.28 } },
}
```

A signal catalogue (one entry per detector) lives in `lib/command/insights/signals/`. Each detector is a pure function: `(window: TimeWindow) → Signal | null`. Easy to test, easy to add new ones.

The catalogue for v1 (built in this order):

1. `metric_delta` — week-over-week change in any metric in ADMIN_03 with statistical significance test
2. `funnel_drop` — sustained drop-off rate increase at any funnel step
3. `cohort_pattern` — "users who do X are Nx more likely to retain" patterns (with sample-size guard)
4. `source_performance` — acquisition source converting better/worse than baseline
5. `silent_agency` — agencies that have gone quiet (no activity in N days)
6. `power_user_pattern` — usage shapes that correlate with high retention
7. `ai_quality_drift` — change in AI-generated message length/sentiment/edit-rate
8. `cost_drift` — AI spend tracking ahead of forecast

Detectors run nightly and on a 5-min cadence for time-sensitive ones (silent_agency, cost_drift). Each emits zero or more `Signal` rows into a new `Signal` table:

```prisma
model Signal {
  id            String   @id @default(cuid())
  detectedAt    DateTime @default(now())
  detectorName  String                        // e.g. "metric_delta"
  payload       Json                          // the signal object above
  confidence    Float                         // 0.0–1.0
  severity      String                        // 'info' | 'opportunity' | 'leak' | 'critical'
  acknowledged  Boolean  @default(false)
  acknowledgedAt DateTime?
  windowStart   DateTime
  windowEnd     DateTime

  @@index([detectedAt])
  @@index([severity, detectedAt])
  @@index([acknowledged, detectedAt])
}
```

### Layer 2 — Synthesis (Claude)

Once signals are in the table, Claude is given the day's signals (filtered to unacknowledged + above a confidence threshold) and asked to write the daily brief or weekly review. Prompt includes:

- The signals as structured JSON
- The metric definitions from ADMIN_03 (so it doesn't invent definitions)
- A guardrail prompt: "Only say things the signals support. If you would otherwise speculate, say 'worth watching' instead."
- Voice samples (you write a few of these — short, direct, no fluff)

Model: Claude Haiku 4.5 for daily briefs (cheap, fast). Claude Sonnet for weekly reviews (more nuanced, worth the cost). All generation goes through the existing `OutboundMessage` pattern with `channel = in_app`, so it's auditable and visible in ADMIN_04.

### Layer 3 — Suggested actions (optional Claude pass)

For each "leak" signal, a second Claude call generates 1–3 suggested actions. These appear as bulleted "you could try…" items under the brief. Stored separately on the Signal row so you can later mark which actions you took (feeding into ADMIN_08 Experiment Lab — see §8 of this doc).

---

## 4. Acting on insights

Each signal in the daily/weekly brief has three actions available:

- **Acknowledge** — "I've seen this, stop showing me." Sets `acknowledged = true`. Doesn't suppress recurrence — if the same pattern recurs after 7 days, it generates a new signal.
- **Snooze** — "Don't tell me about this for N days." Useful for known-temporary issues.
- **Promote to experiment** — "I'm going to act on this." Creates an `Experiment` row (ADMIN_08) pre-filled with the signal as the rationale.

Acknowledgement is itself an event written to `Event` so the engine learns over time which signal types you find useful vs noisy.

---

## 5. Confidence and thin-data handling

You said: run from day one, accept thin insights. Here's how that works without producing nonsense.

### 5.1 Every signal carries a confidence score

`confidence ∈ [0, 1]`. Computed per detector:

| Detector | Confidence formula |
|---|---|
| `metric_delta` | based on p-value of significance test + sample size |
| `funnel_drop` | based on sample size at the step + stability over windows |
| `cohort_pattern` | based on sample size + effect size + significance |
| `source_performance` | based on traffic volume + duration of pattern |
| `silent_agency` | always high (1.0) — it's a fact, not an inference |
| `power_user_pattern` | based on sample size + effect size |
| `ai_quality_drift` | based on volume of AI messages in window |
| `cost_drift` | high once 7 days of data exist; lower before |

### 5.2 Confidence drives surfacing

| Confidence | Where surfaced |
|---|---|
| ≥ 0.8 | Daily brief headline. Strong language. ("Activation dropped 6 points.") |
| 0.5–0.8 | Daily brief body. Hedged language. ("Activation may be slipping — early signal.") |
| 0.2–0.5 | "Worth watching" section only. Lots of hedging. ("Possible pattern — too early to call.") |
| < 0.2 | Suppressed. Logged but not surfaced. |

### 5.3 Sample-size floors

Hard floors below which a detector won't fire at all, regardless of how interesting the pattern looks:

- `cohort_pattern` requires N ≥ 20 in each group
- `funnel_drop` requires N ≥ 30 entries to the step
- `power_user_pattern` requires N ≥ 15 in the "power" group
- `source_performance` requires N ≥ 10 conversions from the source

Above the floor but below the comfortable threshold, the signal fires with low confidence and the language reflects it.

### 5.4 Pre-data behaviour

In the first 30 days when data is genuinely thin:

- Daily briefs still generate but skew toward "what to set up" rather than "what's happening"
- Weekly reviews include a "data maturity" note explaining what isn't yet detectable
- The "worth watching" section is the largest section in early days
- A baseline comparison ("how you compare to similar SaaS at this stage") is explicitly NOT included — too easy to be wrong

This is the most important part of running from day one: **the engine has to be honest about the limits of what it knows**, otherwise you'll act on noise and lose trust in it.

---

## 6. The "What changed?" annotation

Per your principle. Every metric on every tab in the command centre that shows a delta gets a hover/click annotation showing:

- Recent insight signals related to this metric (last 30 days)
- Recent experiments tagged with this metric (from ADMIN_08)
- Recent product changes deployed (from a deploy-hook → `Deployment` table — flagged TODO if not present)

Example: hover the activation rate on Overview → tooltip shows:

> +3.2% over last week
> Related signal (8 days ago): "Funnel drop at Add Solicitor decreased after onboarding tooltip added"
> Related experiment (10 days ago): "Reduced onboarding form fields" (active, win)
> Related deployment (10 days ago): "v2.31.0 — onboarding refactor"

This is small in implementation but high-value: it's what closes the loop between Insight → Action → Result.

---

## 7. Insight quality guardrails

Generative AI writing recommendations about your business is risky. The guardrails:

### 7.1 Source-of-truth lock

Claude is given metric definitions verbatim from ADMIN_03 in the system prompt. It is instructed to refuse if asked to compute or define a metric not in the catalogue. Adding new metrics requires updating ADMIN_03 first — same rule as ADMIN_03 §1 already states.

### 7.2 Citation requirement

Every claim in a brief must be traceable to a `Signal` row. The synthesis prompt requires Claude to embed signal IDs as references. The UI surfaces these as "based on signal #1247" links so you can audit any claim back to the data.

### 7.3 No invented numbers

If Claude generates a number not present in the input signals, the brief is rejected and regenerated with a stricter prompt. Detection: a regex post-check that extracts all numeric claims from the brief and verifies each appears in the input signals (within a tolerance for rounding).

### 7.4 Tone constraints

Voice samples + explicit "do not" list:
- No corporate speak ("synergies," "leverage," "double down" except in §10 button labels)
- No vague hedges that hide uncertainty ("trending in an interesting direction")
- No exclamation marks
- No emoji except the section markers in the template
- No congratulations to the founder

### 7.5 Failure mode

If the synthesis fails (model errors, post-check rejection on second attempt): the brief shows the raw signals as a bulleted list with a note "AI synthesis unavailable today, raw signals shown." Insight engine never silently skips a day.

---

## 8. Loop closure with Experiment Lab (ADMIN_08)

The Insight Engine generates signals and suggested actions. The Experiment Lab tracks what was tried and how it landed. They share data:

- Promoting a signal to an experiment carries the signal ID forward
- When an experiment ends, its outcome is fed back into the next signal generation cycle as context: "you suggested X, the founder tried Y, here's what happened"
- This means: over time, the engine gets better at recommending things that worked before and not recommending things that didn't

This is also the mechanism for "biggest opportunities" to evolve. Early on they're generic ("most signups stall at Add Solicitor"). After 6 months they become specific to your business ("LinkedIn-sourced agencies stall at Add Solicitor; founder-narrated tutorial videos didn't help in March; might be worth trying field reduction instead").

---

## 9. UI placement

| Tab | What appears |
|---|---|
| Overview | Today's daily brief at the top of the page, above the headline numbers. The 3 highest-confidence opportunities and leaks shown inline. |
| Insights (new tab) | Full daily brief, weekly review, archive of past briefs, signal feed (raw), confidence-filter controls. |
| Every other tab | "What changed?" annotations on metric deltas (per §6). |

The new tab fits in ADMIN_01's IA between Overview and Growth.

---

## 10. Decisions required from you

Before this gets built:

- [ ] **Voice samples** — write 5–10 sentences in the tone you want the engine to use. Short, direct, the way you'd describe the situation to a co-founder over coffee.
- [ ] **Email delivery time** — 06:00 Europe/London for the daily, 07:00 Monday for the weekly. Adjust if you want them at different times.
- [ ] **Email vs in-app vs both** — daily brief in-app for sure, but do you also want the email? Email creates a forcing function but also another inbox item.
- [ ] **Confidence thresholds in §5.2** — the 0.8/0.5/0.2 splits are defaults. Adjust if you want a chattier engine (lower thresholds) or a quieter one (higher).
- [ ] **Suggested actions on/off** — Layer 3 in §3 is optional. Default on, but you might want it off until you trust the engine.

---

## 11. Out of scope for v1

- Multi-account benchmarks ("you're outperforming similar SaaS by N%") — too easy to be wrong, requires external data
- Predictive churn scoring per agency — possible later but requires a model trained on your historical data once you have any
- Automated A/B test analysis — when you have an A/B harness, the engine can analyse it; v1 doesn't have the harness
- Slack/Teams delivery of briefs — defer until ADMIN_05 LinkedIn is shipped (similar shape, lower priority)
- Voice/audio briefs — no
