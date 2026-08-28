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

### scripts/flag-test-agencies-internal.ts

- **Purpose:** Flag test/experiment agencies (e.g. "EXP - DB") as `isInternal = true` so they stop tripping Command Centre signal detectors and polluting metrics.
- **Lifetime:** `one-shot`
- **Author:** CC (Command Centre review — Briefing page), 2026-08-28
- **Deletion criteria:** delete once the target test agencies are flagged internal on both staging and production (tracked in ELLIS_MANUAL_TODO).
- **Justification:** a rare data-hygiene correction, dry-run-guarded, run by the founder against the chosen env. Not a recurring feature; an admin toggle would be over-engineering for a one-off.

### scripts/backfill-property-photos.ts

- **Purpose:** Repair property-photo drift — set `photoStoragePath` on files whose image is in the `property-photos/` storage bucket but whose DB field was never persisted (agent two-step upload missing step 2), so the photo shows again everywhere.
- **Lifetime:** `one-shot`
- **Author:** CC (Command Centre review — Files page), 2026-08-28
- **Deletion criteria:** delete once run on staging + production and the root-cause fix (agent upload persists the field in-request) has shipped.
- **Justification:** a data-repair reconciliation between storage and DB, dry-run-guarded, run by the founder per env. Not a recurring feature.

### scripts/inventory/scripts.ts

- **Purpose:** Walks `scripts/` and emits `docs/inventory/SCRIPTS.md` classifying each script per the cull categories (`archive-delete` / `promote-feature` / `promote-test` / `promote-npm-script` / `keep-as-is`).
- **Lifetime:** `ongoing`
- **Author:** CC (Phase 1), 2026-06-26
- **Deletion criteria:** permanent. Re-run during Phase 4 culls and quarterly thereafter.
- **Justification:** same as components inventory — a maintenance tool that powers a docs artifact.

### scripts/seed-overdue-exchange-demo.ts

- **Purpose:** STAGING demo for the exchange-date work (Note 1 of docs/active/three-notes-distilled-2026-08-26.md). Backfills expectedExchangeDate from the live prediction on every active file, seeds one "moving" file (self-adjusting date) and one "stuck" file (overdue + quiet) so the hub amber item + file revise-banner can be walked through.
- **Lifetime:** `one-shot`
- **Author:** CC, 2026-08-27
- **Deletion criteria:** delete after Ellis has walked the demo and the seeded demo files are removed from staging.
- **Justification:** a throwaway walk-through seeder, staging-only (refuses to run against the prod DB host before any write). Not a feature or test — it fabricates demo state that must never ship to real users (Law 20 keeps demo strings in seed files like this).

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

### scripts/backfill-completed-status.mjs

- **Purpose:** One-shot data fix. (1) Flip to `status='completed'` the outsourced files that have a completion milestone (VM20 or PM27) confirmed but were left stuck on `active` because the old inline gate required BOTH sides to trigger the flip. (2) Null out the one Contact whose `email` field holds a phone number (Emma O'Connell, 20 Williamson Way — phone already lives in `.phone`). Prints before/after evidence; writes run inside one transaction.
- **Lifetime:** `one-shot`
- **Author:** CC (completion auto-flip refactor + safety-net cron), 2026-07-28
- **Deletion criteria:** delete once the 2026-07-28 backfill has run against prod and the nightly `completion-safety-net` cron has been live for one week with a clean sweep.
- **Justification:** legacy row backfill for files that were completed under the old single-path gate. The runtime fix (shared `maybeAutoCompleteTransaction` helper + nightly cron) prevents new instances of this state, so this script only cleans up historical data.

### scripts/annual-leave-name-check.mjs

- **Purpose:** Read-only. Builds the recipient list for the 2026 annual-leave notice (every vendor/purchaser contact on an active outsourced file that has an email and is not unsubscribed) and prints a name-approval table: raw stored name → proposed "Hi ___" greeting → flags on anything that looks wrong (title + surname only, company name, joint parties, missing name, comma format). Writes `docs/annual-leave-name-check-2026.md`.
- **Lifetime:** `one-shot`
- **Author:** CC (annual-leave 2026-07-30 send), 2026-07-27
- **Deletion criteria:** delete once the 2026 annual-leave send is completed and signed off.
- **Justification:** name-quality QA gate that has to look at prod contact rows before the send goes out. Not surface-eligible: it is a one-time operator step, not an ongoing agency-facing action.

### scripts/generate-annual-leave-emails.mjs

- **Purpose:** One-shot generator. Pulls every active outsourced transaction from prod, produces two annual-leave notification emails per file (vendor + purchaser), writes `docs/annual-leave-emails-2026-07-30.md` for review before send.
- **Lifetime:** `one-shot`
- **Author:** CC (annual-leave 2026-07-30 send), 2026-07-27
- **Deletion criteria:** delete once the 2026 annual-leave send is completed.
- **Justification:** preview step so the drafts can be reviewed as a single document before the send script goes live.

### scripts/annual-leave-send.mjs

- **Purpose:** Sends the 2026 annual-leave notice to every buyer/seller on an active outsourced file. Three modes: default = preview (writes `docs/annual-leave-emails-final.md`, sends nothing); `--test` = representative samples to `ellisaskey@googlemail.com`; `--send` = full batch to real recipients (guarded).
- **Lifetime:** `one-shot`
- **Author:** CC (annual-leave 2026-07-30 send), 2026-07-28
- **Deletion criteria:** delete once the 2026 annual-leave send is completed.
- **Justification:** one-off notice tied to a specific date range (30 July - 10 August 2026). Not surface-eligible: template + recipient shape are specific to this event and would rot if kept as a general feature.

### scripts/backfill-stuck-completions-2026-08-08.mjs

- **Purpose:** One-shot backfill for four files (18 Commissioner Rd, 17 Bushy Ave, 29 Sears Dr, 54 Launcelot Rd) that Ellis confirmed via the reconciliation modal on 2026-08-08 but which stayed in Active because `confirmExchangeReconciliationAction` was missing the auto-flip call. Root cause fixed in the same PR (`app/actions/milestones.ts` + `app/actions/tasks.ts`); this script writes the same status flip + activity note + audit event that the runtime helper would have written.
- **Lifetime:** `one-shot`
- **Author:** CC (auto-flip bugfix 2026-08-08), 2026-08-08
- **Deletion criteria:** delete after the run confirms all four files flipped (target 2026-08-15).
- **Justification:** past-tense data repair. The runtime fix in the same PR prevents this happening again; the four already-confirmed files can't be rescued by a code fix so a one-shot backfill is the correct shape.

---

## Footnotes

- Companion docs: [CLAUDE.md Law 15](../CLAUDE.md#law-15--scripts-must-justify), [BUILD_PLAN.md Phase 4](BUILD_PLAN.md#phase-4--scripts-cull-interleaved-from-week-8).
- Last updated: 2026-08-08.

### scripts/seed-emily-countdown-sdlt.ts

- **Purpose:** Additively creates one exchanged-purchase demo file on Emily's account (£650k, completing in 14 days) so Ellis can view the completion countdown + stamp-duty estimate on one portal link.
- **Lifetime:** `one-shot`
- **Author:** Claude, 2026-08-16
- **Deletion criteria:** delete once the completion-countdown + SDLT features are signed off by Ellis.
- **Justification:** demo data seeding, not a feature/test/npm-script. Additive and idempotent-safe (creates only), guarded to Emily's account.

### scripts/seed-portal-batch-aug17.ts

- **Purpose:** Additively creates two demo files on Emily's account (one exchanged, one pre-exchange) so Ellis can view the 2026-08-17 portal batch: Save-contact vCard, new-since-last-visit markers, and add-expected-exchange-to-calendar. Also sets the agency sender email + Emily's phone + an own-side conveyancer with email/phone so the buttons have data.
- **Lifetime:** `one-shot`
- **Author:** Claude, 2026-08-17
- **Deletion criteria:** delete once the Aug-17 portal batch is signed off by Ellis.
- **Justification:** demo data seeding, not a feature/test/npm-script. Staging-only (refuses prod) because it mutates shared rows (agency sender, Emily's phone); file creation is additive.

### scripts/backfill-solicitor-summaries.ts

- **Purpose:** Re-render the stored `summaryText` on existing solicitor-confirmed `MilestoneCompletion` rows to the approved sentence form ("{firm} confirmed they have ordered the searches"). Read-time surfaces already regenerate; this fixes the stored text shown on the hub + file activity timeline so past confirms read identically to new ones.
- **Lifetime:** `one-shot`
- **Author:** Claude, 2026-08-25
- **Deletion criteria:** delete once it has run on production.
- **Justification:** one-off data backfill of a display string on solicitor-confirmed rows; not a feature/test/npm-script. Idempotent (only rewrites rows whose text differs).
