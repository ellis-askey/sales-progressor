#!/usr/bin/env bash
#
# Uninstall the Sales Progressor Phase 5 pre-commit hook.
#
# Removes .git/hooks/pre-commit if it points at the Phase 5 hook.
# Idempotent — safe to run multiple times.

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK_DST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -e "$HOOK_DST" ]; then
  echo "No pre-commit hook installed. Nothing to do."
  exit 0
fi

rm -f "$HOOK_DST"
echo "Uninstalled pre-commit hook."
