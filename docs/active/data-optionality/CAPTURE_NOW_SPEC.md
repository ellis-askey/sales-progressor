# Capture-Now Implementation Spec — Data Optionality (4 captures)

**Date:** 2026-09-12
**Status:** Specification only. Nothing implemented. No schema, migration, service, cron or tracking change has been made.
**Source of truth:** the completed [Data Optionality Audit](../../audits/DATA_OPTIONALITY_AUDIT.md) + verbatim code investigation of the live codebase (citations inline).
**Scope:** turn the four CAPTURE-NOW findings into a spec that could be handed back as four discrete coding instructions.

The four captures:
1. Email threading / reply-linkage metadata
2. Milestone became-available history
3. Exchange-prediction history
4. Risk history (see the redesign in §A.4 — not a naive daily snapshot)

A guiding constraint throughout: **these four exist specifically because the information is irrecoverable if not captured at the moment it occurs. Therefore none may ride the fail-soft `Event` log** (`lib/command/events/write.ts:21-31` swallows all errors). Each capture is written to a durable, purpose-fit location, atomically with its trigger where possible.

---

## A. Executive recommendation — what exactly to build

| # | Capture | Storage mechanism | Why not `Event` | Trigger reliability |
|---|---|---|---|---|
| 1 | Email threading | **New nullable columns on `OutboundMessage`** (+ 4 fields on the Graph `$select`; deterministic Message-ID on outbound sends) | It's an attribute of an existing durable row, not a domain event | Rides the existing message-persist write; no new failure mode |
| 2 | Milestone availability | **New append-only table `MilestoneAvailabilityEvent`**, written *inside the same Prisma transaction* as the state change | Availability is repeatable/reversible and must be atomic with the state write; fail-soft would silently lose episodes | Coupled to the milestone-engine transaction — rolls back with it |
| 3 | Prediction history | **New append-only table `ExchangePredictionHistory`**, written in the same action/transaction as the prediction write, change-only | Irrecoverable; needs typed queryable columns + atomicity | Coupled to each prediction-write path |
| 4 | Risk history | **New append-only table `TransactionRiskHistory`**, written by a **nightly re-evaluator, change-only** (hung off the existing 03:00 `detect-problems` sweep) | Irrecoverable time-series; needs its own evaluator, not a render-time or fail-soft write | Runs under `runJob` → `JobRun` observability; per-file try/catch |

**Design headline for risk (§A.4 detail):** *not* a daily snapshot table. A **change-only history plus scheduled re-evaluation** is the smallest reliable design that captures both event-driven changes (a task goes overdue) and time-driven changes (a comm silently crosses 21 days overnight). The nightly sweep re-computes risk for every live file and appends a row **only when the risk level or the set of triggered factors changes** versus the last recorded row.

### A.1 Email threading
- **Inbound:** extend the Microsoft Graph `$select` (`lib/integrations/outlook/config.ts:243-246, 276-278`) to include `conversationId`, `internetMessageId`, and `internetMessageHeaders` (which carry `In-Reply-To`/`References`). Store them as queryable columns on `OutboundMessage`.
- **Outbound:** set a **deterministic** RFC `Message-ID` header on every SendGrid send, derived from the row/queue id (e.g. `<{outboundMessageId}@thesalesprogressor.co.uk>`), and store it in the same `internetMessageId` column. We control it, so we never need to capture SendGrid's generated id back.
- **Attribution** targets (`chaseTaskId`, `transactionId`, `buyerRoundId`) already exist on `OutboundMessage` — the only missing piece is the matchable key on both sides.

### A.2 Milestone availability
Append-only transition log (`became_available` / `became_locked`) with a `cause`, round attribution, and a `backfillApprox` flag. One helper writes the row inside the milestone-engine transaction at each of the ~5 real transition sites.

### A.3 Prediction history
Append-only, one row **only when the effective predicted date actually changes**, carrying from→to, source (creation / system_recompute / manual_override / override_cleared / exchange_freeze / relist_reset / api_patch), actor, and a deterministic inputs snapshot.

### A.4 Risk history (redesigned per your brief)
Append-only change-only history written by the nightly evaluator. Each row stores from→to level and score, the **triggered factors** and the **`RiskInput` snapshot** that produced them, so we can later answer: when did it first go at-risk, what flipped immediately before, how long before a fall-through the first warning appeared, how often it improved/deteriorated, and whether the model was historically accurate. No current risk/health column is added to `PropertyTransaction` (there is no operational need — risk is render-computed today).

---

## B. Proposed schema (minimal — no migration written)

### B.1 `OutboundMessage` — added columns (all nullable, backward-compatible)
```prisma
// Email threading / reply-linkage metadata. Null on all historic rows and on
// non-email methods. See docs/active/data-optionality/CAPTURE_NOW_SPEC.md
conversationId    String?   // provider thread id (Outlook conversationId)
internetMessageId String?   // RFC5322 Message-ID of THIS message (inbound: from Graph; outbound: deterministic <id@domain>)
inReplyTo         String?   // RFC In-Reply-To header — the Message-ID this message replies to (inbound only)
emailReferences   String?   // RFC References header chain, space-separated (inbound only); `references` is reserved-ish, prefix to be safe

@@index([transactionId, conversationId])
@@index([internetMessageId])
@@index([inReplyTo])
```
- **No `@unique`.** `conversationId` legitimately repeats across a thread; `internetMessageId` is shared across folder-copies of the same logical message (`sync.ts:294-297`), so a global unique would be unsafe without scoping + null handling. Dedup stays in application code as today.

### B.2 `MilestoneAvailabilityEvent` (new, append-only)
```prisma
model MilestoneAvailabilityEvent {
  id                    String        @id @default(cuid())
  transactionId         String
  milestoneDefinitionId String
  milestoneCode         String        // denormalised (e.g. "PM13") for query ease
  buyerRoundId          String?       // round attribution; null for vendor/file-level rows
  side                  MilestoneSide?
  transition            String        // "became_available" | "became_locked"
  cause                 String        // "init" | "prereq_satisfied" | "not_required_satisfied" | "exchange_gate_unlocked" | "gate_relock" | "prereq_reversed" | "reversal" | "relist"
  backfillApprox        Boolean       @default(false) // true = derived after the fact (see F), not observed live
  occurredAt            DateTime      @default(now())

  @@index([transactionId, occurredAt])
  @@index([transactionId, milestoneCode])
}
```
- `became_locked` closes an episode (rare — prereq reversal / gate re-lock / relist). It is secondary; the primary durations come from `became_available` + the existing `MilestoneCompletion.completedAt`.

### B.3 `ExchangePredictionHistory` (new, append-only)
```prisma
model ExchangePredictionHistory {
  id              String   @id @default(cuid())
  transactionId   String
  buyerRoundId    String?
  field           String   // "expectedExchangeDate" | "overridePredictedDate"
  previousDate    DateTime? // from-value (populated where in scope; see D)
  predictedDate   DateTime? // new effective value written
  source          String   // "creation" | "system_recompute" | "manual_override" | "override_cleared" | "exchange_freeze" | "relist_reset" | "api_patch"
  isOverride      Boolean  @default(false)
  changedByUserId String?  // null for system/cron-driven writes
  inputsSnapshot  Json?    // { completedCodes, tenure, purchaseType, isShareOfFreehold, effectiveStartDate } where deterministic
  occurredAt      DateTime @default(now())

  @@index([transactionId, occurredAt])
}
```

### B.4 `TransactionRiskHistory` (new, append-only, change-only)
```prisma
model TransactionRiskHistory {
  id            String   @id @default(cuid())
  transactionId String
  fromLevel     String?  // null on the first-ever row; else "no_data|low|medium|high"
  toLevel       String   // "no_data|low|medium|high"
  fromScore     Int?
  toScore       Int      // 0-100
  factors       Json     // triggered factors at eval time: [{ label, impact }]
  inputs        Json     // RiskInput snapshot: { onTrack, escalatedTaskCount, overdueTaskCount, daysSinceLastActivity, daysStuckOnMilestone }
  evaluatedAt   DateTime @default(now())
  source        String   @default("nightly") // evaluator identity, room for "event" later

  @@index([transactionId, evaluatedAt])
}
```

**No changes to `PropertyTransaction`, `MilestoneCompletion`, `Event`, or any enum.** (`transition`/`cause`/`source` are plain strings, matching the existing `TransactionFlag.kind` precedent, to avoid enum migrations.)

---

## C. Existing code paths affected

### C.1 Email threading
- `lib/integrations/outlook/config.ts:243-246` and `:276-278` — extend `$select`; extend `GraphMessageRaw` type (`:292-302`) and the `OutlookMessage` mapping (`:168-180`).
- `lib/integrations/outlook/sync.ts:321-348` (`logMessage`) — populate the new columns from the mapped message.
- `lib/email.ts` (`sendEmail` ~95-138, `sendChainEmail` 151-223) — add `headers: { "Message-ID": ... }`; return/thread the id.
- `lib/email/outboundQueue.ts:327-344` (outbound `OutboundMessage` mirror) — store `internetMessageId` on the mirror row.
- No change to `sendgrid-bounce` webhook (still joins on `customArgs.queueId`).

### C.2 Milestone availability — the transition sites (all in `lib/services/milestones.ts` unless noted)
- `unlockDirectDependents` **:459-462** (primary `locked→available`).
- `maybeUnlockExchangeGate` **:526-529** (VM18/PM25 gate open).
- `maybeLockExchangeGate` **:606-609** (gate re-lock → `became_locked`).
- `reverseMilestone` **:1490** (`available` on reverse).
- `executeUndoMilestone` / `computeNewState` **:2015, 2055-2093** (available|locked on undo cascade).
- `initializeMilestoneCompletions` **:389-402** (init `available`).
- Relist: `app/actions/transactions.ts:2657-2675` (VM reset) and `:2720-2736` (new-round PM createMany).
- **Recommended:** introduce one small internal helper `recordAvailabilityTransition(tx, row, transition, cause)` and call it at each site *within the same interactive transaction* (`ptx`). Do **not** attempt to centralise the state write itself (that's a milestone-engine refactor — out of scope, Law 5/16).

### C.3 Prediction history
- `lib/services/exchange-prediction.ts:46-103` (`refreshExpectedExchangeDate`) — **highest-frequency path**; its `findUnique.select` (`:50-66`) must be extended to include `expectedExchangeDate` + `overridePredictedDate` so from→to is in scope, then insert change-only.
- `app/actions/transactions.ts:920-956` (`saveOverrideDateAction`) and `:964-1007` (`reviseOverdueExchangeDateAction`) — old value already in scope (`:925/:982`).
- Exchange-freeze writes: `app/actions/milestones.ts:156, 1092`; `app/api/milestones/route.ts:111`; `lib/services/portal.ts:982`; `app/actions/tasks.ts:101`.
- `app/api/transactions/[id]/route.ts:47-61` (PATCH) — needs an extra prior-value read.
- `lib/services/transactions.ts:939` (creation) and `app/actions/transactions.ts:2755-2780` (relist reset).

### C.4 Risk history
- `app/api/cron/detect-problems/route.ts:12-25` — add a risk-evaluation + change-only append step (or a sibling cron `/api/cron/risk-history` on the same `0 3 * * *`).
- **Prerequisite refactor:** extract the risk-input derivation currently inline in `lib/services/transactions.ts:186-220` (+ the `daysSinceLastActivity` computed at component call sites, e.g. `RiskBadgeWithPopover.tsx:14-16`) into a shared server helper `deriveRiskInput(tx): RiskInput`, so the nightly evaluator and the render path compute identical inputs. `lib/services/risk.ts` (`calculateRiskScore`) is reused unchanged.

---

## D. Write lifecycle — exactly when a record is written

**Email threading:** columns populated in the *same* `logMessage` insert that already stores the inbound message (`sync.ts:321`), and in the outbound send + mirror write. No separate write.

**Milestone availability:** a transition row is appended the instant a `MilestoneCompletion.state` write crosses into `available` or `locked`, within the same `prisma.$transaction`/`ptx` block as the state update — so it commits or rolls back atomically with the milestone change. `cause` is set from the calling site (init / prereq_satisfied / not_required_satisfied / exchange_gate_unlocked / gate_relock / reversal / prereq_reversed / relist).

**Prediction history:** a row is appended **only when the value actually changes** (`previousDate` ≠ `predictedDate`, calendar-day compare):
- `creation` — first `expectedExchangeDate` set.
- `system_recompute` — inside `refreshExpectedExchangeDate`, only if the recomputed date differs from the stored one.
- `manual_override` / `override_cleared` — in the two override actions.
- `exchange_freeze` — when VM19/PM26 stamps the real date.
- `relist_reset` — when relist resets the clock.
- `api_patch` — direct PATCH edits.

**Risk history:** the nightly evaluator loads each live transaction, calls `deriveRiskInput` → `calculateRiskScore`, reads the file's **last** `TransactionRiskHistory` row, and appends a new row **iff** `toLevel` changed **or** the set of triggered factor labels changed. First-ever evaluation always writes a baseline row (`fromLevel = null`).

---

## E. Failure / idempotency behaviour

| Capture | On persistence failure | Idempotency |
|---|---|---|
| Email threading | Same behaviour as today — if the message insert fails, the message isn't logged at all; threading columns simply ride along. No new failure mode, no special handling. | Existing app-level dedup (`sync.ts:298-312`) unchanged; new columns don't alter it. |
| Milestone availability | **Business action fails too.** The append is inside the milestone transaction; if it throws, the whole confirm/NR/reverse/relist rolls back. This is the correct coupling for irrecoverable data — better to fail the confirm than silently lose the episode. The insert is a plain append (no unique constraint) so realistic failure = DB down, which fails the transaction regardless. | Inside a transaction → no partial retry double-insert. On a full retry of the action, the prior attempt rolled back, so no duplicate. |
| Prediction history | Same coupling — append in the same action/transaction as the prediction write; failure rolls the write back. | Change-only guard prevents duplicate rows for an unchanged value even if an action re-runs. |
| Risk history | **Per-file try/catch inside the sweep; a single file's failure is logged and skipped, the sweep continues.** The whole job runs under `runJob` (`lib/cron/run-job.ts`) → a `JobRun` row records success/`errorMessage`/`rowsWritten`. Acceptable because the evaluator re-runs nightly: a missed file is caught next night (its change is recorded with a slightly later timestamp — a documented ≤24h latency). | Change-only compare-to-last makes re-running the same night a no-op. Populate `JobRun.rowsWritten` for observability. |

**Explicitly:** best-effort/fail-soft is **acceptable only for the risk nightly sweep** (because it self-heals on the next run), and **not** for captures 2 and 3 (which are transaction-coupled). Observability: risk sweep via `JobRun`; the transaction-coupled captures surface failures through the normal action error path. No new alerting is proposed for v1 beyond `JobRun.errorMessage` — flag if you want a threshold alert.

---

## F. Backfill possibilities

| Capture | Class | Detail |
|---|---|---|
| Email threading — inbound | **Partially backfillable** | Not from our DB (`providerWebhookData.raw` holds body text only, no headers). Only by **re-fetching from Microsoft Graph** using the stored Graph id (`fetchMessageById`, `config.ts:274`) with the extended `$select` — limited to mailboxes still authorised and messages within Graph retention/the 90-day sync window. |
| Email threading — outbound | **Not backfillable** | No Message-ID ever existed on sent mail; nothing to reconstruct from. |
| Milestone availability | **Partially backfillable (low-confidence, must be labelled)** | The `milestone-staleness.ts` proxy (latest prereq `completedAt`) can approximate a *single* became-available time, but is wrong/absent for: no-prereq milestones (VM1/2, PM1/2), NR-satisfied prereqs (NR clears `completedAt`), exchange gates (not on the prereq chain), reversal/re-availability episodes (collapsed to the latest), backfilled prereqs (data-entry time not real time), and relist VM resets. **If generated, write it with `backfillApprox = true` and never present it as factual history.** |
| Prediction history | **Not backfillable** | Prior values were overwritten with no trace. The only recoverable facts are the *current* value and, for exchanged files, the real outcome. Optionally seed one `source:"creation"`-style baseline row per live file at launch (current value only). |
| Risk history | **Not backfillable as factual** | Never stored, and past inputs (task-overdue states, `lastActivityAt` history) are not reconstructable at past dates. Seed **one current baseline row** per live file on first nightly run. A low-confidence approximate history is *not* recommended — too many inputs are unrecoverable. |

**Rule:** do not manufacture inferred history and present it as observed. Any derived/approximate rows (only really viable for capture 2) must carry the `backfillApprox` flag and be excluded from "factual" analyses by default.

---

## G. Data-volume estimate

Assumptions: a file lives ~10–12 weeks; ~46 milestones/side; the audit notes ~5 test users today, so these are *at-scale-per-file* figures to avoid wasteful designs, not current counts.

| Capture | Rows per file (lifetime) | Notes |
|---|---|---|
| Email threading | **0 new rows** | Columns on existing `OutboundMessage`. |
| Milestone availability | **~50–80** | ~one `became_available` per milestone that unlocks, plus rare re-lock episodes. Bounded and modest. |
| Prediction history | **~10–20** | `refreshExpectedExchangeDate` fires on every confirm (~40+/file) but change-only collapses to the handful of times the phase-aware date actually shifts + any overrides. |
| Risk history | **~5–15** | Change-only level/factor transitions over a file's life. |

**The design you must avoid:** a *daily snapshot per live file* would be ~70–84 rows/file (10–12 weeks) **regardless of change** — at, say, 1,000 concurrent live files that is ~30k rows/day / ~900k/month of largely identical rows. Change-only risk history is ~10–20× leaner and loses nothing analytically. This is the explicit reason risk is change-only, not snapshot.

---

## H. Event-table relationship (per capture, with justification)

- **Email threading → NOT Event.** These are attributes of an existing durable domain row (`OutboundMessage`). Storing them as columns keeps them queryable and co-located with the message and its existing `chaseTaskId`/`buyerRoundId` attribution. An Event sidecar would be both fail-soft and detached from the message.
- **Milestone availability → dedicated table, NOT Event.** The information is irrecoverable and must be atomic with the state change; only a write inside the milestone transaction guarantees that. `recordEvent` is fail-soft and out-of-transaction — unacceptable here.
- **Prediction history → dedicated table, NOT Event.** Same reasoning; also wants typed date columns + a JSON inputs snapshot for later modelling, which a generic `Event.metadata` blob serves worse.
- **Risk history → dedicated table, NOT Event.** It's a change-only time-series produced by a scheduled evaluator; it needs typed level/score columns and its own write path. `Event` has no risk type and is fail-soft.

Consistent principle: **`Event` stays the analytics/timeline stream; anything classified irrecoverable gets a durable, purpose-fit table.** This also respects Law 4 (don't add a state model where a fitting one exists) — for capture 1 the fitting model already exists (`OutboundMessage`), so we extend it rather than add a table.

---

## I. Tests required

**Capture 1 (email threading)**
- Unit: `logMessage` maps `conversationId`/`internetMessageId`/`inReplyTo`/`emailReferences` from a Graph payload into the row; nulls when absent.
- Unit: outbound send sets a deterministic `Message-ID` and it lands on the `OutboundMessage`/mirror row.
- Integration: an inbound reply whose `inReplyTo` matches a stored outbound `internetMessageId` resolves to that outbound row's `chaseTaskId` (the intended attribution join).
- Guard: no unique-constraint violation when two folder-copies share `internetMessageId`.

**Capture 2 (milestone availability)**
- Completing a prereq appends `became_available` for each newly-unlocked milestone, in the same transaction (assert rollback-together on a forced failure).
- Reversing a prereq appends `became_locked` for re-locked downstream milestones, then `became_available` again on re-completion (episode repeatability).
- NR of a prereq appends `became_available` with `cause:"not_required_satisfied"`.
- Exchange-gate open/relock append `exchange_gate_unlocked`/`gate_relock`.
- Relist: new-round PM rows produce fresh `became_available`; reset VMs produce a new episode without overwriting the old.

**Capture 3 (prediction history)**
- `refreshExpectedExchangeDate` appends exactly one row when the date changes, none when unchanged (change-only).
- Override set → row `source:"manual_override"` with correct from→to; clear → `override_cleared`.
- VM19/PM26 confirm → `exchange_freeze` row; subsequent recompute does **not** overwrite (freeze respected).
- Relist → `relist_reset` row.

**Capture 4 (risk history)**
- `deriveRiskInput` parity test: nightly-derived inputs equal render-path inputs for the same fixture (guards drift).
- Change-only: two consecutive evaluations with unchanged inputs append one row then none.
- A time-only threshold cross (advance clock past 21 days silence) appends a `low→medium` row with the correct triggered factor.
- Baseline row written on first evaluation (`fromLevel = null`).

---

## J. Deployment sequence

1. **Migrations to staging first** (Law 3), verified, then production. Each capture's table/columns is its own migration.
2. Additive-only: all new columns nullable, all new tables independent — safe to deploy behind the code that writes them; no backfill required for correctness.
3. Ship writers, observe in staging (confirm rows appear with correct shape), then production.
4. For capture 4, confirm the nightly `JobRun` row appears green with a sane `rowsWritten` before trusting the series.
5. No consumer/UI is built in this phase — these are silent capture-only writes. (Reading/《analysis》 surfaces are a separate, later phase.)

---

## K. Things explicitly NOT being changed

- **Live fields remain the source of truth.** `expectedExchangeDate`, `overridePredictedDate`, `MilestoneCompletion.state`, and render-time risk are unchanged; the new tables/columns are *additive history*, never read by current UI.
- **No UI / no consumer** is built now. Capture only.
- **`Event` / `EventType` untouched** — no new event types, no hardening of `recordEvent` in this phase (that's a separate audit recommendation).
- **`computeHealth` (dead code) left as-is** — we capture the live *risk* model only. (See open question L-1.)
- **No milestone state-machine refactor** — we add a logging helper at existing sites, we do not centralise the state write.
- **The stale-override-survives-relist behaviour is NOT fixed here** (see L-2) — flagged separately, not bundled (Law 5).
- **Dead `predictedExchangeDate` column left alone.**
- **No retry ladder / outbox built** — the existing queues don't retry and we don't add one; capture 4's self-healing nightly re-run is the reliability model instead.

---

## L. Open questions / risks

1. **Risk vs health scope.** `computeHealth` is dead code (nothing imports it; production uses `calculateRiskScore` + the inline health object). This spec captures **risk only**. Confirm you don't also want the coarse green/amber/red band captured separately — if you do, it's derivable from the same nightly inputs and can be added as columns on `TransactionRiskHistory` cheaply.
2. **Stale override across relist (pre-existing bug).** `relistWithNewBuyer` resets `expectedExchangeDate`/`twelveWeekTarget` but **not** `overridePredictedDate` (`transactions.ts:2755-2780`), so a prior override can survive onto a new round. Out of scope here; flagging per Law 6. Prediction history will *record* this faithfully if it happens.
3. **Risk-input derivation drift.** The nightly evaluator must use the exact same input derivation as render, or the history won't match what users saw. Mitigation: the `deriveRiskInput` extraction (C.4) — but this is a small refactor of live render code and carries its own regression risk (Law 17 baseline recommended for the transactions list).
4. **Prediction coverage gap.** `portalCompleteMilestone` and `completeTaskAction` do **not** call `refreshExpectedExchangeDate` (only the VM19/PM26 hard-sync), so system-recompute history won't be emitted from those paths. Acceptable for v1? They still emit `exchange_freeze` on the terminal milestones.
5. **≤24h latency on risk history.** A time-driven change is recorded at the next nightly run, not the instant it crosses. Fine for historical analysis; state it explicitly so no one treats the timestamp as the exact crossing moment.
6. **Availability write-site coverage.** Five+ sites must each call the helper; missing one silently drops episodes from that path. A single integration test per site (I) is the guard.
7. **Backfill temptation.** Only capture 2 is even partially backfillable, and only low-confidence. Recommend shipping forward-capture first and deciding on approximate backfill separately.

---

## M. Final implementation plan (four discrete, hand-back-ready instructions)

Ordered for safety. Your instinct (email → availability → prediction → risk) is **broadly right**; the one change I'd make is to **split email into inbound-first (trivial, isolated) then outbound**, and to treat availability as the highest-blast-radius item (it edits the core milestone engine) so it gets a Law-17 baseline.

**PR 1 — Email threading, inbound (smallest, most urgent: data is discarded hourly).**
Extend Graph `$select` + `GraphMessageRaw` + `OutlookMessage` mapping; add the 4 nullable columns + 3 indexes to `OutboundMessage`; populate them in `logMessage`. Migration to staging → prod. No consumer. *One concern.*

**PR 2 — Email threading, outbound.**
Set deterministic `Message-ID` on `sendEmail`/`sendChainEmail`; store on the outbound `OutboundMessage`/mirror row. Adds the reply-match key. *One concern; separate because it touches every send path.*

**PR 3 — Milestone availability history.**
Add `MilestoneAvailabilityEvent`; add `recordAvailabilityTransition` helper; wire it into the ~5 transition sites within their existing transactions; capture behavioural baseline for the milestone flows first (Law 17). *One concern.*

**PR 4 — Prediction history.**
Add `ExchangePredictionHistory`; extend the `refreshExpectedExchangeDate` select for from→to; insert change-only at the seven write sites. *One concern.*

**PR 5 — Risk history.**
Extract `deriveRiskInput` (shared by render + cron); add `TransactionRiskHistory`; add the change-only nightly evaluator step to `detect-problems` (or a sibling 03:00 cron) under `runJob`; seed baseline on first run. *One concern; last because of the derivation-drift risk and because it depends on nothing else.*

Each PR is independently shippable, additive-only, staging-first, and adds no consumer — exactly the "silent capture now, build the analysis later" posture the audit recommends.

---

*Spec only. No schema, migration, service, cron, or tracking has been changed. Principal citations: `lib/integrations/outlook/{config,sync}.ts`; `lib/email.ts`; `lib/email/outboundQueue.ts`; `lib/services/milestones.ts`; `lib/milestone-prerequisites.ts`; `lib/services/{exchange-prediction,fees,risk,health,transactions,milestone-staleness,problem-detection}.ts`; `app/actions/{transactions,milestones,tasks}.ts`; `app/api/cron/detect-problems/route.ts`; `lib/cron/run-job.ts`; `lib/command/events/write.ts`; `vercel.json`; `prisma/schema.prisma`.*
