#!/usr/bin/env bash
#
# Install Sales Progressor Phase 5 pre-commit hooks on this machine.
#
# Symlinks scripts/hooks/pre-commit into .git/hooks/pre-commit so it
# fires on every commit.
#
# Idempotent — safe to run multiple times.
# Uninstall: scripts/hooks/uninstall.sh

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK_SRC="$REPO_ROOT/scripts/hooks/pre-commit"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "ERROR: source hook not found at $HOOK_SRC" >&2
  exit 1
fi

# Windows / Git Bash may not support symlinks reliably — copy instead.
# Detected by OSTYPE. Copy is safe because the hook re-execs from disk
# each commit; edits to scripts/hooks/pre-commit propagate on re-install.
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  cp -f "$HOOK_SRC" "$HOOK_DST"
  chmod +x "$HOOK_DST" 2>/dev/null || true
  echo "Installed pre-commit hook (copied, Windows-safe)."
  echo "  Re-run this script if you edit scripts/hooks/pre-commit."
else
  ln -sf "$HOOK_SRC" "$HOOK_DST"
  chmod +x "$HOOK_SRC"
  echo "Installed pre-commit hook (symlinked)."
fi

echo ""
echo "Mode: WARN-ONLY until 2026-07-15."
echo "  During warn-only, failures print but the commit proceeds."
echo "  To enforce (block failing commits): export PHASE5_ENFORCE=1"
echo "  To uninstall:                        scripts/hooks/uninstall.sh"
