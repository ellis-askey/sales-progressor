# Phase 5 pre-commit hooks

Automated enforcement of a subset of the 21 Laws (see [CLAUDE.md](../../CLAUDE.md#laws)) that would otherwise depend on the committer remembering to run them.

## What it checks

| Check | Law | What it does |
|---|---|---|
| `tsc --noEmit` | [Law 2](../../CLAUDE.md#law-2--verify-before-claiming-done) | If any `.ts` / `.tsx` file is staged, run tsc. Warn if there are errors. |
| Em-dash in strings | [Law 21](../../CLAUDE.md#law-21--voice-gate-on-user-facing-strings) | Scan staged `.ts`/`.tsx` for `—` inside double-quoted strings. Comments excluded. |
| SCRIPTS_REGISTRY entry | [Law 15](../../CLAUDE.md#law-15--scripts-must-justify) | If a new file was added under `scripts/` (excluding `_archive/`), require an entry in `docs/SCRIPTS_REGISTRY.md`. |

## Install

```bash
scripts/hooks/install.sh
```

Idempotent. Windows-safe (falls back to copy where symlinks don't work).

## Uninstall

```bash
scripts/hooks/uninstall.sh
```

Or manually:

```bash
rm .git/hooks/pre-commit
```

## Modes

- **Warn-only (default until 2026-07-15)** — failing checks print warnings, the commit still proceeds. Point of this window: catch false positives before they block real work.
- **Enforce** — failing checks block the commit. To enable:

  ```bash
  export PHASE5_ENFORCE=1
  ```

  Add to your shell profile to make it permanent. When 2026-07-15 arrives without regressions, the default flips to enforce in a follow-up commit.

## Override (emergencies only)

If a check flags something that legitimately shouldn't block your commit:

- Uninstall temporarily, commit, re-install
- Or run with `git commit --no-verify` (bypasses the hook for one commit)
- Or use `LAWS-OVERRIDE:` in the commit message (documented in `docs/LAW_OVERRIDES.md`, reviewed quarterly)

## What Phase 5 does NOT do

- No CI checks — GitHub Actions is not configured on this repo yet. CI enforcement is a follow-up.
- No ESLint changes — Law 8 (command-centre isolation) is enforced by review, not tooling, for now.
- No package.json changes — no new dependencies. Hook is a plain shell script.
- No blocking on install — you have to run `install.sh` explicitly. Nothing auto-installs.

Deferred to a future Phase 5.5:
- Visual + behavioural + multi-tenant regression in CI (Law 18 + Law 7)
- ESLint rule for `/lib/command/*` import isolation (Law 8)
- Pre-commit sweeps for Law 13 (no-op onClick / dashed-border), Law 14 (canonical primitive check), Law 20 (demo-name grep)
