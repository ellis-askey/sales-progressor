# Phase 1 (BuyerRound relist) — production release runbook

**Status: DRAFT.** Lands with the close of commits 7 + 8. Lives alongside this file in `docs/active/relist-feature/` until executed; promotes to `docs/done/` after a successful prod cutover.

This runbook governs the merge + deploy + post-deploy script ordering for the prod cutover of the BuyerRound (relist) feature. It is the only document that should be open during the cutover — every other reference in this directory is background.

---

## 0. Prerequisites — before the release window starts

- [ ] All Phase 1 commits (1 through 8) landed on `master` via PR review. Branch off `master` is clean.
- [ ] **Staging fixture cleanup**: before the final pre-prod verification report, run the fixture teardown so the report's counts reflect real staging data, not accumulated rehearsal sentinels. As of commit 6 fix-up #2, staging has grown from 59 → 61 transactions across rehearsal runs (the `[commit5 two-round fixture]` and `[commit6 rehearsal] *` sentinel-tagged files). Tear-down commands, in order:
  - `npx -y dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json scripts/rehearsal-commit-6-relist.ts --tear-down`
  - `npx -y dotenv -e .env --override -- npx ts-node --project tsconfig.scripts.json scripts/seed-two-round-fixture.ts --tear-down`
  - Verify: `SELECT COUNT(*) FROM "PropertyTransaction" WHERE "propertyAddress" LIKE '[commit%';` returns 0.
- [ ] Staging run-through completed within the last 7 days, with the rehearsal scripts producing the verbatim-matching output stored in `scripts/rehearsal-commit-6-output.txt` (and the 7/8 equivalents once written).
- [ ] The three prod-side scripts have been DRY-RUN against a fresh prod-restore-on-staging:
  - `scripts/backfill-buyer-round-phase0.ts` (idempotent Round 1 backfill)
  - `scripts/resync-buyer-round-fields.ts` (commit 7's resync — placeholder name)
  - `scripts/reconcile-buyer-round-status.ts` (commit 8's reconciliation — placeholder name)
- [ ] Verification harness (`scripts/verify-buyer-round-phase0.ts` + the per-commit parity harness) all return PASS against the prod-restored staging.
- [ ] User snapshot taken: `pg_dump` of prod, retention 14 days minimum. Restore path tested.
- [ ] Maintenance banner copy approved (default: "Brief maintenance window — file editing temporarily unavailable; viewing unaffected.").

## 1. Cutover window — ordering (CRITICAL)

Every step has an explicit verification step that gates the next. Do not collapse them.

### Step 1 — freeze writes

- Put the maintenance banner up. Disable file-detail action surfaces (a feature flag — drop the existing action surface to read-only mode rather than a 503; lets agents still see their files).
- Confirm: agent file pages render in read-only mode; create-sale / milestone-confirm / chase-send / relist all visibly disabled.

### Step 2 — deploy code (still pre-migration)

- Merge `master` to `prod` branch (or whatever the deploy trigger is). Vercel deploys.
- **MANDATORY HASH CHECK** (commit 6b incident, 2026-06-04): Vercel has been observed silently skipping the auto-build for some pushes — `fbea564` did not trigger a deployment after `git push`, and a manual `vercel` invocation was needed to ship it. Before declaring Step 2 complete:
  - Capture the approved release SHA: `git rev-parse HEAD` on the release branch.
  - Capture the deployed SHA: `curl https://app.thesalesprogressor.co.uk/api/healthz | jq .commitSha` (or whatever `/api/healthz` exposes — if it doesn't expose the SHA today, add that to the route).
  - **The two MUST match.** If they don't: the deploy is stale, a `vercel deploy` against the release SHA is required, do not proceed to Step 3.
- New code is live but the schema-uniqueness migration has NOT applied yet (deploy is gated by the build-step migration runner — verify the migration log shows "skipped" or queued, not "applied").
- This is the safest order: code that knows how to read round-scoped data is deployed BEFORE the migration that enforces the partial uniques. If the migration applies first and code rollback happens, we'd be running old code against new constraints — not catastrophic but easier to avoid.

### Step 3 — apply Phase 1 migration to prod

- `npm run db:migrate:prod` (or equivalent — `node scripts/migrate-prod.mjs`).
- Migration name (per commit 1): `20260604000000_buyer_round_milestone_uniqueness/migration.sql`.
- Verify (psql or Supabase SQL editor):
  ```sql
  SELECT indexname FROM pg_indexes WHERE indexname LIKE '%milestone_completion%uniq%';
  -- expect: milestone_completion_vendor_uniq, milestone_completion_purchaser_uniq
  ```

### Step 4 — backfill Round 1 onto every existing prod transaction (idempotent)

- `npx -y dotenv -e .env.production --override -- npx ts-node --project tsconfig.scripts.json scripts/backfill-buyer-round-phase0.ts`
- Idempotent: re-running is safe (every find-then-create skips existing rows).
- Verify:
  ```sql
  SELECT COUNT(*) FROM "PropertyTransaction" WHERE "activeBuyerRoundId" IS NULL;
  -- expect: 0
  SELECT COUNT(*) FROM "BuyerRound";
  -- expect: equal to COUNT(*) FROM "PropertyTransaction"
  ```
- If any transaction is still unstamped: STOP. Inspect those rows individually before proceeding (most likely: status=draft files, decide per-file whether to backfill or leave at draft).

### Step 5 — resync buyer-side fields (commit 7's script)

- Mirrors PropertyTransaction's buyer-side fields onto BuyerRound (Round 1 only — Round 2+ doesn't exist yet in prod).
- Idempotent.
- Verify with the commit-7 verification harness: `scripts/verify-buyer-round-resync.ts` returns PASS.

### Step 6 — reconcile status (commit 8's script)

- Walks every transaction in status=withdrawn or status=completed and reconciles BuyerRound.status accordingly.
- The single most important script for relist correctness: a withdrawn prod file with status=active on Round 1 would be invisible to the relist action's `tx.status === "withdrawn"` precondition.
- Idempotent.
- Verify:
  ```sql
  -- Every withdrawn tx must have its active round still active (relist-eligible)
  -- OR have already-archived round 1 (only possible with future relists).
  SELECT pt.id, pt.status, br.status, br."archivedAt"
  FROM "PropertyTransaction" pt
  JOIN "BuyerRound" br ON br.id = pt."activeBuyerRoundId"
  WHERE pt.status = 'withdrawn'
    AND br.status NOT IN ('active', 'withdrawn');
  -- expect: 0 rows
  ```

### Step 7 — unfreeze writes

- Take down the maintenance banner.
- Re-enable action surfaces.
- Smoke-test in this order, from an agent account, on a designated test file:
  1. Read the file detail page — all milestones render, no scope errors.
  2. Confirm a vendor milestone.
  3. Send a chase.
  4. Open a portal token, render the progress page, confirm a PM.
  5. Withdraw the file.
  6. Relist with a new buyer.
  7. Open the OLD buyer's portal token — verify DeadRoundNotice renders (the commit-5 friendly notice, not 404).

### Step 8 — post-deploy verification (within 1 hour)

- Run `scripts/parity-commit-5-portal.ts` against PROD with read-only assertions. Should return PASS (0 failures).
- Run `scripts/verify-buyer-round-phase0.ts` against PROD. Should return PASS.
- **Credential hygiene check** (permanent, both must pass — added 2026-06-04 after a staging-side finding that a publicly reachable deploy was running on the literal password `password`):
  ```bash
  npx -y dotenv -e .env.production --override -- npx ts-node \
    --project tsconfig.scripts.json scripts/prod-check-weak-credentials.ts
  ```
  Two sub-checks inside that script, both must return PASS:
  - **(a) No staging test-account emails on prod.** Scans for `emily@hartwellpartners.co.uk` / `alex@hartwellpartners.co.uk` / `sarah@hartwellpartners.co.uk` / `james@hartwellpartners.co.uk`. Any hit means a staging seed was inadvertently applied to prod.
  - **(b) No prod account on a known weak / rotated password.** Every prod `User.password` hash is bcrypt-compared against the historical staging defaults AND the current rotated values from `docs/test-accounts.md`. Any hit means somebody copy-pasted a staging hash onto a real account, or worse — rotate the listed accounts immediately and re-run before proceeding.

  The known-weak list lives inside the script (`KNOWN_WEAK_PASSWORDS` constant). When staging passwords are rotated, the new values must be appended to that list so the next prod check catches them too — otherwise the safety net silently shrinks.
- **NULL-stamp check on engine-written rows** (commit 6 fix-up #2 added this — was previously assumed):
  ```sql
  -- PM-targeted PENDING ChaseTasks with NULL buyerRoundId. Must be 0.
  -- Any > 0 means engine-created tasks pre-followup are still around AND
  -- the re-run of scripts/backfill-buyer-round-phase0.ts in Step 4 didn't
  -- pick them up — investigate that specific file before re-running.
  SELECT COUNT(*)
  FROM "ChaseTask" ct
  JOIN "ReminderLog" rl ON rl.id = ct."reminderLogId"
  JOIN "ReminderRule" rr ON rr.id = rl."reminderRuleId"
  WHERE ct.status = 'pending'
    AND ct."buyerRoundId" IS NULL
    AND rr."targetMilestoneCode" LIKE 'PM%';

  -- Same shape for ACTIVE PM-targeted ReminderLogs. Must be 0.
  SELECT COUNT(*)
  FROM "ReminderLog" rl
  JOIN "ReminderRule" rr ON rr.id = rl."reminderRuleId"
  WHERE rl.status = 'active'
    AND rl."buyerRoundId" IS NULL
    AND rr."targetMilestoneCode" LIKE 'PM%';
  ```
  Why this matters: the relist action's primary KEY 1 cancellation sweep is keyed on `buyerRoundId = outgoingRoundId`. A row left with NULL stamp survives that sweep. The defence-in-depth KEY 3 (PM-prefix sweep) catches the leak anyway, but the post-deploy check is the early-warning that the write-side fix is in place.
- Tail logs for 30 minutes. Watch for `[milestone-scope]` warn lines — these indicate a transaction without an activeBuyerRoundId, which would mean Step 4 missed something.

## 2. Rollback plan

If Step 7 smoke-test fails badly:

- **Code-only failure** (no migration-touching issue): redeploy `master` at the pre-merge SHA. Vercel rollback takes ~2 min. Data is unchanged.
- **Migration-related failure** (partial-unique index conflict): NOT recoverable by code rollback alone. Restore from the pg_dump captured pre-window. This loses any writes that happened during the window — that's why writes are frozen.
- **Backfill produced wrong data** (Step 4 false positive): backfill is idempotent and additive only; manually `DELETE FROM "BuyerRound" WHERE roundNumber = 1 AND createdAt > '$WINDOW_START'` and re-run after fixing.

## 3. Communication

- Internal staff Slack: 1 hour before window start.
- Agency director email (only if window > 30 min expected): 24 hours before.
- Client portals are unaffected during the window — read paths only require the contact + tx rows that already exist; the round-scoping helper degrades gracefully (`forRound(null, txId)` → vendor-only with a logged warning, which the gap-file path handles).

## 4. Sign-off

The cutover is "complete" when:
- [ ] Step 7 smoke-test passes on the chosen test file.
- [ ] Step 8 verification harness returns PASS.
- [ ] No `[milestone-scope]` warns in the 30-minute tail.
- [ ] Maintenance banner is down.
- [ ] Ellis has independently visited a real agency file and confirmed the file detail page renders.

When all six tick, promote this file to `docs/done/relist-feature/prod-release-runbook.md` with the actual cutover date appended.

---

**To be completed in commit 6 + 7 + 8 work** (do NOT execute against prod until the live runbook supersedes this draft):

- [ ] Confirm script names (placeholder names above for commits 7 + 8).
- [ ] Confirm migration filename(s).
- [ ] Add the exact `db:migrate:prod` command + its expected exit-status output.
- [ ] Confirm the maintenance banner mechanism (existing feature flag? Or new env var?).
- [ ] Confirm the rollback SHA capture method (CI artifact? release tag?).
