#!/bin/bash
# Commit 6b verification — fetch the rendered file-detail page on the
# deploy preview while authenticated as a real agent (emily) and confirm
# the LOCKED banner copy renders verbatim AND the locked confirmation-step
# copy is present in the JS bundle shipped to the browser.
#
# Inputs (env): BASE_URL (preview alias), EMAIL, PASSWORD, TX_ID
# Outputs: HTML capture + a verbatim hit/miss report on each locked line.

set -u
BASE_URL="${BASE_URL:-https://salesprogressor-git-feat-buyer-rou-7a8164-ellis-askeys-projects.vercel.app}"
EMAIL="${EMAIL:-emily@hartwellpartners.co.uk}"
PASSWORD="${PASSWORD:-password}"
TX_ID="${TX_ID:-cmpxscj50005hxcezclrey0bn}"  # 33 Berkeley Square - withdrawn, exchangedAt null
COOKIE_JAR="$(mktemp)"
OUT_HTML="$(mktemp).html"
OUT_NORM="$(mktemp).html"
trap 'rm -f "$COOKIE_JAR" "$OUT_HTML" "$OUT_NORM"' EXIT

echo "== Preview: $BASE_URL"
echo "== Login:   $EMAIL"
echo "== File:    $TX_ID (33 Berkeley Square, Bristol — withdrawn, exchangedAt null)"
echo ""

# 1. CSRF + session cookies.
CSRF_JSON="$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" "$BASE_URL/api/auth/csrf")"
CSRF_TOKEN="$(echo "$CSRF_JSON" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
if [ -z "$CSRF_TOKEN" ]; then echo "FAIL: no CSRF"; exit 1; fi
echo "[1/5] CSRF token captured."

# 2. Credentials login.
HTTP_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" \
  -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "$BASE_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF_TOKEN" \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode "callbackUrl=$BASE_URL/" \
  --data-urlencode "json=true")
echo "[2/5] Login POST: HTTP $HTTP_LOGIN"
if [ "$HTTP_LOGIN" != "200" ] && [ "$HTTP_LOGIN" != "302" ]; then echo "FAIL: login"; exit 1; fi

# 3. Verify session.
SESSION_USER="$(curl -s -b "$COOKIE_JAR" "$BASE_URL/api/auth/session" | sed -n 's/.*"email":"\([^"]*\)".*/\1/p')"
echo "[3/5] Session: user=$SESSION_USER"
if [ "$SESSION_USER" != "$EMAIL" ]; then echo "FAIL: session"; exit 1; fi

# 4. Fetch the file-detail page.
HTTP_PAGE=$(curl -s -L -b "$COOKIE_JAR" -o "$OUT_HTML" -w "%{http_code}" "$BASE_URL/agent/transactions/$TX_ID")
HTML_BYTES=$(wc -c < "$OUT_HTML")
echo "[4/5] Page fetch: HTTP $HTTP_PAGE  bytes=$HTML_BYTES"

# 5. Normalise HTML entities so apostrophe encoding doesn't fail the match.
sed -e 's/&#x27;/'\''/g' -e 's/&#39;/'\''/g' -e 's/&amp;/\&/g' -e 's/&quot;/"/g' "$OUT_HTML" > "$OUT_NORM"
echo "[5/5] HTML entity-normalised for matching."
echo ""

# ── LOCKED COPY (verbatim from Ellis 2026-06-04) ─────────────────────────
BANNER_TITLE="This sale fell through."
BANNER_BODY="When you find a new buyer, relist the sale. The new buyer's steps start fresh, and the seller keeps everything that doesn't depend on the buyer."
BANNER_CTA="Relist sale"

CONFIRM_LEADIN_HEAD="You're relisting this sale with"
CONFIRM_LEADIN_TAIL="Here's what happens."

CONFIRM_CARRIES_1="The seller's solicitor instruction, client care pack, ID and AML checks, property information forms, and the management pack."
CONFIRM_CARRIES_2="The seller's contact details and portal access."
CONFIRM_CARRIES_3="The full sale history in the seller's view."

CONFIRM_FRESH_1="A new memorandum of sale to send to both solicitors."
CONFIRM_FRESH_2="Every step on"  # head — buyerName interpolated, then "'s side."
CONFIRM_FRESH_3="The draft contract pack, reissued to the new buyer's solicitor, and enquiries from scratch."
CONFIRM_FRESH_4="Contract signing, exchange and completion steps."
CONFIRM_FRESH_5="Expected exchange and completion dates are cleared."

OLD_BUYER_NOTE='The previous buyer'\''s portal link will land on a "this link is no longer active" page.'
OLD_BUYER_TAIL="Their progress is kept in the file's history but won't drive anything new."

NEG_1="The seller's progress stays where it is."   # OVERCLAIMED line, must be gone
NEG_2="title pack"                                  # WRONG noun, must be gone
NEG_3="Every buyer-side step for"                   # old phrasing, must be gone

check_html() {
  local label="$1"; local needle="$2"
  grep -q -F "$needle" "$OUT_NORM" && echo "  [PASS HTML]   $label" || echo "  [MISS HTML]   $label"
}
check_bundle() {
  # The confirmation modal short-circuits with `if (!open) return null`,
  # so its strings aren't in the initial HTML. They ARE shipped to the
  # browser in the JS chunk — verify by fetching each <script src> on the
  # page and grepping for the needle.
  local label="$1"; local needle="$2"
  if ! [ -f "$BUNDLES_PATH" ]; then echo "  [SKIP BUNDLE] $label  (bundle not gathered)"; return; fi
  grep -q -F "$needle" "$BUNDLES_PATH" && echo "  [PASS BUNDLE] $label" || echo "  [MISS BUNDLE] $label"
}

echo "── BANNER (server-rendered in initial HTML) ─────────────────────"
check_html "title"          "$BANNER_TITLE"
check_html "body (locked)"  "$BANNER_BODY"
check_html "CTA label"      "$BANNER_CTA"

echo ""
echo "── REGRESSION (skipped-gate copy must NOT appear anywhere) ─────"
if ! grep -q -F "$NEG_1" "$OUT_NORM"; then echo "  [PASS HTML]   old banner body absent"; else echo "  [REGRESSION] old banner body still present"; fi
if ! grep -q -F "$NEG_2" "$OUT_NORM"; then echo "  [PASS HTML]   'title pack' absent"; else echo "  [REGRESSION] 'title pack' still present"; fi
if ! grep -q -F "$NEG_3" "$OUT_NORM"; then echo "  [PASS HTML]   old buyer-side phrasing absent"; else echo "  [REGRESSION] old buyer-side phrasing still present"; fi

# Pull every <script src> from the rendered page, fetch them all, concat
# into one big file. Grep that file for the modal-body strings.
echo ""
echo "── Gathering JS bundles for modal copy verification ──"
BUNDLES_PATH="$(mktemp).bundle"
mapfile -t SRCS < <(grep -oE 'src="/_next/static/[^"]+"' "$OUT_HTML" | sed 's/^src="//; s/"$//' | sort -u)
echo "  ${#SRCS[@]} chunks referenced from initial HTML"
touch "$BUNDLES_PATH"
for src in "${SRCS[@]}"; do
  curl -s -b "$COOKIE_JAR" "$BASE_URL$src" >> "$BUNDLES_PATH"
done
# Bundles JSON-escape strings: apostrophe → ', double-quote → \".
# Normalise so verbatim copy matches.
TMPB="$(mktemp)"
sed -e 's/\\u0027/'\''/g' -e 's/\\"/"/g' "$BUNDLES_PATH" > "$TMPB" && mv "$TMPB" "$BUNDLES_PATH"
echo "  bundle bytes: $(wc -c < "$BUNDLES_PATH")"

echo ""
echo "── CONFIRMATION STEP LEAD-IN ───────────────────────────────────"
check_bundle "lead-in head"  "$CONFIRM_LEADIN_HEAD"
check_bundle "lead-in tail"  "$CONFIRM_LEADIN_TAIL"

echo ""
echo "── CARRIES OVER (locked, must be in bundle verbatim) ───────────"
check_bundle "#1 (mgmt pack, not title pack)" "$CONFIRM_CARRIES_1"
check_bundle "#2"                              "$CONFIRM_CARRIES_2"
check_bundle "#3"                              "$CONFIRM_CARRIES_3"

echo ""
echo "── STARTS FRESH (locked, must be in bundle verbatim) ───────────"
check_bundle "#1 (new MoS)"                          "$CONFIRM_FRESH_1"
check_bundle "#2 head (Every step on…)"              "$CONFIRM_FRESH_2"
check_bundle "#3 (draft contract pack reissue)"      "$CONFIRM_FRESH_3"
check_bundle "#4 (contract signing/exchange/comp)"   "$CONFIRM_FRESH_4"
check_bundle "#5 (dates cleared)"                    "$CONFIRM_FRESH_5"

echo ""
echo "── OLD BUYER NOTE ──────────────────────────────────────────────"
check_bundle "head" "$OLD_BUYER_NOTE"
check_bundle "tail" "$OLD_BUYER_TAIL"

echo ""
echo "── RAW SNIPPET OF BANNER FROM HTML ──"
grep -oE ".{0,40}fell through[^<]*</p><p[^>]*>[^<]*" "$OUT_NORM" | head -1
echo ""
echo "── PROOF CAPTURE PATHS ──"
echo "  raw HTML:        $OUT_HTML"
echo "  normalised HTML: $OUT_NORM"
echo "  concatenated JS: $BUNDLES_PATH"
