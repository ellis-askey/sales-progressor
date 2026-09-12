# Data Optionality Audit — The Sales Progressor

**Date:** 2026-09-12
**Type:** Read-only investigation and recommendation. No schema changes, no tracking added, no code modified.
**Scope:** The whole data estate — transactions, milestones, comms, tasks/chases, enquiries, chains, onward/related, documents, portal/engagement, directory/intel, risk/predictions, AI, events/audit/analytics.
**Method:** Direct read of `prisma/schema.prisma` (~100 models) plus the service/ingest/cron layer, tracing every write path for each fact to classify it as *durable / overwritten-in-place / append-only history / derivable / irrecoverable*.

The guiding question throughout: **if we decide in 3–12 months that we need this fact, can we reconstruct it accurately from what we store today?**

---

## 1. Executive summary

**TSP already captures the large majority of the raw transactional facts it needs.** Milestone completions carry rich attribution (who/when/event-date/reconcile flags), price changes are versioned (`PriceHistory`), holds are a clean per-period log (`TransactionHoldPeriod`), inbound email and WhatsApp are stored per-message with full content, the AI shadow agent logs decisions with evidence and confidence, and there is a genuine append-only domain-event table (`Event`) plus a strict superadmin audit log (`AdminAuditLog`). This is a healthy estate for a pre-launch product.

**The losses are concentrated in one specific failure mode: derived/assessed state that is recomputed live or overwritten in place, so its trajectory over time is destroyed.** The pattern repeats across the codebase:

- **Predictions** (`expectedExchangeDate`, `overridePredictedDate`) are overwritten on every recompute — we never learn whether our forecasts were accurate or how they drifted.
- **Risk and health** are pure functions computed at render time and *never persisted at all* — there is no way to answer "was this file red three weeks ago" or "how long has it been at risk." This is the single largest unrecorded signal in the system.
- **Milestone availability** — when a step *became* actionable — is never stored, only ever proxied from prerequisite completion times. So "how long did this sit waiting on the solicitor" is only ever an approximation.
- **Chase attempts** are largely *counters* (`chaseCount`, capped at 2) rather than per-attempt rows for the client-chase lane, and **no chase is linked to the reply it received** for client chases or inbound email, because email threading keys are received from the provider and then discarded.
- **Chain topology** is mutated in place with hard-deletes — the shape of a chain between relists is unrecoverable.

**Second theme: the `Event` log is structurally the right backbone but is under-used and untrustworthy as a system of record.** It is append-only with a flexible `metadata` JSON field and a broad enum, but ~11 of its 41 enum values are never emitted, it is *fail-soft* (a write failure is silently swallowed with no retry/queue), and the user-facing timeline doesn't even read it (the timeline is reassembled live from source tables, and infers status history by string-matching note prose). The right move is to **harden and extend `Event`**, not build a new event architecture.

**Recommendation posture:** a *small* capture-now set — 4 items — that are cheap, irrecoverable, and have obvious multi-feature payoff. Everything else is capture-soon, wait-for-feature, or explicitly don't-collect. I am deliberately not recommending broad instrumentation; most of what "looks" missing is either already derivable or premature.

---

## 2. Current data estate — what TSP captures well

**Genuine append-only histories that already exist (the good patterns to emulate):**

| Model | What it preserves | File |
|---|---|---|
| `PriceHistory` | Every price change: old/new/changedBy/reason/timestamp | schema:821 |
| `TransactionHoldPeriod` | One row per hold: started/ended/by/plannedEnd/reason — the cleanest history model in the codebase | schema:763 |
| `EnquiryMovement` | Every enquiry court-flip / reply / chase as an append row with source + kind + occurredAt + flipsCourtTo | schema:3781; `lib/enquiries/tracker.ts:208` |
| `MilestoneCompletion` | Per-completion attribution: completedAt, eventDate, completedById, confirmedByPortal/Contact/Solicitor, NR attribution kept separately, reconcile + out-of-order + backfill flags, round attribution | schema:1305 |
| `AgentRun` / `AgentAction` | Authoritative per-inbound-email AI audit: model, promptVersion, tokens, understood/changed/waitingOn/confidence, evidence + evidenceMessageId, blockedReason | schema:2382 / 2420 |
| `ChaseSend` | Per-send + response linkage (sent/opened/responded/responseType) — **solicitor + enquiry `/s/`-link lanes only** | schema:3757 |
| `AdminAuditLog` | Superadmin actions with before/after JSON, reason, IP, UA — no UPDATE/DELETE ever | schema:3189 |
| `AgencyEmailEdit` | Append-only email-copy edit log with denormalised editor identity | schema:2682 |
| `Event` | Append-only unified domain/engagement log (see §11) | schema:2843 |
| `PortalVisit` / `PortalTimeSession` / `PortalMessage` | Per-day visits, per-session engaged time (from 2026-08-13), per-message both directions | schema:951 / 3289 / 973 |
| `ChainNotificationQueue` / `ChainNeighbourUpdate` | Per-directional withdrawal/detach notifications; per-neighbour onward-step notifications | schema:2124 / 2094 |
| `BuyerRound.chainSnapshot` / `vendorMilestoneSnapshot` | Frozen JSON of chain shape + vendor milestones at each relist/withdrawal | schema:698 / 689 |

**Inbound communications are well-preserved:** Outlook email is stored as `OutboundMessage{type:"inbound"}` with full cleaned body + untouched raw, `providerMessageId`, sender/cc, received time (`lib/integrations/outlook/sync.ts:298`). WhatsApp likewise per-message with `waMessageId` idempotency and media in Storage. AI interpretation is non-destructive (raw row retained, only `aiInterpretedAt` stamped).

**AI provenance is unusually mature for pre-launch:** the shadow progression agent records model id, prompt version, token counts, confidence, a paraphrased evidence field, and a link to the triggering message; `OutboundMessage` carries per-item `aiModel/aiPromptVersion/aiTokens/aiCostCents` for the chase/drafting path; `DraftPost` keeps both raw variants + the human's chosen/edited version (a genuine RLHF-shaped record).

---

## 3. Data we are permanently losing today (the irrecoverable gaps)

Ranked by importance. "Irrecoverable" = the fact exists at a moment, we know it, and no stored data lets us reconstruct it later.

1. **Risk & health classification over time.** `lib/services/risk.ts` and `lib/services/health.ts` are pure functions — no Prisma import, no write, no `RiskHistory`/`HealthHistory` model anywhere. The score exists only for the duration of a render. *Everything* about time-in-state, when a file turned amber/red, and how risk evolved before a fall-through is gone.
2. **Exchange-prediction trajectory.** `exchange-prediction.ts:97` does a blind `update({ expectedExchangeDate })` on every milestone change; `overridePredictedDate` is overwritten by `saveOverrideDateAction`. No prediction-history table exists. We can never audit forecast accuracy or drift.
3. **Milestone "became available" timestamp.** No `availableAt`/`unlockedAt` field exists on `MilestoneCompletion` (confirmed by full schema read + repo grep). The transition to `"available"` writes only `state`. `milestone-staleness.ts:9-16` explicitly documents the workaround: proxy from prerequisite `completedAt`, returning null where prereqs are unknown. Stage *waiting* durations are only ever approximate.
4. **Milestone completion facts after an undo.** Reversal mutates the same row back to `"available"` and clears `completedAt`/`completedById`/reconcile flags (`milestones.ts:1490,2051`). A completed-then-undone milestone retains no structured record it was ever complete — it survives only as a best-effort `Event{milestone_reversed}` row + a prose internal note.
5. **Chase→reply linkage and email threading.** Inbound email stores `providerMessageId` but **no `conversationId`/`internetMessageId`/`inReplyTo`/`references`** (grep confirms none exist) — even though these arrive in the Graph payload. So no reply can be linked to the chase it answers, and response latency is unrecoverable for client chases and all inbound email. `ChaseSend` is the only send↔response record and covers only the solicitor/enquiry `/s/`-link lanes.
6. **Per-attempt chase detail for the client lane.** Client chases are driven by `ClientChaseState.chaseCount` (2-slot dates, hard-capped at 2) plus a *forward-only, best-effort* `OutboundMessage` mirror; the bare "↻ Chased" button writes no row at all. Attempts beyond the cap, and all historical sends before the mirror commit, have no per-send row.
7. **Chain topology between relists.** Positions are rewritten in place, links are hard-deleted (`chains.ts:1394`). The only topology history is `ChainLink.detachedAt` (one-shot) and the relist-time `chainSnapshot`. A removed neighbour, or the chain's shape on any ordinary day, is gone.
8. **Flag episode history.** `TransactionFlag` is `@@unique([transactionId, kind])` — one upserted row per kind. Re-detection overwrites `reason` and bumps `detectedAt`; resolve/re-fire reuses the row. Episode count and the gaps between episodes are unrecoverable.
9. **Non-events (chase due but suppressed).** When a chase is due but paused/blocked, the cron deliberately leaves `ClientChaseState` untouched (`client-chase-cron.ts:797`). There is no "chase suppressed on date X" ledger. "We should have chased but didn't" leaves no trace.
10. **Snooze / escalation / override history.** `ChaseTask.escalationReason/escalatedAt/escalatedById`, `ReminderLog.snoozedUntil/statusReason`, `ChaseEmailOverride` edits are single-value and cleared on re-chase. Prior escalation actor/reason lost on the next cycle.
11. **AI proposal → real outcome linkage.** `AgentAction` has no link to the resulting `MilestoneCompletion`, and a later *reversal* of an AI-suggested confirm (the clearest "AI was wrong" signal) never flows back. The outcome label for training is missing.
12. **Document deletions.** Removed via `deleteMany` with no event — the `file_deleted` EventType exists in the enum and label map but is never emitted (grep confirms). A deleted document leaves no record.
13. **Point-in-time solicitor/broker performance.** All intel (median weeks to exchange, search turnaround, fall-through rate) is recomputed live from current completion timestamps (`solicitor-intel.ts:47`). A firm's benchmark *as it stood last quarter* cannot be reconstructed and silently shifts as files complete/reconcile/delete.

Lower-value irrecoverables (noted, not prioritised): onward step-confirmation tombstones (deleted on undo), `ClientMoveInfo` prior answers, portal message read receipts, `Signal` payload per observation, chain-node intel edit history, director/negotiator invite view-before-accept leg, `QuoteRequest` full status-transition history.

---

## 4. Data that looks missing but is already derivable (do NOT duplicate)

- **Days-to-exchange, avg stage durations, pipeline value, funnels, per-progressor stats** — all computed live from `PropertyTransaction` + `MilestoneCompletion` (`lib/services/analytics.ts`). Don't snapshot these; the raw timestamps are durable.
- **Time between two *completed* milestones** — derivable from `completedAt` (`lib/command/timeframes.ts`).
- **Current transaction status transitions** — captured append-only in `Event{transaction_status_changed, metadata:{from,to}}` (if the fail-soft write succeeded) and in prose notes. Derivable; the gap is *reliability* (§11), not existence.
- **AI per-run cost** — derivable from `AgentRun.tokensIn/tokensOut` + a rate card. Storing a cents field would duplicate what tokens already give you.
- **Hold-adjusted elapsed time / "exchange overdue & stuck" / exchange-day active** — all explicitly derived, never stored (correctly).
- **Enquiry whose-court timeline, quiet-days, next-chase** — derivable from `EnquiryMovement` + timestamps.
- **Chain progress %, predicted exchange, stuck milestone, chain value** — computed live in `getChainV2` from claimed files' completions.
- **Property intel (Land Registry / EPC)** — external, re-fetchable from public sources; nothing to lose.
- **Portal invitation→registration→visit→notification-adoption funnel** — reconstructable from invite `acceptedAt` + `PortalVisit` + the `Event` portal funnel (from each feature's ship date forward).

---

## 5. Capture-now recommendations (small, high-confidence)

Four items. Each is cheap, irrecoverable, and unlocks multiple plausible features.

### 5.1 Email conversation threading keys on `OutboundMessage`
- **Data/event:** persist `conversationId`, `internetMessageId`, `inReplyTo`, `references` (inbound + outbound) — values that already arrive in the Graph/SendGrid payload and are currently discarded.
- **Why:** without them, no reply can ever be linked to the message it answers.
- **Future uses:** communication response latency, chase effectiveness by channel/wording, "solicitor replied in N hours" benchmarking, thread reconstruction, feeding the AI agent the actual conversation context.
- **Where it lives:** columns on `OutboundMessage` (extends an existing model; no new table).
- **Existing infra:** yes — `OutboundMessage.providerWebhookData` already carries the raw payload; this promotes 3–4 fields to typed columns.
- **Complexity:** Low. Read fields already in hand at ingest (`lib/integrations/outlook/sync.ts`) + tag outbound sends.
- **Privacy:** Negligible — metadata, not content (content is already stored).

### 5.2 Milestone "became available" timestamp
- **Data/event:** stamp when a milestone transitions to `available` — a `becameAvailableAt` on `MilestoneCompletion` and/or an `Event{milestone_became_available}`.
- **Why:** the *waiting* clock (availability → completion) is the operationally interesting duration and is only ever proxied today.
- **Future uses:** delay detection, "expected days per stage" (already a stated product goal), optimal chase timing, solicitor/party performance, stall leading indicators.
- **Where it lives:** field on `MilestoneCompletion` (preferred — typed, queryable) plus an Event for the timeline.
- **Existing infra:** partial — the state write exists at `milestones.ts:461/528/1490`; needs a timestamp alongside it.
- **Complexity:** Low–Medium (touch each availability-transition write path; backfill is impossible, which is exactly why it's capture-now).
- **Privacy:** None.

### 5.3 Prediction snapshot on every change
- **Data/event:** append a row/event whenever `expectedExchangeDate` or `overridePredictedDate` changes — `{transactionId, predictedDate, source: system|override, changedBy?, at}`.
- **Why:** the current value tells us nothing about drift or accuracy; each recompute destroys the prior forecast.
- **Future uses:** prediction-accuracy evaluation, forecast-drift as a fall-through leading indicator, calibrating any future exchange-date model, honest client-facing "we expect exchange around X (was Y last week)".
- **Where it lives:** a small dedicated append table (typed date column, mirrors the `PriceHistory` pattern) — or `Event{prediction_produced}` if you accept JSON.
- **Existing infra:** the write points are single and known (`exchange-prediction.ts:97`, `saveOverrideDateAction`). Cheap to hook.
- **Complexity:** Low.
- **Privacy:** None.

### 5.4 Daily risk & health snapshot
- **Data/event:** persist the computed risk level/score and health colour once per file per day (or on change) — `{transactionId, date, riskLevel, riskScore, healthColour, keyFactors}`.
- **Why:** this is the biggest currently-unrecorded signal; today it exists only during a render.
- **Future uses:** fall-through prediction, time-in-red / time-to-recover, stall detection, "which files degrade before they die," agency-level portfolio health trends.
- **Where it lives:** a dedicated daily-snapshot table (append-only), written by the existing nightly rollup cron (`metrics-rollup.ts` already runs nightly and could carry it).
- **Existing infra:** partial — the pure functions exist; needs a nightly persist step. Do **not** widen the live `PropertyTransaction` row with a duplicated health column (that would destroy history the same way).
- **Complexity:** Low–Medium (one cron step; volume ~= active files/day).
- **Privacy:** None (internal assessment).

---

## 6. Capture-soon recommendations

These matter but can wait for a nearer trigger (a feature, more volume, or the AI agent moving toward live).

- **Harden `Event` writes (outbox/retry) for domain-critical types** so status/milestone history is trustworthy as a record, not fail-soft (see §11). Prerequisite for trusting Event as the spine.
- **Flag episodes append-only** — stop the `TransactionFlag` upsert-overwrite; write one row per detection episode (keep current-state view as the latest row). Unlocks "how often does this file flag," recurrence patterns.
- **Chase-suppression ledger (non-event)** — when the cron suppresses a due chase, emit an `Event{chase_suppressed, reason}`. Cheap, and the only way to ever answer "were we failing to chase."
- **AI proposal → outcome → reversal linkage** — add `AgentAction.resultingCompletionId` and a reversal back-reference. Do this *before* the agent moves out of shadow mode, because that's when the outcome labels become training-critical.
- **Per-send durability for client chases** — promote the forward-only best-effort `OutboundMessage` mirror to a guaranteed per-send row, and lift/record beyond the 2-cap. Pairs with 5.1 to give client-side response latency.
- **Chain topology snapshot on every structural change** — extend the relist-only `chainSnapshot` to fire on add/move/remove, so chain shape over time is reconstructable.

---

## 7. Do-not-capture / wait recommendations

- **AI per-run cost** — derivable from tokens + rate card (§4). Don't add a column.
- **Raw AI chain-of-thought** — deliberately excluded today; keep it that way (privacy, noise, low training value vs the structured evidence field).
- **More inbound comm content** — already stored in full; do not duplicate into interpretation tables.
- **`ClientMoveInfo` answer history** — low future value, and it's client personal/financial data (privacy). Keep current-state only.
- **Portal message read receipts** — low value for the effort; the visit/session log already proxies engagement.
- **Document OCR/extraction** — no feature needs it yet; premature, storage-heavy, and privacy-sensitive (document contents). Wait for a concrete feature.
- **Human decision rationale prompts** — forcing progressors to log "why" is intrusive, low-compliance, and the state delta + actor id already exist. Learn from *what* they did, not a mandated *why* field.
- **`Signal` payload per observation, chain-intel edit history, onward tombstones, invite view-before-accept leg, GA4** — all low value relative to cost; leave derivable/current-state.

---

## 8. AI data readiness (evidence → decision → action → outcome → correction)

| Link | Status | Detail |
|---|---|---|
| **Evidence** | Partial | `AgentAction.evidence` (paraphrase) + `evidenceMessageId` (the one trigger email). The agent's read-only tool-call outputs — what it actually saw about the file — are **not persisted**. |
| **Decision** | Strong | `AgentAction.input` + `confidence`; `AgentRun.understood/changed/waitingOn/nextExpected/reasoningSummary`. |
| **Action** | Shadow only | Nothing executed; `outcome` records the hypothetical (`shadow_proposed/blocked/flagged`) + `blockedReason`. |
| **Outcome** | Missing the real-world half | Only the *human review* (`reviewStatus` approve/dismiss/supersede) mirrors back. No link to the resulting `MilestoneCompletion`, and no propagation of a later reversal. |
| **Correction** | Partial | Approve/dismiss/supersede captured; an edited-then-approved case is not distinguished from a clean approve. |

**Provenance captured:** model id, prompt version, tokens, confidence (run + action level). **Not captured:** per-run cost (derivable), what the agent read beyond the trigger email, the real outcome of a proposal.

**Human-as-teacher corpus:** the authoritative record of "what an experienced progressor did" exists as *state* (`MilestoneCompletion.completedById` + notes) but **without the evidence/context they acted on**. The only place a human decision is tied to its source email is the `MilestoneProposal` path — which only exists for actions the AI proposed first. So there is no independent expert-demonstration-with-context corpus. **Highest-leverage AI fix: close the outcome loop (§6) before going live** — evidence and decision are already good; outcome is the missing label.

---

## 9. Predictive data readiness

What future modelling could/could not do with today's data (assessment only — not a recommendation to build):

| Question | Feasible today? | Missing inputs that would materially help |
|---|---|---|
| Probability of fall-through | Partially — outcomes (`status=withdrawn`, `withdrawalReason`, fall-through Event/snapshots) exist as labels; features are thin | **Risk/health trajectory (§5.4)**, flag episodes, chase-response latency, prediction drift |
| Likely exchange date | Partially — completion timestamps give training labels | **Prediction snapshots (§5.3)** to learn from past forecasts; milestone availability durations (§5.2) |
| Probability of missing an expected exchange month | Partially | Prediction trajectory + risk trajectory |
| Which party creates delay | Weak | **Milestone availability→completion durations (§5.2)** attributed by side/party; **response latency (§5.1)** |
| Likely duration of a milestone | Weak | Availability timestamps (§5.2) — currently only proxied |
| When a chase gets a response | Weak | **Chase→reply linkage (§5.1)**; per-attempt client-chase rows (§6) |
| Solicitor response-speed benchmarking | Weak/point-in-time only | Response latency (§5.1); the live-recompute intel can't be pinned historically |
| Effect of chain length | Partially — current topology exists | Topology *over time* (§6) |
| Leading indicators of stalled transactions | Weak | Risk/health trajectory (§5.4), flag episodes, milestone staleness history |

**Summary:** outcome *labels* are reasonably well-covered; the gap is longitudinal *features* — trajectories of risk, prediction, availability durations, and response latency. The four capture-now items are precisely the inputs that move the most predictive questions from "weak" to "feasible."

---

## 10. Historical-state / snapshot gaps

| Value | History exists today? |
|---|---|
| Predicted exchange date | **No** — single overwritten field |
| Expected exchange date | **No** — overwritten on every milestone change |
| Risk / health classification | **No** — never persisted at all |
| Current blocker / flag | **Partial** — `TransactionFlag` one upserted row per kind; episodes lost |
| Waiting-on | **Partial** — enquiry court-flips logged in `EnquiryMovement`; `AgentRun.waitingOn` per run; but the file-level "waiting on" is current-state |
| Chain length / topology | **No** (except relist `chainSnapshot` + one-shot `detachedAt`) |
| Engagement | **Yes** — `PortalVisit`/`PortalTimeSession`/`Event` funnel (from ship dates) |
| Exchange likelihood / AI confidence | **Per-run only** (`AgentRun.confidence`); no file-level trajectory |
| Solicitor performance metrics | **No** — recomputed live |
| Transaction status | **Derivable** via `Event`/notes (fail-soft) — no guaranteed typed column history |

---

## 11. Event architecture recommendation

**Do not build a new event architecture. Harden and extend the existing `Event` table.**

*What exists:* `Event` (schema:2843) is genuinely append-only (`recordEvent` only ever `create`s — `lib/command/events/write.ts:21`), with loose scalars (`type`, `entityType?`, `entityId?`, `metadata Json?`, `occurredAt`, `agencyId?`, `userId?`) and no FKs. The enum has 41 values spanning auth, agency, transaction lifecycle, milestones, comms, files, feedback, admin, and the full portal-engagement funnel. It already carries structured domain facts in `metadata` (e.g. status `{from,to}`, milestone `{code,side}`).

*Why it isn't yet a system of record:*
1. **Fail-soft with no durability guarantee** — writes are wrapped in try/catch and silently swallowed on failure (`write.ts:24-30`), with no queue/retry. A dropped write is unrecoverable. Acceptable for analytics; not for authoritative history.
2. **Under-instrumented** — ~11 enum values are defined but never emitted (`user_logged_out`, `agency_mode_changed`, `agency_archived`, `email_parse_attempted`, `file_deleted`, `admin_*`, invite/password events). And it has *no* event type for the highest-value gaps: milestone-became-available, prediction-produced, risk-changed, flag-raised/resolved, task lifecycle, chase-suppressed.
3. **Not read by the timeline** — the user-facing timeline is reassembled live from source tables and infers status by string-matching note prose (`audit.ts:83`), so anything living *only* in `Event` is invisible to the UI.

**Recommended two-tier approach:**
- **Tier 1 — dedicated typed append tables** for the few high-value facts you'll query and model on: prediction snapshots (§5.3) and daily risk/health snapshots (§5.4). Follow the `PriceHistory`/`TransactionHoldPeriod` pattern — typed columns, indexed, trustworthy. Reserve this for facts where you want SQL-level querying and guaranteed durability.
- **Tier 2 — `Event`, hardened, as the domain-event spine** for everything narrative/timeline: add the missing event types (milestone_became_available, flag_raised/resolved, chase_suppressed, task lifecycle), add an **outbox/retry** so domain-critical writes can't silently drop, and point the timeline at `Event` so status history stops depending on prose-parsing.

This avoids a third state model (Law 4 / "avoid duplicate sources of truth") while making the existing infrastructure trustworthy.

---

## 12. Prioritised table

Scores 1–5 (5 = high). **FV** future value · **IR** irrecoverability · **Conf** confidence we'll use it · **Cx** implementation complexity · **Vol** storage/volume · **Priv** privacy impact.

| # | Gap | Current state | Recoverability | FV | IR | Conf | Cx | Vol | Priv | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Email threading keys | Discarded at ingest | A (irrecoverable) | 5 | 5 | 5 | 1 | 1 | 1 | **CAPTURE NOW** |
| 2 | Milestone became-available time | Not stored, proxied | A | 5 | 5 | 5 | 2 | 1 | 1 | **CAPTURE NOW** |
| 3 | Prediction snapshot trajectory | Overwritten | A | 4 | 5 | 4 | 2 | 2 | 1 | **CAPTURE NOW** |
| 4 | Risk/health daily snapshot | Never persisted | A | 5 | 5 | 4 | 2 | 2 | 1 | **CAPTURE NOW** |
| 5 | AI proposal→outcome→reversal link | Not linked | A | 5 | 4 | 4 | 2 | 1 | 1 | **CAPTURE SOON** (before agent goes live) |
| 6 | Client-chase per-send + response | Counter, cap 2, best-effort mirror | B | 4 | 4 | 4 | 3 | 2 | 1 | **CAPTURE SOON** |
| 7 | Flag episodes | Upsert overwrites | A | 3 | 4 | 3 | 2 | 2 | 1 | **CAPTURE SOON** |
| 8 | Chase-suppression non-event | Not recorded | A | 3 | 4 | 3 | 2 | 1 | 1 | **CAPTURE SOON** |
| 9 | Chain topology over time | In-place mutate + hard delete | A | 3 | 4 | 3 | 3 | 2 | 1 | **CAPTURE SOON** |
| 10 | Harden Event durability | Fail-soft, no retry | n/a (infra) | 4 | 3 | 4 | 3 | 1 | 1 | **CAPTURE SOON** |
| 11 | Snooze/escalation history | Overwritten | A | 2 | 4 | 2 | 2 | 1 | 1 | WAIT |
| 12 | Solicitor perf point-in-time snapshot | Recomputed live | B | 3 | 3 | 2 | 2 | 2 | 1 | WAIT |
| 13 | Document deletion event | Not emitted (enum exists) | A | 2 | 4 | 2 | 1 | 1 | 1 | WAIT (cheap; fold into Event hardening) |
| 14 | AI per-run cost | — | C (derivable) | 2 | 1 | 3 | 1 | 1 | 1 | DO NOT CAPTURE |
| 15 | ClientMoveInfo answer history | Overwritten | A | 2 | 3 | 2 | 2 | 1 | 4 | DO NOT CAPTURE |
| 16 | Portal message read receipts | Not stored | A | 2 | 3 | 1 | 3 | 3 | 2 | DO NOT CAPTURE |
| 17 | Document OCR/extraction | No concept | A | 3 | 4 | 2 | 5 | 4 | 4 | WAIT FOR FEATURE |
| 18 | Onward confirmation tombstones | Deleted on undo | A | 2 | 3 | 2 | 2 | 1 | 1 | DO NOT CAPTURE |
| 19 | Signal payload per observation | Overwritten | A | 2 | 3 | 2 | 2 | 3 | 1 | DO NOT CAPTURE |
| 20 | Human decision rationale | State+actor only | A | 3 | 4 | 2 | 4 | 2 | 3 | DO NOT CAPTURE (learn from actions) |

---

## 13. Top 10 I would implement if this were my product (ranked)

1. **Email threading keys on `OutboundMessage`** — near-free (already in the payload), irrecoverable, and unlocks the entire response-latency / chase-effectiveness / thread-context surface. The clearest win in the whole audit.
2. **Milestone became-available timestamp** — the operationally meaningful "waiting" clock; directly serves the already-planned "expected days per stage" work; impossible to backfill.
3. **Prediction snapshot on change** — the only way to ever know if our forecasts are any good; a fall-through leading indicator hides in the drift.
4. **Daily risk/health snapshot** — the single biggest unrecorded signal; the backbone of any future fall-through / stall model.
5. **Harden `Event` (outbox/retry) + add the missing domain event types** — turns the existing append log into a trustworthy spine and lets the timeline stop parsing prose.
6. **AI proposal → outcome → reversal linkage** — close the training loop before the agent leaves shadow mode; evidence + decision are already captured, outcome is the missing label.
7. **Flag episodes append-only** — recurrence and gap patterns are strong stall/fall-through signals and are lost to the upsert today.
8. **Client-chase per-send durability + response linkage** (pairs with #1) — makes optimal-chase-timing and channel-effectiveness answerable client-side.
9. **Chase-suppression non-event** — cheap, and the only way to audit "were we failing to chase when we should have."
10. **Chain topology snapshot on every structural change** — chain-length/shape-over-time is a plausible predictor and is currently destroyed by in-place mutation.

---

## 14. Things I deliberately would NOT collect

- **AI per-run cost** — fully derivable from stored tokens + a rate card. Adding a column duplicates a derivable value (bias against C-class storage).
- **Raw AI chain-of-thought** — deliberately excluded today; low training value vs the structured evidence field, and it's noise/privacy risk.
- **Duplicated comm content into interpretation tables** — content is already stored once in full; storing it again for speculative use is exactly the data-swamp risk to avoid.
- **`ClientMoveInfo` answer history** — client personal/financial data (privacy score 4), low future value; keep current-state only.
- **Portal message read receipts** — high effort, low payoff; visit/session logs already proxy engagement.
- **Document OCR/extraction** — no feature needs it; heavy storage and the most privacy-sensitive item here (document contents). Revisit only when a concrete feature exists.
- **Mandated human "why" rationale** — intrusive, low-compliance, and redundant given we already have the action + actor. Learn from behaviour, not a forced field.
- **A duplicated live "health" column on `PropertyTransaction`** — would repeat the very overwrite mistake this audit is about. Snapshot it (§5.4), don't denormalise it.
- **`Signal` per-observation payloads, onward tombstones, invite view-legs, GA4** — cost outweighs plausible value; leave derivable/current-state.

---

## 15. Proposed next step

**Instrument the four capture-now items, riding a hardened `Event` where narrative and dedicated typed tables where you'll model.** Concretely, the smallest first move that maximises optionality:

1. **First, and nearly free: persist email threading keys (§5.1).** It's a handful of columns fed from data already in hand, backfill-impossible, and it's the gateway to every response-latency and chase-effectiveness question.
2. **In the same small spec, add the milestone became-available timestamp (§5.2)** at the existing state-transition write points.
3. **Then the two snapshot facts (§5.3, §5.4)** via the existing nightly rollup cron + a `PriceHistory`-shaped append table each.
4. **Fold in the `Event` hardening (outbox/retry) + missing event types (§11)** as the enabling backbone, which also cheaply captures document-deletion and chase-suppression.

Everything else stays on the capture-soon / wait list until a feature or data volume pulls it forward. No schema change, migration, or tracking should be implemented on the strength of this audit alone — this is the recommendation; the build is a separate, scoped decision.

---

*Audit produced read-only. Key citations inline; principal sources: `prisma/schema.prisma`; `lib/services/{exchange-prediction,risk,health,milestone-staleness,problem-detection,milestones,chains,onward,enquiries,solicitor-intel,analytics,activity,audit}.ts`; `lib/enquiries/tracker.ts`; `lib/integrations/outlook/sync.ts`; `lib/agent/progression-agent.ts`; `lib/command/events/write.ts`; `lib/command/metrics-rollup.ts`.*
