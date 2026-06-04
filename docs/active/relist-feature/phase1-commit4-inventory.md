# Phase 1 commit 4 — MilestoneCompletion query inventory

Living checklist. Each commit ticks off the sites it converted (or re-dispositions them with a reason); at any moment the inventory shows done / pending / deliberately-left.

**Status legend (per row):**
- ✅ converted in the commit shown (with a brief note if the disposition shifted)
- ⏳ pending in the labelled commit
- 🪪 deliberately left as-is (audit / cross-tx accepted under-scoping with documented distortion)

**Conversion progress:**

| Commit | Subsystem | Status |
|---|---|---|
| 4b | `milestones.ts` + `transactions.ts` + `agent.ts` + `work-queue.ts` + `summary.ts` + `audit.ts` + `automated-emails-preview.ts` | ✅ shipped 2026-06-04, parity diff empty |
| 4c | `reminders.ts` + `client-chase-cron.ts` + `retention.ts` + `client-chase-digest.ts` + ClientChaseState writes | ✅ shipped 2026-06-04, engine input + chase-engine probe diffs empty |
| 4d | comms + cross-cutting + OutboundMessage/PortalMessage writes | ⏳ |
| 4e | actions+API+UI + PriceHistory writes | ⏳ |
| 5 | portal scoping | ⏳ |

Exhaustive catalogue of every production read entry point on `MilestoneCompletion`. Each line dispositioned against the helper in `lib/services/milestone-scope.ts` (`forRound` / `vendorOnly` / `allRoundsForAudit`) so commits 4b–4e can convert in order without leaving anything implicit.

**Scope codes:**

| Code | Meaning |
|---|---|
| `forRound(active, tx)` | Vendor + active round's PMs — the bread-and-butter live read |
| `forRound(roundId, tx)` | Vendor + a specific (archived) round's PMs — for the archived-round view, commit 7/8 territory |
| `vendorOnly` | Deliberate vendor-only view (vendor analytics / vendor portal milestone list) |
| `allRoundsForAudit` | Cross-round/historical view — admin, audit, archive tools only |
| `find-after-write(tx,def)` | Post-commit-1 find-by-(tx,def)-then-update-by-id pattern; uses `forRound(active, tx)` to disambiguate the matching row (works for both VM and PM rows because the OR clause subsumes both) |
| `write-side` | Pure write (`create`/`createMany`/`update`/`updateMany`/`upsert`/`delete`) — out of scope for the helper; round stamping handled per commit 3 patterns |
| `script` | `scripts/*` or `prisma/seed*` — tsconfig-excluded; not converted |

**Commit ownership** is folded into each section per the write-path tracker:
- 4b — `lib/services/milestones.ts` + `lib/services/transactions.ts` reads + `lib/services/agent.ts` + `lib/services/work-queue.ts` + `lib/services/summary.ts` + `lib/services/audit.ts` + `lib/services/automated-emails-preview.ts` + `lib/services/milestone-staleness.ts` (the core engine + the per-tx fetchers)
- 4c — `lib/services/reminders.ts` + `lib/services/client-chase-cron.ts` + `lib/services/retention.ts` + `ClientChaseState` write stamping
- 4d — `lib/services/comms.ts` + `lib/services/hub.ts` + `lib/services/analytics.ts` + `lib/services/chains.ts` + `lib/services/problem-detection.ts` + `lib/services/solicitor-intel.ts` + `lib/services/metrics-rollup.ts` + `lib/services/reports.ts` + `lib/email/chainNotifications.ts` + `OutboundMessage`/`PortalMessage` write stamping
- 4e — `app/actions/*` + `app/api/*` + `app/portal/[token]/respond/page.tsx` + `app/command/(protected)/overview/page.tsx` + `lib/services/portal.ts` (the portal milestone fetchers are commit 5's privacy scope — but the round disambiguation in commit-1 conversions lives here) + `PriceHistory` write stamping
- **5** — portal scoping (depends on 4b/4d reads being round-aware first)

---

## Service layer — commit 4b ✅ shipped

**4b decisions actually taken (vs. inventory predictions):**

1. Introduced a local helper `getActiveRoundScope(db, transactionId)` at the top of `lib/services/milestones.ts` to DRY up the repeated "fetch activeBuyerRoundId then build `forRound` scope" pattern. ~14 read sites in this file use it.
2. `audit.ts:53` intent confirmed as **legitimate `allRoundsForAudit`** (the inventory flagged this as "read intent first"). Reasoning: audit log surface must show cross-round history — "agent X confirmed PM7 last week" stays visible after the round it belonged to is archived. Switched + commented.
3. All cross-tx Prisma-limitation sites in `transactions.ts` (43, 56, 258, 266, 380, 470, 479, 561, 574) and `agent.ts` (91, 171, 186, 223) classified per consumer:
   - All feed **agent dashboards** (file list, comms, work queue, exchange forecast, exchanged-not-completing list, completing-files list). **None drive automated chase decisions, comms, billing, or client/portal reads.**
   - Per the user's condition: accepted under (a) with explicit distortion documentation inline.
   - Phase 2 ticket: restructure as two-step (fetch tx ids + activeBuyerRoundIds, then raw SQL `DISTINCT ON` with `(buyerRoundId IS NULL OR buyerRoundId = pt.activeBuyerRoundId)`).
4. Found and fixed two **createTransactionAction-equivalent paths** that commit 3 missed:
   - `app/api/transactions/route.ts:77` — passed `tx.activeBuyerRoundId` to `initializeMilestoneCompletions`, stamped `buyerRoundId` on purchaser contacts.
   - `app/api/claim/route.ts:200` — added `BuyerRound` create inside the existing `$transaction` (this route uses inline `tx.propertyTransaction.create` rather than the createTransaction service), stamped `activeBuyerRoundId`, passed it to `initializeMilestoneCompletions`. **This is a Phase 0 gap closed in 4b** — claim-path files prior to today had no Round 1.
5. `completeMilestone` and `bulkCompleteMilestones` and `markNotRequired` and `bulkMarkNotRequired` create-branches now stamp `buyerRoundId` based on `def.side === "purchaser"`. The find-and-update branches use `forRound` scope to address the right partition.
6. `executeUndoMilestone` (the undo-flow regression target) — every read inside it gets `forRound` scope; every `updateMany` filter gets the same. Parity diff vs HEAD~1 was empty.

**Parity harness output:**
```
$ ts-node parity-harness-mc-reads.ts before.json   # at HEAD~1
Snapshotting 59 transactions… Wrote scripts/snapshots/before.json
$ ts-node parity-harness-mc-reads.ts after.json    # at HEAD
Snapshotting 59 transactions… Wrote scripts/snapshots/after.json
$ diff -u before.json after.json
(empty)
```

### `lib/services/milestones.ts` ✅ all rows below converted in 4b

Read sites use `getActiveRoundScope(db, transactionId)` (local helper) → `milestoneScopeWhere(scope)` spread into the where. Find-after-write sites pass the same scope so the OR clause picks vendor file-level OR active-round purchaser per def. Write create-branches in `completeMilestone` / `bulkCompleteMilestones` / `markNotRequired` / `bulkMarkNotRequired` stamp `buyerRoundId` based on `def.side === "purchaser"`.

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 142 | findFirst | `transactionId, milestoneDefinitionId` | `find-after-write(tx,def)` | `initializeMilestoneCompletions` find-or-create per def; called only at file create (no second round exists). Use `forRound(active, tx)` for consistency. **Edge**: at create time the active round was JUST created in the same outer flow; pass it in. |
| 151 | create | n/a | `write-side` | already stamps `buyerRoundId` per commit 3 |
| 187 | findMany | `transactionId` | `forRound(active, tx)` | `unlockDirectDependents` — needs VM + active round's PMs to recompute states |
| 205 | findFirst | `transactionId, milestoneDefinitionId: dep.id` | `find-after-write(tx,def)` | locate dep row to flip state; `forRound(active, tx)` |
| 210 | update | by id | `write-side` | (already converted in commit 1) |
| 240 | findFirst | `transactionId, milestoneDefinitionId: gateDef.id` | `find-after-write(tx,def)` | `maybeUnlockExchangeGate` reads the gate row; gate codes (VM18, PM25) are side-specific so a `forRound(active, tx)` find correctly picks VM18 file-level or PM25 active-round |
| 252 | findMany | `transactionId, milestoneDefinitionId: { in: blockers }` | `forRound(active, tx)` | gate blockers — VM18 blockers are vendor (file-level), PM25 blockers are purchaser (active round); `forRound` returns both partitions but the def-id IN filter narrows to the side-appropriate one |
| 264 | findFirst | `transactionId, milestoneDefinitionId: gateDef.id` | `find-after-write(tx,def)` | re-locate to update — same as 240 |
| 269 | update | by id | `write-side` | |
| 314 | findFirst | `transactionId, milestoneDefinitionId: gateDef.id` | `find-after-write(tx,def)` | `maybeLockExchangeGate` mirror of 240 |
| 326 | findMany | `transactionId, milestoneDefinitionId: { in: blockers }` | `forRound(active, tx)` | mirror of 252 |
| 338 | findFirst | `transactionId, milestoneDefinitionId: gateDef.id` | `find-after-write(tx,def)` | mirror of 264 |
| 343 | update | by id | `write-side` | |
| 367 | findMany | `transactionId` | `forRound(active, tx)` | `getMilestonesForTransaction` — the canonical per-tx fetcher used by file detail, this is THE primary read |
| 422 | findMany | `transactionId, state, milestoneDefinitionId: { in }` | `forRound(active, tx)` | `getDownstreamCompleted` — used after a milestone change to find what's downstream; same scope as the engine |
| 455 | findMany | `transactionId, state, milestoneDefinitionId: { in }` | `forRound(active, tx)` | `getImpliedPredecessors` — find prereqs that are complete/NR; cross-side query (PM12 ⊃ VM9) — `forRound` handles this first-class |
| 506 | count | `transactionId, state, milestoneDefinitionId: { in }` | `forRound(active, tx)` | `completeMilestone` prereq guard — counts complete prereqs; cross-side via `forRound` |
| 531 | findFirst | `transactionId, milestoneDefinitionId` | `find-after-write(tx,def)` | `completeMilestone` find-or-create primary; `forRound(active, tx)` |
| 536–548 | update/create | by id | `write-side` | |
| 567 | findMany | `transactionId, outOfOrderCompletion: true` | `forRound(active, tx)` | self-resolve out-of-order flags; needs both VM and active-round PM (an out-of-order flag could be on either side) |
| 572 | findMany | `transactionId` | `forRound(active, tx)` | all-current-completions for state recompute — VM + active round |
| 595 | updateMany | `transactionId, milestoneDefinitionId: { in: toResolve }, outOfOrderCompletion` | `write-side` (round filter via `forRound(active, tx)` on the where) | The `updateMany` writes — same OR clause needed to scope which rows get cleared |
| 684 | count | `transactionId, state, milestoneDefinitionId: { in }` | `forRound(active, tx)` | `bulkCompleteMilestones` prereq guard — same as 506 |
| 718 | findFirst | `transactionId, milestoneDefinitionId: defId` | `find-after-write(tx,def)` | inside the bulkComplete tx — `forRound(active, tx)` |
| 723–734 | update/create | by id | `write-side` | |
| 783 | findFirst | `transactionId, milestoneDefinitionId` | `find-after-write(tx,def)` | `reverseMilestone` — `forRound(active, tx)` |
| 790 | update | by id | `write-side` | |
| 836 | findFirst | `transactionId, milestoneDefinitionId: defId` | `find-after-write(tx,def)` | `bulkReverseMilestones` — `forRound(active, tx)`; **the regression target** for the staging undo rehearsal |
| 843 | update | by id | `write-side` | |
| 884 | findFirst | `transactionId, milestoneDefinitionId` | `find-after-write(tx,def)` | `markNotRequired` — `forRound(active, tx)` |
| 889–900 | update/create | by id | `write-side` | |
| 966 | findFirst | `transactionId, milestoneDefinitionId: defId` | `find-after-write(tx,def)` | `bulkMarkNotRequired` — `forRound(active, tx)` |
| 971–981 | update/create | by id | `write-side` | |
| 1090 | findMany | `transactionId` | `forRound(active, tx)` | `getUndoImpact` — read all current completions to compute downstream effect; same as 572 |
| 1113 | findMany | `transactionId, state: complete` | `forRound(active, tx)` | undo-impact downstream check |
| 1201 | findMany | `transactionId` | `forRound(active, tx)` | `executeUndoMilestone` reads all current state for prereq recompute |
| 1253 | findMany | `transactionId, milestoneDefinitionId: { in: primaryIds }` | `find-after-write(tx,def)` (via `forRound(active, tx)`) | bulk find-then-update inside undo tx (primary milestones) |
| 1258 | update | by id | `write-side` | |
| 1273 | findMany | `transactionId, milestoneDefinitionId: { in: cascadeIds }` | `find-after-write(tx,def)` | bulk find-then-update inside undo tx (cascade milestones) |
| 1278 | update | by id | `write-side` | |
| 1294 | updateMany | `transactionId, milestoneDefinitionId: { in: availableToRelock }` | `write-side` (round filter via `forRound(active, tx)` on the where) | re-lock rows whose prereqs are unsatisfied — needs round scope to avoid touching archived round's PMs |
| 1302 | updateMany | `transactionId, milestoneDefinitionId: { in: cascadeItems }, outOfOrderCompletion` | `write-side` (round filter) | flag still-complete downstream as out-of-order — round scope |
| 1437 | findMany | `transactionId, state, notRequiredReason: { not null }, milestoneDefinitionId: { in: cascade }` | `forRound(active, tx)` | NR cascade re-evaluation read |

### `lib/services/transactions.ts` 🪪 cross-tx accepted under-scoping in 4b

All 9 sites kept as nested `milestoneCompletions:` includes with explicit `// PHASE 1 (a)-CLASS …` comment block at each site documenting the distortion. Per the consumer-classification rule, every consumer is an **agent dashboard list view** (file list, exchange forecast, exchanged-not-completing, completing-files-detailed). None drive automated comms, chase decisions, billing, or portal reads. The `exchangedAt`-canonical principle (relist precondition is `exchangedAt IS NULL`) provides defence-in-depth for the "is exchanged?" filters. Phase 2 ticket: restructure as two-step with raw SQL `DISTINCT ON`.

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 43 | nested include | `state: complete`, `take: 1` orderBy completedAt desc | `forRound(active, tx)` (composed into the include `where`) | last-activity probe on tx list; current round's most recent completion |
| 56 | nested include | `state: complete` | `forRound(active, tx)` | exchange-state check for tx list rendering |
| 258 | nested include | `state: complete`, `take: 1` orderBy completedAt desc | `forRound(active, tx)` | same shape as 43 in a different fetcher |
| 266 | nested include | `state: complete` | `forRound(active, tx)` | same shape as 56 in a different fetcher |
| 380 | nested filter (`some`) | `state: complete, milestoneDefinition: { code in VM19/PM26 }` | `forRound(active, tx)` (composed into the some `where`) | "is exchanged?" filter for tx list. **Subtle: pre-relist a tx is "exchanged" if VM19 or PM26 was ever completed. Post-relist if the OLD round completed VM19 then the file fell through, the question becomes "is this file CURRENTLY exchanged on its active round?" — answer should be NO. So `forRound(active, tx)` is correct; the archived round's old PM26 won't satisfy the filter.** Cross-check: spec precondition for relist is `exchangedAt IS NULL`, so a billed/exchanged file can't be in this position anyway. |
| 470 | filter (`some`) | `state: complete, milestoneDefinitionId: { in: exchangeDefIds }` | `forRound(active, tx)` | similar to 380 — fetcher filter |
| 479 | nested include | `state: complete, milestoneDefinitionId: { in: completionDefIds }, select id` | `forRound(active, tx)` | exchange/completion stamp inspection |
| 561 | filter (`some`) | same as 470 | `forRound(active, tx)` | duplicate of 470 in different fetcher |
| 574 | nested include | same as 479 | `forRound(active, tx)` | duplicate of 479 in different fetcher |

### `lib/services/agent.ts` 🪪 cross-tx accepted under-scoping in 4b

All 4 sites kept as nested includes with explicit distortion documentation. Consumer for `getAgentMilestoneActivity` (line 223): `app/agent/comms/page.tsx` — agent comms dashboard activity feed grouped by day. Other 3 sites feed agent file lists. None drive automated decisions. Phase 2 ticket included.

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 91 | nested include | `state: complete, select milestoneDefinitionId + completedAt` | `forRound(active, tx)` | agent dashboard per-tx completion list |
| 171 | filter (`some`) | `state: complete, milestoneDefinitionId: { in: exchangeDefIds }` | `forRound(active, tx)` | "post-exchange" tx filter for agent dashboard |
| 186 | nested include | `state: complete, milestoneDefinitionId: { in: allPostExchangeDefIds }` | `forRound(active, tx)` | per-tx post-exchange completion details |
| 223 | top-level findMany | `transactionId: { in: ... }, state: complete, milestoneDefinitionId: { in: ... }` | `forRound(active, tx)` **per-tx** | **TRICKY**: this is a multi-tx fetcher. Per-tx scoping in a single `findMany` requires either (a) batched queries per tx or (b) accepting the limitation that cross-tx finders use `allRoundsForAudit`-like semantics. **Recommendation for 4b**: convert to batched per-tx loop or use a raw SQL with `WHERE buyerRoundId IS NULL OR buyerRoundId = t."activeBuyerRoundId"` joined to PropertyTransaction. Flag in 4b commit message. |

### `lib/services/work-queue.ts` 🪪 cross-tx accepted in 4b

Line 76 nested include left in place with `// PHASE 1 (a)-CLASS …` comment. Phase 2 ticket: switch the downstream `hasExchanged` derivation to read `tx.exchangedAt` directly (canonical) rather than scanning milestoneCompletions, which would also resolve the round-scoping concern without restructuring the include.

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 76 | nested include | `state: complete, select milestoneDefinitionId` | `forRound(active, tx)` | work-queue per-tx milestone state |

### `lib/services/summary.ts` ✅ converted in 4b

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 70 | findFirst | `transactionId, state: complete, take 1 orderBy completedAt desc` | `forRound(active, tx)` | most-recent-completion summary |

### `lib/services/audit.ts` ✅ converted in 4b → `allRoundsForAudit`

Intent confirmed (per user condition "audit.ts:53 intent-first: approved, report the finding"). Audit log surface is designed to show cross-round history — "agent X confirmed PM7" must remain visible after the round is archived. Switched to `allRoundsForAudit()` with inline comment explaining the deliberate choice.

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 53 | findMany | `transactionId` | `forRound(active, tx)` | per-tx audit fetch; if the audit explicitly wants cross-round history, switch to `allRoundsForAudit` — read the surrounding code to decide. **Action for 4b**: read context + decide. |

### `lib/services/automated-emails-preview.ts` ✅ converted in 4b

The preview simulates `evaluateTransactionReminders` for the file-detail "Reminders" tab. Must match the live chase engine's round scoping exactly (otherwise displayed "what would fire" diverges from what actually fires when 4c lands).

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 231 | findMany | `transactionId` | `forRound(active, tx)` | preview-render context; same as live engine |

### `lib/services/milestone-staleness.ts`

Per grep no direct `milestoneCompletion.*` query; it reads via the existing service helpers. Verify in 4b that all upstream callers feed it round-scoped data.

---

## Reminders + chase engine — commit 4c ✅ shipped

**4c decisions actually taken (vs inventory predictions):**

1. **`evaluateTransactionReminders` (the chase engine)** — refactored from single `findUnique` with nested `milestoneCompletions: { include: { milestoneDefinition: true } }` into a two-step fetch: parent row (select id/status/assignedUserId/createdAt/activeBuyerRoundId) + separate `milestoneCompletion.findMany` with `milestoneScopeWhere(forRound(activeBuyerRoundId, txId))`. The include's nested `where` can't reference the parent — two-step is the only round-correct path. Repackaged into the prior shape for downstream readers.

2. **`getReminderLogsForTransaction` orphan-cleanup** — the satisfied-codes set used by the orphan filter is now round-scoped. Critical: under-scoping would surface false-positive orphans on archived rounds' completions and **silently delete current-round reminders from the agent view**.

3. **`getAgentReminderLogs` work queue** — **reclassified from (a) to (b)** per the consumer rule. The orphan filter drives the agent's chase decisions; wrong-scope = silent disappearance. Restructured as two-step: log fetch (without MC include) + a per-tx-batched raw SQL with the `OR (buyerRoundId IS NULL OR buyerRoundId = pt.activeBuyerRoundId)` clause that the Prisma cross-tx limitation prevents in a single nested-where.

4. **`client-chase-cron.ts`** — bulk-load `prisma.milestoneCompletion.findMany({ where: { transactionId: { in: txIds } } })` rewritten as raw SQL with the same per-tx OR clause. The chase cron sends emails to real clients; under-scoping = wrong client gets the wrong chase post-relist. The shape of the result rows matches the prior Prisma response exactly (no downstream change).

5. **`retention.ts`** — `prisma.milestoneCompletion.count({ where: { transactionId: { in: txIds }, state: "complete" } })` rewritten as raw SQL with the per-tx OR clause. Same reasoning — retention emails are comms and a wrong count masks a stalling file.

6. **`client-chase-digest.ts:440` (ClientChaseState upsert)** — write-side stamp added: `buyerRoundId = contact.roleType === "purchaser" ? tx.activeBuyerRoundId : null`. The fetching `propertyTransaction.findUnique` extended to select `activeBuyerRoundId`. Phase 0 attribution rule honoured.

**Parity outputs:**

```
$ ts-node parity-harness-mc-reads.ts before-4c.json   # at HEAD~1
Snapshotting 59 transactions… Wrote scripts/snapshots/before-4c.json

$ ts-node parity-harness-mc-reads.ts after-4c.json    # at HEAD
Snapshotting 59 transactions… Wrote scripts/snapshots/after-4c.json

$ diff before-4c.json after-4c.json
(non-empty — but ONLY in the reminderLogs field, on files where the
BEFORE call triggered orphan auto-cleanup whose side effect committed
between the two captures. Verified by AFTER-4c-rerun: empty diff vs
AFTER-4c, proving the AFTER snapshot is now idempotent. The
engineInput field — the chase engine's read shape — is byte-identical
across all 59 transactions.)

$ node -e '… diff engineInput across 59 txs …'
engineInput differences across all 59 transactions: 0

$ node -e '… diff milestoneStates + downstream + prereqs + counts +
            engineInput across 59 txs …'
All non-reminderLogs fields IDENTICAL across all 59 transactions
```

**Chase-engine dedicated probe (busiest staging file):**

```
$ ts-node chase-engine-busiest-file.ts chase-engine-before.json
Top 5 busiest active staging files:
  logs=12 mcs=47 score=59  cmpehuzpa005t2ebfz4hexr6b  18 Oakfield Road, Surbiton, KT6 4DH
  ...
Picked: cmpehuzpa005t2ebfz4hexr6b
Wrote scripts/snapshots/chase-engine-before.json

[apply 4c conversion]

$ ts-node chase-engine-busiest-file.ts chase-engine-after.json
[same picks]

$ diff chase-engine-before.json chase-engine-after.json
(empty)
```

What WOULD fire for each of the 12 rules on the busiest file (deactivate / exchange-not-ready / bilateral-incomplete / target-confirmed / active-with-anchor-and-target) is byte-identical pre/post.

### `lib/services/reminders.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 149 | top-level findMany | `transactionId, state: { in: [complete, not_required] }` | `forRound(active, tx)` | orphan-cleanup: builds `completedCodes` map for an active tx; engine deactivates reminders whose target is complete/NR. Must read active-round state. |
| 260 | nested include | `state: { in: [complete, not_required] }, select milestoneDefinition.code` | `forRound(active, tx)` | agent work-queue tx fetcher's nested completions |
| 322 | nested include | `include: { milestoneDefinition: true }` (no where) | `forRound(active, tx)` | `evaluateTransactionReminders` engine — **the critical one**. Wrong scope here misfires every rule. Currently reads all completions; with `forRound(active, tx)` reads only the active round + VM. Pre-relist behaviour-identical (only one round); post-relist correct. |

### `lib/services/client-chase-cron.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 209 | top-level findMany | `transactionId` | `forRound(active, tx)` | chase cron loads completions per tx to enrich the chase prompt |

`ClientChaseState` writes (separate row type): created in this same cron when a client gets chased. **Commit 4c stamps `buyerRoundId` at write time** based on `contact.roleType === 'purchaser'` (Phase 0 attribution rule).

### `lib/services/retention.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 391 | count | `transactionId` | `forRound(active, tx)` | retention-email "is this file still alive?" check |

---

## Comms + cross-cutting — commit 4d

### `lib/services/comms.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 82 | top-level findMany | `transactionId, state: { in: [complete, not_required] }, include milestoneDefinition` | `forRound(active, tx)` for the **agent file detail Activity tab**. **Edge case the spec calls out**: the archived-round VIEW (commit 7/8) reads the same `getActivityTimeline` shape but wants `forRound(archivedRoundId, tx)`. **Action for 4d**: add an optional `roundScope` param to the activity timeline fetcher so the archive view can pass a non-active round; default to active round at call time. |

`OutboundMessage` write-side stamping (commit 4d adds it): wherever a send path knows its target is a purchaser-only chase or a purchaser-solicitor chase, stamp `buyerRoundId = tx.activeBuyerRoundId`. Touched paths (per write-path tracker):
- `app/actions/comms.ts` (agent-initiated send)
- `app/api/ai/generate-chase/route.ts` (AI-generated chase)
- `lib/services/client-chase-digest.ts` (digest sender — already converted in pre-Phase-1 commit; stamping added here)
- Anywhere else `prisma.outboundMessage.create` fires with an explicit purchaser-target

### `lib/services/hub.ts`

11 sites — all `some`/`none` filters on `milestoneCompletions` from a `propertyTransaction.findMany` (the platform-overview hub).

| Lines | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 99, 118, 137, 179, 262, 277, 292, 332, 512 | nested filter (`some`) | `state: complete, milestoneDefinition: { code: { in: VM19/PM26 or VM20/PM27 } }` | `forRound(active, tx)` (composed into the `some` where) | "is this tx exchanged / completed?" filters across the platform. **Cross-tx, so same constraint as `lib/services/agent.ts:223`**: a single `propertyTransaction.findMany` can't dynamically scope by each tx's `activeBuyerRoundId` in nested filters. **Recommendation**: scope these to `forRound(activeBuyerRoundId per tx)` is conceptually correct; mechanically the only way to express it with Prisma is to bake the OR clause as a `milestoneCompletions: { some: { OR: [{ buyerRoundId: null, milestoneDefinition: {...} }, { milestoneDefinition: {...}, buyerRoundId: <ref to parent> }] } }` — Prisma cannot reference the parent row, so we either (a) accept the under-scoping for these specific cross-tx "is exchanged?" filters (post-relist, the relist-precondition `exchangedAt IS NULL` means relisted files never appear in these filters anyway), or (b) split into two queries. **Action for 4d**: document the limitation, accept (a) since `exchangedAt` is the canonical source of truth here; the milestone filter is a secondary check. |
| 157 | nested filter (`none`) | `state: complete, completedAt: { gte: 14d ago }` | special — see below | "files with no recent activity in 14 days." This is **activity detection**, not side-specific. Post-relist a brand-new active round on a relisted file SHOULD register as "recent activity." `forRound(active, tx)` is correct in principle but again can't be expressed in cross-tx Prisma. **Action for 4d**: accept under-scoping (pre-relist behaviour-identical) and add a TODO for Phase 2 to revisit when relisted files start appearing on prod. |
| 168 | nested filter (`none`) | `state: complete, reconciledAtClaim: true` | `forRound(active, tx)` (same caveat) | "files reconciled on claim" — same cross-tx limitation |
| 452 | count | `transactionId` | `forRound(active, tx)` | per-tx completion count — straightforward |
| 460 | count | `transactionId, state: complete` | `forRound(active, tx)` | per-tx complete count |
| 720 | findFirst | `transactionId, state: complete, take 1 orderBy completedAt desc` | `forRound(active, tx)` | last-completed-at probe; same as `transactions.ts:43` |

### `lib/services/analytics.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 71 | nested include | `state: complete, select milestoneDefinitionId + completedAt` | `forRound(active, tx)` (composed) per-tx | analytics — needs per-tx scoping; same cross-tx caveat. **Action for 4d**: accept under-scoping for analytics; pre-relist behaviour unchanged. Flag a Phase 2 ticket to round-aware analytics. |
| 301 | top-level findMany | per-tx fetcher | `forRound(active, tx)` | analytics computation per tx |
| 348 | filter (`some`) | exchange defs | (same cross-tx caveat) | |
| 356 | nested include | exchange defs, select completedAt | (same caveat) | |
| 448, 459 | top-level findMany | analytics aggregation | `allRoundsForAudit` is **DEFENSIBLE** here — analytics is the legitimate use case for cross-round data. **Action for 4d**: read each call's intent; if it's a "platform-wide historical chart," `allRoundsForAudit` is right and intentional. |
| 557 | top-level findMany | `transactionId` | `forRound(active, tx)` | per-tx analytics enrichment |
| 631 | nested filter (`none`) | `state: complete, completedAt: { gte: 14d ago }` | same cross-tx caveat as hub.ts:157 | |
| 635 | nested filter (`some`) | exchange defs | same caveat | |
| 647 | nested filter (`some`) | `state: complete, eventDate: null` | same caveat | |

### `lib/services/chains.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 29 | type def | `milestoneCompletions: { completedAt: Date \| null }[]` | type — no query; matches whatever the include returns | |
| 135 | nested include | `state: complete, orderBy completedAt desc, take 1` | `forRound(active, tx)` (composed) | chain link "most recent completion" — **the chain-misleading guard from Phase 1 plan §8 lands here**. Chain link's `daysStuck` reads the latest completion across rounds; `forRound(active, tx)` is correct (the new buyer's progress IS the chain link's progress on a relisted file). |
| 204 | nested include | `select state + eventDate` | `forRound(active, tx)` | per-tx chain completion details |

### `lib/services/problem-detection.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 32, 36 | type def | shape | type only; reflects the include shape | |
| 179 | nested select | `milestoneCompletions: { where: { state: complete } }` | `forRound(active, tx)` per-tx | problem-detection scans for stuck/stalled files |
| 194 | nested include | `state: complete, take 1 orderBy completedAt desc` | `forRound(active, tx)` per-tx | last-completion stamp |

### `lib/services/solicitor-intel.ts`

| Lines | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 35, 50 | nested include | `state: complete, select completedAt` | `forRound(active, tx)` per-tx | per-solicitor performance analytics — current round only is correct (analyses present, not historic buyer fall-throughs) |

### `lib/services/metrics-rollup.ts`

| Lines | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 171, 182, 192 | count | various platform-wide counts | `allRoundsForAudit` — **defensible**: these are platform-level aggregates for the Command Centre, not per-tx live reads. **Action for 4d**: confirm each is platform-level and use `allRoundsForAudit`; if any is per-tx, switch to `forRound(active, tx)`. |

### `lib/services/reports.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 38 | top-level findMany | report query | `forRound(active, tx)` per-tx | scheduled reports — current round |

### `lib/email/chainNotifications.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 658 | nested include | `state: complete, milestoneDefinition: { code: { in: VM20/PM27 } }` | `forRound(active, tx)` | chain completion notification — is THIS file completed? Active round only. |

---

## Actions + API + UI — commit 4e

### `app/actions/transactions.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 397 | findMany | `transactionId, state: complete, milestoneDefinitionId: { in: gateBlockers }` | `forRound(active, tx)` | status-flip gate-state read in `changeStatusAction` |
| 886 | count | `transactionId, state: complete` | `forRound(active, tx)` | progress percent for a single tx |
| 1220 | findMany | `transactionId` | `forRound(active, tx)` | `confirmSaleDetailsAction` reads all current completions to project NR changes |
| 1299 | findMany | `transactionId` | `forRound(active, tx)` | `confirmSaleDetailsAction` second-pass read |
| 1361 | findFirst | `transactionId, milestoneDefinitionId` | `find-after-write(tx,def)` | NR update inside ptx |
| 1366 | update | by id | `write-side` | |
| 1406 | findFirst | `transactionId, milestoneDefinitionId` | `find-after-write(tx,def)` | reactivate update inside ptx |
| 1411 | update | by id | `write-side` | |
| 1438 | findFirst | `transactionId, milestoneDefinitionId: gateDefId` | `find-after-write(tx,def)` | gate-state probe inside ptx |
| 1447 | findMany | `transactionId, milestoneDefinitionId: { in: blockers }` | `forRound(active, tx)` | gate blockers state |
| 1459, 1464, 1470, 1475 | findFirst/update | gate row | `find-after-write(tx,def)` / `write-side` | gate state flip |

`PriceHistory` write stamping in this commit at `app/actions/transactions.ts:511` (`updatePurchasePriceAction`) — `data: { ..., buyerRoundId: tx.activeBuyerRoundId }`.

### `app/actions/portal.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 171 | findFirst | `transactionId, milestoneDefinitionId: def.id` | `find-after-write(tx,def)` | `portalSetExpectedDateAction` — `forRound(active, tx)` |
| 176, 182 | update/create | by id | `write-side` | |

### `app/actions/milestones.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 101 | findFirst | `transactionId, milestoneDefinitionId: counterDefId, state: complete` | `find-after-write(tx,def)` | bilateral counter "already done?" check; `forRound(active, tx)` |
| 501 | findMany | `transactionId, state` | `forRound(active, tx)` | sweep candidates for reconcileExchangeMilestonesAction |
| 569 | findFirst | `transactionId, milestoneDefinitionId: defId` | `find-after-write(tx,def)` | sweep upsert |
| 574, 586 | update/create | by id | `write-side` | |
| 635 | findFirst | `transactionId, milestoneDefinitionId: counterDefId, state: complete` | `find-after-write(tx,def)` | bilateral counter check (different action); `forRound(active, tx)` |
| 808 | findFirst | `transactionId, milestoneDefinitionId: c.milestoneDefinitionId` | `find-after-write(tx,def)` | `reconcileClaimMilestonesAction` |
| 813, 827 | update/create | by id | `write-side` | |
| 931 | findFirst | `transactionId, milestoneDefinitionId: c.milestoneDefinitionId` | `find-after-write(tx,def)` | `migrateCompleteMilestonesAction` |
| 936, 949 | update/create | by id | `write-side` | |

### `app/api/milestones/route.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 81 | findFirst | `transactionId, milestoneDefinitionId: counterDefId, state: complete` | `find-after-write(tx,def)` | bilateral counter check; `forRound(active, tx)` |

### `app/api/milestones/downstream/route.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 37 | findMany | `transactionId, state: complete, milestoneDefinitionId: { in: codes }` | `forRound(active, tx)` | downstream complete check |

### `app/api/ai/generate-chase/route.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 93 | nested include | `state: complete, milestoneDefinition: { code: { in: VM18/PM25 } }` | `forRound(active, tx)` | AI chase context — exchange-readiness signal |

### `app/api/cron/content-topics/route.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 20 | findMany | `state: complete, completedAt: { gte: ... }` (recent activity, cross-tx) | `allRoundsForAudit` — **defensible**: content-topic cron is a platform-wide signal mining job, not per-tx. **Action for 4e**: confirm and document. |

### `app/api/cron/medians-ready-check/route.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 50 | findMany | cross-tx population query | `allRoundsForAudit` — **defensible**: medians are population-level. |
| 68 | findMany | similar | `allRoundsForAudit` | |

### `app/portal/[token]/respond/page.tsx`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 86 | findMany | `transactionId, state` | **commit 5 (portal scoping)** — `forRound(THIS contact's round, tx)` for purchaser; `forRound(active, tx)` for vendor | This is a portal-side read; lands in the portal commit, not 4e. Listed here for completeness. |

### `app/command/(protected)/overview/page.tsx`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 118 | nested filter (`none`) | `completedAt: { gte: 14d ago }` cross-tx | same cross-tx caveat as `hub.ts:157`; accept under-scoping for Command Centre overview, document |

---

## Portal — commit 5 (privacy scope, depends on 4b/4c/4d reads being round-aware)

### `lib/services/portal.ts`

| Line | Op | Current where | Disposition | Notes |
|---|---|---|---|---|
| 160 | findMany | `transactionId, side filter` | **Vendor portal**: `forRound(active, tx)` for PM mirror; `vendorOnly` for VM list. **Purchaser portal**: `forRound(THIS contact's round, tx)` for PM list; `vendorOnly` for VM mirror. **Critical privacy site.** |
| 300 | findFirst | `transactionId, milestoneDefinitionId` | `find-after-write(tx,def)` scoped by **contact's** round (commit 5 portal scoping) |
| 338 | findFirst | `transactionId, milestoneDefinitionId: counterDefId, state: complete` | `find-after-write(tx,def)` scoped by contact's round |
| 1117 | findFirst | `transactionId, milestoneDefinitionId: counterDef.id` | `find-after-write(tx,def)` scoped by contact's round |
| 1684 | findMany | `transactionId, state: complete` (the `_contactId` ignore — THE known bug) | **Vendor portal**: `forRound(active, tx)` filtered to `visibleToClient`. **Purchaser portal**: `forRound(THIS contact's round, tx)` filtered to `visibleToClient`. **Fix the `_contactId` ignore here** — this is the headline privacy fix. |
| 1764 | findFirst | `transactionId, milestoneDefinitionId: def.id` | `find-after-write(tx,def)` scoped by contact's round |
| 1769, 1774 | update/create | by id | `write-side` |
| 1785 | findFirst | cascade row | `find-after-write(tx,def)` scoped by contact's round |
| 1790, 1795 | update/create | by id | `write-side` |

---

## Out of scope

### Raw SQL touching `MilestoneCompletion`

Production code: **zero**. Confirmed by grep `FROM "MilestoneCompletion" | UPDATE | INTO | JOIN`. The only raw SQL is in `scripts/backfill-buyer-round-phase0.ts:131` (the Phase 0 attribution sweep) and `scripts/check-mc-uniqueness-readiness.ts` / `scripts/check-tx-statuses.ts` (diagnostics) — all in `scripts/*`.

### Type-only references

- `lib/services/chains.ts:29` — type def for the include shape
- `lib/services/problem-detection.ts:32,36` — type defs for `_count` and `milestoneCompletions[]`

No query, no disposition needed.

### Scripts and seeds (tsconfig-excluded)

`scripts/verify-b*`, `scripts/seed-staging-*`, `scripts/diagnose-milestone-queue.ts`, `scripts/inspect-emily-staging.ts`, `scripts/test-send-chase-email.ts`, `scripts/trace-confirm-writes.ts`, `scripts/seed-completions.ts`, `scripts/reset-and-seed-emily-staging.ts`, `scripts/seed-staging-spot-check.ts`, `prisma/seed.ts`, `prisma/seed-help-library.ts` — left as-is. Not converted in 4b–4e.

The Phase 0 + commit-1 + commit-3 verification scripts are also left as-is.

### Demo / static UI (no DB query)

`app/agent/polish/slowness-demo/page.tsx`, `app/agent/polish/staleness-demo/page.tsx`, `components/milestones/MilestoneRow.tsx`, `components/milestones/MilestonePanel.tsx`, `components/milestones/NotRequiredRow.tsx`, `components/milestones/ReconcileMilestonePicker.tsx`, `components/transaction/OverviewPanel.tsx` — consume completion data via server-component props; they don't issue queries themselves.

---

## Outstanding tactical decisions for 4b–4e

These are decisions that must be locked in the relevant per-commit report (not now):

1. **Cross-tx `findMany` scoping** (analytics, hub, agent, content-topics, medians, command-overview):
   Prisma's nested `where` can't reference the parent row's `activeBuyerRoundId`. Three options:
   - (a) Accept under-scoping for these specific reads (pre-relist behaviour-identical; post-relist a relisted file's archived round leaks into platform aggregates). **Most analytics paths can absorb this; flag for Phase 2 revisit.**
   - (b) Switch to raw SQL with the OR clause and the JOIN. Higher precision, more code to maintain.
   - (c) Two-step fetch — list tx ids, then per-tx scoped completions. Performance cost on dashboards.
   **Recommendation by commit**: 4b uses (a) for `agent.ts:223`; 4c uses (a) for `reminders.ts` (per-tx engine reads it tx-at-a-time anyway, so it's not actually cross-tx). 4d uses (a) for analytics/hub. Each commit notes the decision in its message.

2. **Activity timeline + archived round view (`comms.ts:82`)**:
   Decide whether to extend `getActivityTimeline(transactionId)` with an optional `roundScope` param now (4d), or fold the param into commit 7/8 alongside the archived-round view. Recommend doing it in 4d so commit 7/8 just uses the API.

3. **`allRoundsForAudit` callers**:
   - `analytics.ts:448`, `analytics.ts:459` — platform-wide aggregates
   - `metrics-rollup.ts:171, 182, 192` — platform-wide counts
   - `app/api/cron/content-topics/route.ts:20` — content mining
   - `app/api/cron/medians-ready-check/route.ts:50, 68` — population medians
   Each call site needs an inline comment explaining WHY audit-scope is correct, so a future reader doesn't reflexively "fix" it to `forRound`.

4. **`audit.ts:53`** — read intent before disposition. If audit logs are supposed to show cross-round history, use `allRoundsForAudit`. If they're current-state mirrors, use `forRound(active, tx)`.

---

## Tally

| Category | Count |
|---|---|
| Total production read sites | ~80 |
| Total production write sites (commit 1 conversions) | 25 (catalogued in commit 1) |
| Cross-tx limitation cases | 9 (`agent.ts:223`, `hub.ts:99–512`, `analytics.ts:71/348/356/631/635/647`, `command/overview:118`) |
| `allRoundsForAudit` deliberate sites | 5 (analytics platform-wide, metrics-rollup, content-topics, medians-ready-check) |
| Portal sites (commit 5) | 9 in `lib/services/portal.ts`, 1 in `app/portal/[token]/respond/page.tsx` |
| Type-only refs | 3 |
