# scripts/_archive/

Soft-delete holding area per [BUILD_PLAN.md Phase 4 workflow](../../docs/BUILD_PLAN.md#phase-4--scripts-cull-interleaved-from-week-8).

## Rule

Files here have been categorised `archive-delete` in [docs/inventory/SCRIPTS.md](../../docs/inventory/SCRIPTS.md). They sit in this directory for **2 weeks minimum** before hard-deletion. If nothing breaks in that window, they get removed.

## Restoring a file

If something breaks and points at a script here:

1. `git mv scripts/_archive/<file> scripts/<file>` to restore
2. Add a proper [SCRIPTS_REGISTRY.md](../../docs/SCRIPTS_REGISTRY.md) entry per Law 15 justifying why it lives
3. Remove it from the archive-delete category in [SCRIPTS.md](../../docs/inventory/SCRIPTS.md)

## Waves

### Wave K1 — 2026-07-01

39 scripts moved from `scripts/` per the archive-delete category in the Phase 1 census. Hard-delete target: **2026-07-15** (2 weeks). Includes:

- 9 audit-* scripts (one-off findings work)
- 10 backfill-* scripts (one-shot data fixes, already applied — see exception below)
- 4 inspect-* / diagnose-* (per-file investigation snapshots)
- 3 one-off-* / retro-pass-* (tagged explicitly as one-shot)
- 2 persona-* / rehearsal-* (pre-launch setup)
- 4 send-test-* / resend-* (one-off email verification)
- 2 setup-staging-* (staging seed one-offs)
- 5 misc (append-known-weak-passwords, fix-legacy-*, fix-mos-*, sweep-stale-ccs*)

One exception to the census heuristic caught during K1:
- `scripts/backfill-mode-profile.ts` — census flagged as archive-delete but `app/api/cron/backfill-mode-profile/route.ts` imports `backfillModeProfiles` from it. **Restored + reclassified as ongoing.** Registry entry added to [SCRIPTS_REGISTRY.md](../../docs/SCRIPTS_REGISTRY.md).

Pre-move safety checks:
- No references in `package.json` scripts for the 38 archived files
- No references in `vercel.json` crons for the 38 archived files
- No CI workflows (no `.github/workflows/`)
- Full grep of `app/`, `lib/`, `components/`, `__tests__/`, `e2e/` for `@/scripts/<name>` imports on the 38 remaining archived files — clean

### Wave K2 — 2026-07-01

Follow-up cull, 84 scripts moved. Hard-delete target: **2026-07-15**. Two sub-batches:

**K2a — 43 keep-as-is one-shots the heuristic missed** — pattern-matched one-shot names that the census classifier put in `keep-as-is` but are structurally identical to K1's archive-deletes:

- 4 versioned `insert-prod-terms-v1/v2/v3` + `insert-staging-terms-v1` (v4 is latest, older are one-time)
- 3 `parity-*` / `probe-*` audit scripts
- 4 `reconcile-*` / `resync-*` one-shot syncs
- 3 file-specific: `put-tresco-on-hold`, `reset-and-seed-emily-staging`, `reset-item-8-staging`
- 9 `seed-*` scenario-specific one-shots (cotham, cutover, darnley, pending-chase-emails, staging-payments-tour, staging-spot-check, trial-expired-account, two-round-fixture, completions)
- 3 `update-*-terms-*` one-time term rephrases
- 3 `test-*` / `trace-*` one-off dev tools
- 3 `verify-*` staging PR verifications
- Rest: `apply-chase-timings-update`, `chase-engine-busiest-file`, `cleanup-feedback-screenshots`, `clear-trial-expired-acknowledgements`, `create-claim-fixture`, `delete-staging-terms-v1`, `demo-purchaser-solicitor-chase-stamp`, `list-milestone-defs`, `manual-drain-milestone-digests`, `prod-check-weak-credentials`, `rotate-staging-test-passwords`, `screenshot-audit-gallery`, `spot-check-payments-tour`, `staging-billing-state`, `swap-env-once`

**K2b — 41 promote-test scripts archived (deferred to Jest)** — the census `promote-test` category. Their verification logic is preserved in `_archive/` as reference material for when the Jest test is actually written. Promoting each into a proper Jest test is a much bigger task per script; archiving them clears the surface area while keeping the code recoverable.

Includes: all `verify-a2/a3/a4/a5/a5-precheck/a6/b1/b2/b2-precheck/b3/b4/b5/b6/b7/6b-playwright/8-playwright/buyer-round-phase0/commit3-create-flow/honest-chase-count/hub-card-playwright/hub-card-rehearsal/hub-diary/milestone-scope/payments-scaffolding-staging/phase-2-read-shape/pr2-pr8-staging/reconcile-state/resync-state/summary-grammar` + all `check-*` verification scripts + `smoke-check.js`.

Pre-move safety checks:
- All 84 moves grep-clean across `app/`, `lib/`, `components/`, `__tests__/`, `e2e/`
- No `package.json` or `vercel.json` references

### Wave K3 — 2026-07-01

Final cull, 16 more moves + 2 log files deleted. Hard-delete target: **2026-07-15**. Reached the Phase 4 target of ≤ 15 tracked scripts.

Moved to `_archive/`:
- `build-chase-timings-spreadsheet.ts` (one-off report)
- `ensure-playwright-test-user.ts` (superseded by `seed-playwright-director.ts`)
- `export-logo.js` (one-off asset generation)
- `insert-prod-terms-v4.ts` (v4 latest but one-time-per-env; comment-only reference in `app/billing-terms/page.tsx`)
- `migrate-gap5.ts` (one-shot migration)
- `migrate-john-desimone-to-via-properties.ts` (file-specific)
- `render-chase-samples.ts` / `render-email-snapshot.ts` / `render-feature-reference-pdf.js` / `render-milestone-digest-sample.ts` (dev sample generators)
- `seed-chain-closed-loop-fixtures.ts` / `seed-chain-fixtures.ts` (fixture-specific)
- `seed-completions.ts` (K2 miss, caught during K3 sweep)
- `seed-staging-test-data.ts` (staging one-off)
- `verify-6b-render.sh` (one-off)
- `help-screenshots/` directory (4 files: `capture.ts`, `playwright.config.ts`, `polish.ts`, `seed-artifacts.json` — help-doc generation tool, Phase-2-era, unused since)

Deleted outright (log/artifact files, not scripts):
- `scripts/backfill-rerun-output.txt`
- `scripts/rehearsal-commit-6-output.txt`

Also cleared local artifact directories `scripts/output/`, `scripts/snapshots/`, `scripts/screenshots/` — all gitignored, never committed. Local disk cleanup only.

## Post-K3 state

**Tracked scripts remaining: 14** (target ≤ 15). Full list in [SCRIPTS_REGISTRY.md](../../docs/SCRIPTS_REGISTRY.md).

- 4 npm-script wrappers: `demo-verify`, `reset-demo`, `seed-demo`, `migrate-prod`
- 1 build-time hook: `vercel-db-deploy`
- 3 inventory tools: `inventory/{components,scripts,surfaces}.ts`
- 3 dev / recurring maintenance: `reset-db`, `install-gitleaks-hook.sh`, `health-audit-prod`
- 2 E2E fixtures: `seed-playwright-director`, `seed-test-accounts`
- 1 cron library: `backfill-mode-profile`
