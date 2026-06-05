#!/bin/bash
# Install a pre-push hook that runs gitleaks on every push and aborts
# on any finding. Reproducible: re-running overwrites the hook so the
# rule stays in sync with this file.
#
# CATEGORY-LEVEL FIX for the 2026-06-04 incident
# (docs/active/incident-2026-06-04-credential-exposure.md): the
# .claude/settings*.json gitignore closes one instance of credential
# leak. This hook closes the category — any pattern gitleaks ships
# detectors for (SendGrid, Stripe, AWS, Azure, GCP, Postgres URLs,
# JWTs, high-entropy strings, etc.) fails the push.
#
# Run:
#   bash scripts/install-gitleaks-hook.sh
#
# Requires gitleaks on $PATH. Auto-installable via:
#   - Windows:  scoop install gitleaks
#   - macOS:    brew install gitleaks
#   - Linux:    https://github.com/gitleaks/gitleaks/releases
# Or point GITLEAKS_BIN at a known path.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK_FILE="$REPO_ROOT/.git/hooks/pre-push"

cat > "$HOOK_FILE" <<'HOOK'
#!/bin/bash
# pre-push: scan the local repo's full history with gitleaks before
# allowing the push to leave the machine. Installed by
# scripts/install-gitleaks-hook.sh; do not edit in place — re-run the
# installer so the source of truth stays in the repo.
#
# Exit codes:
#   0  no findings, push proceeds
#   1  gitleaks reported a finding; push blocked
#   2  gitleaks not on PATH or GITLEAKS_BIN; push blocked with install help

set -uo pipefail

BIN="${GITLEAKS_BIN:-gitleaks}"
if ! command -v "$BIN" >/dev/null 2>&1; then
  if [ -x "/tmp/gitleaks_bin/gitleaks.exe" ]; then
    BIN="/tmp/gitleaks_bin/gitleaks.exe"
  else
    echo "[pre-push] gitleaks not found on PATH (and \$GITLEAKS_BIN is not set / not executable)."
    echo "          Install: scoop install gitleaks  |  brew install gitleaks  |  https://github.com/gitleaks/gitleaks/releases"
    echo "          Or:      export GITLEAKS_BIN=/abs/path/to/gitleaks"
    echo "          Push BLOCKED (refusing to push without a secret scan)."
    exit 2
  fi
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
TMP_REPORT="$(mktemp -t gitleaks-prepush.XXXXXX.json)"
trap 'rm -f "$TMP_REPORT"' EXIT

# Scan full history of the local repo. The "git" subcommand walks every
# commit reachable from refs — same coverage as the audit on 2026-06-04.
"$BIN" git --no-banner --report-format json --report-path "$TMP_REPORT" "$REPO_ROOT" >/dev/null 2>&1
STATUS=$?

if [ "$STATUS" -eq 0 ]; then
  exit 0
fi

# Non-zero: gitleaks found something. Surface the findings and abort.
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  ⛔  PUSH BLOCKED — gitleaks detected potential secrets"
echo "════════════════════════════════════════════════════════════════════"
echo ""
if [ -s "$TMP_REPORT" ]; then
  # Pretty-print up to the first 20 findings.
  if command -v jq >/dev/null 2>&1; then
    jq -r '.[:20][] | "  [" + .RuleID + "]  " + .File + ":" + (.StartLine|tostring) + "  " + (.Match // .Secret // "" | .[:80])' "$TMP_REPORT"
    TOTAL=$(jq -r 'length' "$TMP_REPORT")
    if [ "$TOTAL" -gt 20 ]; then
      echo "  ...and $((TOTAL - 20)) more"
    fi
  else
    head -c 4000 "$TMP_REPORT"
    echo "  (install jq for prettier output)"
  fi
fi
echo ""
echo "  If this is a FALSE POSITIVE, add a fingerprint to .gitleaksignore"
echo "  and re-run the push. The full report is at: $TMP_REPORT"
echo "  (rename it before exiting this shell if you want to keep it.)"
echo ""
exit 1
HOOK

chmod +x "$HOOK_FILE"

echo "Installed pre-push hook at $HOOK_FILE"
echo ""
echo "Quick smoke test:"
BIN="${GITLEAKS_BIN:-gitleaks}"
if command -v "$BIN" >/dev/null 2>&1; then
  echo "  gitleaks on PATH: $($BIN version 2>&1 | head -1)"
elif [ -x "/tmp/gitleaks_bin/gitleaks.exe" ]; then
  echo "  gitleaks at /tmp/gitleaks_bin/gitleaks.exe: $(/tmp/gitleaks_bin/gitleaks.exe version 2>&1 | head -1)"
  echo "  (NB: this is the audit's ephemeral install. For permanent use, install gitleaks via scoop/brew or set GITLEAKS_BIN.)"
else
  echo "  ⚠ gitleaks is NOT on PATH. Install it before pushing again."
  echo "     scoop install gitleaks      (Windows)"
  echo "     brew install gitleaks       (macOS)"
  echo "     https://github.com/gitleaks/gitleaks/releases"
fi
