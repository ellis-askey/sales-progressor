# ADMIN_08 — Experiment Lab

**Audience:** Claude Code + you
**Status:** Draft
**Depends on:** ADMIN_02 (`Event`, `DailyMetric`), ADMIN_03 (metrics), ADMIN_07 (`Signal`)
**Implements:** the `/command/experiments` tab + the change-to-result loop

---

## 1. What this is

A structured log of every change you make to the product, the hypothesis behind it, and how it played out. Over time it becomes a playbook of what works and what doesn't — your accumulating advantage.

Three things it isn't:

- It's **not** an A/B testing harness. It doesn't split traffic. It doesn't compute p-values on randomised cohorts. It records changes you ship to everyone and tracks the metric movement that follows. Real A/B testing comes later (out of scope).
- It's **not** a project tracker. Linear / Jira / Notion own that. This tracks *changes that should move a metric*, not all work.
- It's **not** automatic. You log experiments deliberately. The system helps with timestamps, metric correlation, and write-up — it doesn't invent experiments out of nothing.

---

## 2. The unit of work: an Experiment

```prisma
model Experiment {
  id            String   @id @default(cuid())
  name          String                            // "Reduce onboarding fields"
  hypothesis    String                            // "Fewer fields → higher activation"

  status        ExperimentStatus                  // proposed | active | concluded | abandoned
  outcome       ExperimentOutcome?                // win | loss | inconclusive | mixed (set on conclude)

  // Linkage
  sourceSignalId String?                          // link back to ADMIN_07 signal that prompted this
  sourceType     String?                          // 'signal' | 'intuition' | 'customer_feedback' | 'other'

  // Metrics being tracked
  primaryMetric  String                           // e.g. "activation_rate" — must match a metric ID in ADMIN_03
  guardrailMetrics String[]                       // metrics that should NOT regress (e.g. don't tank retention while improving activation)

  // Timeline
  proposedAt     DateTime @default(now())
  startedAt      DateTime?
  concludedAt    DateTime?

  // Baseline + result snapshots (frozen at start/end)
  baselineSnapshot Json?                          // metric values at startedAt, computed from rolling window
  resultSnapshot   Json?                          // metric values at concludedAt
  baselineWindowDays Int @default(14)
  resultWindowDays   Int @default(14)

  // Narrative
  notes          String?                          // markdown, free-form
  conclusionNote String?                          // your own words on why win/loss/inconclusive

  // Author
  createdByUserId String

  @@index([status, startedAt])
  @@index([sourceSignalId])
}

enum ExperimentStatus { proposed active concluded abandoned }
enum ExperimentOutcome { win loss inconclusive mixed }
```

Plus a join table linking experiments to `Deployment` rows (TODO in ADMIN_07 §6) so an experiment knows which deploys are "part of" the change.

---

## 3. The lifecycle

### 3.1 Propose

You create an experiment. Either:
- **From a signal** in ADMIN_07: click "Promote to experiment" on any signal in the daily brief. Pre-fills name, hypothesis (from signal payload), primaryMetric, sourceSignalId.
- **From scratch:** New Experiment button on `/command/experiments`. You fill in name, hypothesis, primary metric.

State: `proposed`. No metric capture yet.

### 3.2 Start

When you ship the change. Click Start → system snapshots the current value of `primaryMetric` and all `guardrailMetrics` averaged over the trailing `baselineWindowDays`. Stores in `baselineSnapshot`.

State: `active`. `startedAt = now()`.

### 3.3 Run

While active, the experiment shows:
- Baseline numbers
- Current numbers (live, computed from `DailyMetric` over trailing `resultWindowDays` ending today)
- Delta with confidence indicator
- Days running
- "What changed?" feed — any other experiments / deploys that landed during the window (so you can see confounders)

### 3.4 Conclude

When you decide it's run long enough. Click Conclude → system snapshots current values into `resultSnapshot`. You set `outcome` and write a short `conclusionNote`.

State: `concluded`. `concludedAt = now()`.

### 3.5 Abandon

If a change was reverted or never shipped, mark `abandoned` with a note. No metric snapshots required. Important to track — abandoned experiments are useful future signal ("we tried this approach last quarter and it didn't get past staging because…").

---

## 4. The Experiments tab UI

### 4.1 List view

Default view. Three sections, in order:

**Active** — currently running experiments. Each card shows:
- Name + hypothesis (one line)
- Days running
- Primary metric current vs baseline with delta and confidence indicator (●●●○○)
- Guardrail metrics — green tick if not regressed, red flag if so
- Conclude button

**Recently concluded (last 30d)** — same shape but with outcome badge (win/loss/inconclusive/mixed). Click → full detail.

**Proposed** — experiments you've drafted but not started. Start button on each.

A small "Won this quarter" / "Lost this quarter" / "Inconclusive this quarter" counter sits in the page header.

### 4.2 Detail view

Click any experiment → full page:

- All fields from §2
- A **chart of the primary metric** with markers at `startedAt` and `concludedAt`. Visual at-a-glance "did the line move when we shipped this."
- Same chart for each guardrail metric, smaller.
- "What else happened during this window" — list of other experiments and deploys overlapping the timeline. Critical for honest interpretation.
- The `sourceSignalId` link if any — closes the loop back to the insight that prompted this.
- Notes section (markdown editor).

### 4.3 Playbook view

A separate page: `/command/experiments/playbook`. Aggregates concluded experiments by tag / area / metric. Shows:

- "Things that worked for activation" — list of `outcome = win` experiments where `primaryMetric = activation_rate`
- "Things that didn't" — same with `outcome = loss`
- Sortable by effect size

This is the playbook. The accumulating-advantage layer. After 6 months it should be the page you open when you have an idea, to check "have I tried this before."

---

## 5. Outcome judgement: when does win/loss/inconclusive apply?

Easy to say "result better than baseline = win." Less easy in practice. The guidelines (not enforced rules — you set outcome manually):

- **Win:** Primary metric improved by more than 1 standard deviation of its 30-day pre-baseline noise, AND no guardrail regressed by more than 0.5 SD.
- **Loss:** Primary metric got worse, OR a guardrail regressed by more than 1 SD.
- **Mixed:** Primary improved, guardrail regressed (you're trading off — needs your judgement).
- **Inconclusive:** Movement smaller than noise floor, or sample size too small to tell.

The system computes these standard deviations from `DailyMetric` history and pre-fills a suggested outcome on the conclude screen. You can override.

Honest framing: with a single live cohort and no control group, "win" is "the metric moved in the right direction during the window." It is not "we proved causation." The Insight Engine gets to mention this honestly when the experiment outcome feeds back into recommendations.

---

## 6. The deploy hook (foundation work)

Several things in ADMIN_07 and this doc reference a `Deployment` table that doesn't exist yet. This is small but enabling:

```prisma
model Deployment {
  id          String   @id @default(cuid())
  deployedAt  DateTime @default(now())
  version     String                              // git SHA short or release tag
  environment String                              // 'production' | 'staging'
  releaseNotes String?
  triggerType String                              // 'manual' | 'auto' | 'rollback'
  triggeredBy String?

  @@index([deployedAt])
}
```

Populated by a Vercel deploy webhook (Vercel emits one) hitting `POST /api/webhooks/vercel-deploy`. Each prod deploy writes a row.

Why it matters: the "What changed?" annotations across the command centre, and the experiment timeline, are dramatically more useful when they can show "these are the deploys that landed during this window." Without it, every metric shift is decorrelated from the work.

This is a 30-minute change. Add it as part of ADMIN_02 §11 (extending the migration sequence by one).

---

## 7. Loop back to Insight Engine

When an experiment concludes:

1. Outcome + delta + notes are written into a context blob attached to the source signal (if any)
2. Next day's Insight Engine generation includes a "recently concluded experiments" section in its input
3. Future suggested actions take past outcomes into account ("similar approach was tried in March and lost — consider X instead")

Specifically: the synthesis prompt for Layer 2 in ADMIN_07 §3 gets a new input slot for "experiments concluded in the last 90 days, summarised." This is what makes the engine stop suggesting things you've already disproved.

---

## 8. Importable from existing changes (one-time backfill)

If you've already been making changes and want a starting playbook, the system supports importing past experiments retrospectively:

- Pick a date
- Pick a metric
- Write the change name + hypothesis as if you'd logged it
- Mark concluded immediately with outcome

Useful for the first month so the Playbook view isn't empty. After that, log forward.

---

## 9. Anti-patterns to avoid

The system makes these easier; it doesn't prevent them. Worth being aware:

- **Concluding too early.** A change shipped Tuesday and judged Friday is noise. Default `resultWindowDays` is 14 for a reason. The conclude screen warns if you're concluding under 7 days in.
- **Cherry-picking outcome.** The system records baseline at start, not retrospectively. You can't change the goalposts after seeing the data.
- **Metric soup.** One primary metric per experiment. Guardrails exist precisely so you don't get to claim "well, the secondary metric improved." Discipline is on you.
- **Confounding ignored.** The "What else happened during this window" panel exists to make confounders visible. Use it. If three things shipped in the same week, no single experiment owns the result.

---

## 10. Decisions required from you

- [ ] **Default window lengths** — baseline 14d, result 14d. Adjust if your iteration cycle is faster.
- [ ] **Required experiment fields** — currently name + hypothesis + primary metric required. Anything else you want forced?
- [ ] **Guardrails default** — should every new experiment automatically include a default set (e.g. retention + activation + revenue per user) as guardrails, or always blank for you to choose?
- [ ] **Backfill** — do you want to log retroactive experiments for changes you've already shipped? If yes, set aside an hour to do it once.

---

## 11. Out of scope for v1

- True A/B testing (split traffic, randomised assignment, p-values) — separate doc when you're ready
- Multi-armed bandit / sequential testing — same
- Customer-segment-specific experiments (only test on SP agencies, not PM) — possible by filtering metrics but no UI affordance in v1
- Auto-suggested experiments based on signal patterns — Insight Engine suggests; you choose. No auto-creation.
- Cost attribution to experiments (how much did this change cost in eng time, generate in revenue) — out of scope
