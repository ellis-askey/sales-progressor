# Milestone unlock self-heal — plan

**Status:** BUILT 2026-09-29 (Option A). Pure decision `computeReconcileUnlocks`
(lib/milestones/reconcile.ts) + `reconcileMilestoneStates` / `reconcileAllActiveMilestoneStates`
(lib/services/milestones.ts) + nightly cron (app/api/cron/reconcile-milestone-states,
02:00 UTC) + 9 unit tests. tsc clean. Read-only prod dry-run: 0 of 47 active files
stranded (no false positives). Admin-trigger UI + observability log deferred (the
console.error swallow is already greppable; cron heals nightly).
**Author:** Claude Code session, 2026-09-28
**Trigger:** 2 The Courtyard (`cmtvhfbiu000ba2rneocfyuhs`) — searches (PM8) stuck showing
"locked / previous steps must be completed first" on the Steps tab while both its
prerequisites (PM7 draft pack received, PM4 money on account) were complete, and the
reminders side had correctly raised the searches chase.

---

## The problem in one paragraph

A milestone's `locked` / `available` status is stored as a **cached field** on
`MilestoneCompletion.state`. That field only ever flips `locked → available` through
one code path: `unlockDirectDependents` (lib/services/milestones.ts), which runs as a
**post-completion side effect** when a prerequisite step is confirmed. That side effect
is deliberately wrapped in a swallow-and-continue `try/catch` (milestones.ts:1313-1317)
so a failure never blocks the completion save — and there is a `!wonRace` early return
(milestones.ts:1276-1282) that skips the side effects entirely on concurrent writes.
**Nothing ever recomputes the cached state afterwards.** So if that one unlock fails,
is skipped, or is bypassed (e.g. an out-of-order confirmation or a back-fill/repair that
writes the row directly), the dependent step is stranded as `locked` forever, with no
error surfaced and no self-heal.

Meanwhile the **reminder engine** (lib/services/reminders.ts:870-895) recomputes
prerequisite readiness **live on every pass**. So the two surfaces read different
sources of truth — one cached, one live — and can disagree indefinitely. That is exactly
the split seen on this file.

### Evidence from the incident
- PM8 completion row `state=locked`, `updatedAt` = file-creation moment (never rewritten).
- `MilestoneAvailabilityEvent` log for the file has **zero** entries after 16 Sept; PM4
  was confirmed 23 Sept and produced **no** availability events at all.
- On 16 Sept the cascade fired for **VM7's** dependents (VM10, VM16 → became available)
  but **not** for **PM7's** dependents (PM8, PM14).
- The repair found **two** stranded steps, not one: PM8 (searches) *and* PM14 (initial
  enquiries raised). PM14's only prerequisite is PM7 — money on account is irrelevant to
  it — yet it too never unlocked. That rules out the money-on-account timing as the cause
  and points squarely at PM7's cascade never running.

### Precise root cause (sharpened after the repair)
The contract-pack pair VM7 (issued) / PM7 (received) complete together: confirming either
side recursively calls `completeMilestone` for the counterpart (milestones.ts:1435-1464).
That recursive call is where PM7's `unlockDirectDependents` would run. **But if the
counterpart row is already `complete` when the reflection fires, the recursive call hits
the `!wonRace` early return (milestones.ts:1276-1282) and skips ALL side effects —
including the unlock cascade for that side's dependents.** On this file PM7 was already
`complete` (seeded/back-filled outside the normal confirm path) before VM7's reflection
ran, so PM7's cascade was short-circuited and every buyer step waiting on PM7 (PM8, PM14)
was stranded. Generalised: **any time a milestone's row is already `complete` when its
completion path is (re)invoked, the dependents it should have unlocked are never
cascaded** — most easily triggered by seed/back-fill/repair writes or a genuine race.

---

## Why this is a general fragility, not just a demo-file quirk

The trigger here was an unusual, hand-repaired file. But the underlying weakness is
generic: **any** transient failure of `unlockDirectDependents` (DB blip, deploy race,
the `!wonRace` skip firing when the winner also didn't cascade) permanently strands a
step, because the cached state is never reconciled. Rare in practice, but silent and
unrecoverable-without-intervention when it happens.

---

## Options considered

### Option A — Nightly reconcile job (recommended)
A scheduled job (Vercel cron, alongside the existing reminder crons) walks active
transactions and, per file, recomputes each `locked` step against `DIRECT_PREREQUISITES`
in the active-round scope. Any `locked` step whose direct prerequisites are all
`complete`/`not_required` is flipped to `available` and a `became_available`
(`cause: "reconcile"`) event is recorded.

- **Pros:** self-heals every stranded step platform-wide, not just future ones; reuses
  the exact rule the live path already uses; cheap; auditable via the event log; excludes
  the bilateral/gate steps (VM18/PM25/VM19/PM26/VM20/PM27) which have their own logic.
- **Cons:** up-to-24h lag before a stranded step frees itself (acceptable — chasing still
  works live in the meantime); one more cron to own.
- **Shape:** extract the per-file reconcile into a pure helper
  `reconcileMilestoneStates(tx, db)` reused by (1) the cron and (2) a manual admin action.

### Option B — Compute readiness live in the Steps view (make the cache advisory)
Change the Steps surface to derive `available` from prerequisites at read time (the way
the reminder engine already does) rather than trusting the stored `state`.

- **Pros:** the two surfaces can never disagree again; no lag.
- **Cons:** larger blast radius — `state` is read in many places (portal, work-queue,
  risk, display-stages, exchange prediction); touching the read model risks behavioural
  drift across all of them. Higher regression surface, needs Law 17 baseline capture.

### Option C — Belt-and-braces on the write path
Make `unlockDirectDependents` failures visible (structured log + a lightweight "unlock
debt" marker) and re-drive them on next completion, and re-run the cascade after
back-fill/repair writes.

- **Pros:** fixes the source, not just the symptom.
- **Cons:** doesn't heal already-stranded rows; the `!wonRace` and back-fill bypasses are
  the hard cases to cover exhaustively.

---

## Recommendation

**Ship Option A** (nightly reconcile + shared helper + manual admin trigger). It heals
existing and future strandings, reuses the live rule, is low-risk, and is independently
testable. Fold in the **logging half of Option C** (surface `unlockDirectDependents`
failures instead of swallowing them silently) so we get told when it happens rather than
discovering it by eye months later. Defer Option B unless disagreement recurs after A.

---

## Work breakdown (Option A)

1. **Extract the rule** — `reconcileMilestoneStates(transactionId, db)` in
   lib/services/milestones.ts: active-round-scoped, applies `DIRECT_PREREQUISITES`,
   excludes bilateral/gate codes, flips `locked → available`, records
   `MilestoneAvailabilityEvent` (`cause: "reconcile"`). Pure and idempotent.
2. **Unit tests** — out-of-order completion; back-filled prereq; already-available
   (no-op); gate steps never auto-flipped; multi-round scoping.
3. **Cron** — `app/api/cron/reconcile-milestone-states/route.ts`, daily, iterate active
   transactions, call the helper, count + log flips. Register in vercel.json.
4. **Manual trigger** — an admin action on the file view ("Recompute step states") using
   the same helper, for on-demand repair without waiting for the cron.
5. **Observability** — replace the silent `console.error` swallow in
   `completeMilestone`'s `unlockDirectDependents` catch with a structured log line so a
   live failure is greppable in Vercel logs.
6. **Backfill** — one-shot run of the helper across all active files to clear any
   currently-stranded steps (registered + deletion-tracked per Law 15).

## Out of scope
- Changing the Steps read model (Option B).
- The exchange-gate / bilateral unlock logic (separate machinery, untouched).

## Enforcement / DoD
- `npx tsc --noEmit` clean; unit tests green.
- One concern per PR (Law 5): helper+tests, cron, admin action, observability, backfill
  as separate PRs in that order.
- Migrations: none (no schema change — reuses `MilestoneAvailabilityEvent`).
