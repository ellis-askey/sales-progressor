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
