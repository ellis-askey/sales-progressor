# Scripts Registry

Every file in `scripts/` is registered here per [Law 15 (scripts must justify)](../CLAUDE.md#law-15--scripts-must-justify). New entries are added in the same PR that adds the script. Pre-commit hook checks this (warn-only in Phase 5).

## Format

```
### <relative-path>

- **Purpose:** one-line description
- **Lifetime:** `one-shot` | `ongoing`
- **Author:** <name>, <YYYY-MM-DD>
- **Deletion criteria:** for one-shots, what condition triggers removal. For ongoing, "permanent".
- **Justification:** why this is a script and not a feature / admin action / test / npm script.
```

---

## Grandfathered (pre-Law-15)

**All scripts in `scripts/` as of commit `cd746f2` (2026-06-26)** are grandfathered. The bulk inventory + cull plan lives at [`inventory/SCRIPTS.md`](inventory/SCRIPTS.md). They will be culled in Phase 4 of [BUILD_PLAN.md](BUILD_PLAN.md) — target ≤ 15 files.

Grandfathered scripts do **NOT** need individual entries in this registry. They are tracked via the SCRIPTS.md census instead, which categorises each as `archive-delete` / `promote-feature` / `promote-test` / `promote-npm-script` / `keep-as-is`.

## New entries (post-Law-15)

### scripts/inventory/components.ts

- **Purpose:** Walks `components/` and emits `docs/inventory/COMPONENTS.md` classifying each component as `canonical` / `to-extract` / `domain-specific` / `outlier-grandfathered` per the catalog.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 1), 2026-06-26
- **Deletion criteria:** permanent. Re-run during the quarterly catalog review.
- **Justification:** generates a docs artifact that powers the catalog acceptance gate. Not a feature, not a test, not user-facing. Belongs in `scripts/` as a maintenance tool.

### scripts/inventory/scripts.ts

- **Purpose:** Walks `scripts/` and emits `docs/inventory/SCRIPTS.md` classifying each script per the cull categories (`archive-delete` / `promote-feature` / `promote-test` / `promote-npm-script` / `keep-as-is`).
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 1), 2026-06-26
- **Deletion criteria:** permanent. Re-run during Phase 4 culls and quarterly thereafter.
- **Justification:** same as components inventory — a maintenance tool that powers a docs artifact.

### scripts/seed-playwright-director.ts

- **Purpose:** Creates or refreshes a dedicated staging director user (`playwright-baseline@thesalesprogressor.test`) with a known password matching `TEST_PASSWORD`. Used by `e2e/baseline-file-detail.spec.ts` for autonomous Playwright screenshot capture and surface-1 E2E coverage.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 3 Step 1), 2026-06-29
- **Deletion criteria:** delete only if Phase 3 surface remediation is complete AND the autonomous capture spec is also deleted.
- **Justification:** seeds an idempotent, scoped test user. Refuses to run against prod DB at runtime (checks `DATABASE_URL` host before any write). Not a feature, not an npm script — proper one-shot/ongoing staging-only seeder.

### scripts/inventory/surfaces.ts

- **Purpose:** Walks `app/` for `page.tsx` files and emits `docs/inventory/SURFACES.md` listing every route with audience role and rough complexity score.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 1), 2026-06-26
- **Deletion criteria:** permanent. Re-run when adding new routes or when re-ordering the Phase 3 queue.
- **Justification:** powers the Phase 3 surface queue in BUILD_PLAN.

### scripts/backfill-mode-profile.ts

- **Purpose:** Exports `backfillModeProfiles()` used by the daily cron at `/api/cron/backfill-mode-profile`. The script file is effectively a shared library that the cron route imports.
- **Lifetime:** `ongoing`
- **Author:** promoted-to-keep during Phase 4 K1 cull, 2026-07-01
- **Deletion criteria:** delete only if the cron at `app/api/cron/backfill-mode-profile/route.ts` is also removed or refactored to inline the logic.
- **Justification:** the census heuristic flagged this as `archive-delete` (looked like a one-shot backfill from the filename), but the tsc check caught the live import. Better to reclassify as ongoing than to promote to `lib/services/`, which would spread the module without behaviour change. Future refactor: move into `lib/services/` alongside other services, delete the script.

### scripts/vercel-db-deploy.mjs

- **Purpose:** Runs `prisma migrate deploy` conditionally on `VERCEL_ENV=production`. Called by `npm run build`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered — established build-time hook.
- **Deletion criteria:** delete only if Vercel replaces or removes the build-time hook path.
- **Justification:** live build-time dependency; cannot be replaced with an npm script alone because of the conditional VERCEL_ENV branch.

### scripts/migrate-prod.mjs

- **Purpose:** Wrapper for `npm run db:migrate:prod`. Applies Prisma migrations to the production DB with confirmation prompts.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when the equivalent workflow moves to a `/command/*` admin action.
- **Justification:** critical production tool. Cannot be a plain npm script because of confirmation flow.

### scripts/seed-demo.ts

- **Purpose:** Seeds the demo dataset for local + staging via `npm run demo:seed`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when demo dataset seeding moves into a first-party CLI or is retired.
- **Justification:** referenced by `demo:seed` in package.json; still active dev flow.

### scripts/reset-demo.ts

- **Purpose:** Resets the demo dataset via `npm run demo:reset`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** paired with seed-demo — same criteria.
- **Justification:** live npm script.

### scripts/demo-verify.ts

- **Purpose:** Verifies demo dataset state via `npm run demo:verify`.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** paired with seed-demo — same criteria.
- **Justification:** live npm script.

### scripts/reset-db.ts

- **Purpose:** Development utility to reset the local DB.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete only if replaced by a first-party CLI.
- **Justification:** local dev utility, not surface-eligible.

### scripts/health-audit-prod.mjs

- **Purpose:** Recurring production health audit; scanned during quarterly reviews.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when health surfaces move to a `/command/insights` dashboard.
- **Justification:** recurring maintenance tool; not user-facing.

### scripts/install-gitleaks-hook.sh

- **Purpose:** Installs the gitleaks pre-commit hook for local dev.
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when the hook is bundled into a first-party tool.
- **Justification:** dev-machine setup script; runs once per clone.

### scripts/seed-test-accounts.ts

- **Purpose:** Seeds test accounts used by the Playwright E2E suite (referenced in `e2e/README-package-d.md`).
- **Lifetime:** `ongoing`
- **Author:** grandfathered.
- **Deletion criteria:** delete when the E2E suite is retired or migrates to a self-seeding fixture pattern.
- **Justification:** paired with the E2E harness; alternative would be per-test seeding which is more expensive.

### scripts/hooks/pre-commit

- **Purpose:** Phase 5 MVP pre-commit hook. Runs 3 checks against staged files: `tsc --noEmit` (Law 2), em-dash sweep in double-quoted strings (Law 21), SCRIPTS_REGISTRY entry required for any new `scripts/` file (Law 15).
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 5 MVP), 2026-07-01
- **Deletion criteria:** delete when replaced by a more comprehensive Phase 5.5 hook or a Husky-based flow.
- **Justification:** enforcement of Laws that would otherwise depend on the committer remembering. Warn-only until 2026-07-15 then flips to block. Installed opt-in via `install.sh`; not part of `npm install` flow.

### scripts/hooks/install.sh

- **Purpose:** Idempotent installer that symlinks (or copies on Windows) `scripts/hooks/pre-commit` into `.git/hooks/pre-commit`.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 5 MVP), 2026-07-01
- **Deletion criteria:** paired with pre-commit hook.
- **Justification:** local dev-machine setup script; runs once per clone.

### scripts/hooks/uninstall.sh

- **Purpose:** Removes the Phase 5 pre-commit hook. Emergency escape hatch if the hook misbehaves.
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 5 MVP), 2026-07-01
- **Deletion criteria:** paired with pre-commit hook.
- **Justification:** critical fallback; complements install.sh.

### scripts/audit-broken-postcodes.mjs

- **Purpose:** Read-only audit that finds every `PropertyTransaction.propertyAddress` (and `ChainLink.stubPropertyAddress`) where the UK postcode segment matches the postcode regex but isn't already uppercase. Prints the list; makes no writes.
- **Lifetime:** `one-shot`
- **Author:** CC (postcode normalisation, hub polish arc), 2026-07-03
- **Deletion criteria:** delete once `fix-broken-postcodes.mjs` has run against prod and the audit returns zero rows for two consecutive runs.
- **Justification:** paired with the runtime fix (normaliser at every write path — `createTransaction`, `stubFields`, claim-signup route). Retro-audit needs raw SQL against prod, not a first-party admin action.

### scripts/fix-broken-postcodes.mjs

- **Purpose:** One-shot retroactive fix that uppercases mixed-case postcode segments in existing `PropertyTransaction.propertyAddress` and `ChainLink.stubPropertyAddress` rows. Dry-run by default; `--commit` to write.
- **Lifetime:** `one-shot`
- **Author:** CC (postcode normalisation, hub polish arc), 2026-07-03
- **Deletion criteria:** delete after the audit (see above) returns zero rows across staging + prod for two consecutive runs.
- **Justification:** legacy row backfill. Runtime writes are now normalised, so this only cleans up historical data. Not surface-eligible.

### scripts/seed-billy-hub-preview.ts

- **Purpose:** Seeds the `ellisaskey+billy@googlemail.com` account on staging with ~20 test transactions spread across the five pipeline-at-a-glance stages (new/legals/ready/exchanging/completed) plus expected exchange dates that populate the diary + forecast. Powers the hub-polish PR 1 + PR 2 preview.
- **Lifetime:** `one-shot`
- **Author:** CC (hub polish preview), 2026-07-02
- **Deletion criteria:** delete once Billy has viewed the polished hub and confirmed direction. Ideally within 2 weeks.
- **Justification:** required exactly-once data population for a specific test account on staging. Refuses to run against prod DB at runtime. Idempotent — safe to re-run.

---

## Footnotes

- Companion docs: [CLAUDE.md Law 15](../CLAUDE.md#law-15--scripts-must-justify), [BUILD_PLAN.md Phase 4](BUILD_PLAN.md#phase-4--scripts-cull-interleaved-from-week-8).
- Last updated: 2026-06-26.
