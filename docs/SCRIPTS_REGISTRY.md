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

---

## Footnotes

- Companion docs: [CLAUDE.md Law 15](../CLAUDE.md#law-15--scripts-must-justify), [BUILD_PLAN.md Phase 4](BUILD_PLAN.md#phase-4--scripts-cull-interleaved-from-week-8).
- Last updated: 2026-06-26.
