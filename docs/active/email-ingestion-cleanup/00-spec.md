# Email ingestion cleanup

Owner: Ellis · Drafted 2026-09-11 · Status: Phase 0 built, rest planned

Fixes three problems with how Outlook emails land on a file's Activity, found while
investigating **8 Brambling Crescent** (prod, file `cmr1ually000h2x06frrndj04`).

## Background — how ingestion works today

The cron `/api/cron/outlook-sync` runs hourly (Mon–Fri) and, for every connected
mailbox (currently only `ellis@thesalesprogressor.co.uk`), calls
`syncOutlookMailbox` in `lib/integrations/outlook/sync.ts`. For each email in the
Inbox or a property-named folder (last 90 days) it decides which file it belongs
to by:
1. **People** — from/to/cc vs a file's contacts + solicitors + broker (`buildIndex`).
2. **Folder name** — a folder named after an address points at that file
   (`buildFolderHints`), but **only if the name resolves to exactly one file**.
3. **Postcode in subject** — a tiebreaker when several files share people.

A confident single match is stored as an inbound `OutboundMessage` row
(`logMessage`, sync.ts:263). The body is stored **verbatim** —
`content: (msg.body || msg.bodyPreview).trim()`.

## The three problems (with evidence)

### 1. Signatures + footer boilerplate are kept
`logMessage` stores the whole body. The signature sanitizer
(`lib/email/sanitize-signature.ts`) is only used for the agent's *own* signature
and outbound chases — never on inbound. The AI interpreter reads the content but
doesn't rewrite it. So the sign-off, phone/social block and "IMPORTANT:
confidential…" disclaimer all land on the file.
*Evidence:* one entry is a single email stored at 32,106 chars incl. the disclaimer.

### 2. The whole quoted chain lands in every entry (+ double-ups)
Outlook's `body` includes the entire quoted history below the new message; we keep
it all. A short reply that quotes five earlier emails is saved as all five again.
*Evidence:* that 32k entry has 24 "On … wrote / From:" markers.
**Double-ups:** dedup is only on `providerMessageId`. The same email in both the
Inbox and the property folder has different Graph ids per folder, so it's stored
twice. *Evidence:* the "[SA-DBP-0044]" kent email and the danny.bailey reply each
appear twice (folder "Inbox" + folder "8 Brambling Crescent"). This file has 89
email rows (13 in / 76 out).

### 3. A forward from the agent didn't attach — root cause: a stray draft
The forward (Danny → Ellis, in the "8 Brambling Crescent" folder) never landed.
Cause: **there are two files with address "8 Brambling Crescent, Harlow, CM17 0GF"**:
- `cmr1ually…` — **active, outsourced**, all the activity (336 msgs, 34 milestones, live tracker).
- `cmr1u1ovj…` — **empty draft** created 7 min earlier (0 of everything).

Because the folder name matches **two** files, folder-matching is switched off as
ambiguous. The forward has no matchable person on its outer envelope (just Danny,
the agent, who we don't index), so with the folder disabled it can't be placed and
sits in the "review" pile. (The kent emails still land because kent is the seller's
solicitor — matched by person, no folder needed.)

## Decisions (Ellis, 2026-09-11)

- **Drafts never count.** Match only live files. This is the real fix for #3 — it
  makes the address unambiguous without deleting anything, and generalises to every
  file. Precedent: the enquiries list already filters to live files.
- **The stray empty draft: leave it in place, do NOT delete.** Rationale: the code
  fix makes it harmless for matching; deleting is an unnecessary data operation and
  our rules default to not deleting user data. If it ever clutters a list it's a
  trivial one-off cleanup later. (Decision made on Ellis's "do what's best + tell me".)
- **Retro-clean AND forward.** Clean new emails on ingest *and* backfill-clean the
  existing rows (signature + quoted-chain trim), keeping the raw original stashed.
- Keep the **full original** body (in `providerWebhookData.raw`) so a "show
  original" is always possible and cleaning is reversible.

## Phases

### Phase 0 — Matching ignores drafts  ✅ built
`sync.ts`: `buildIndex` + `buildFolderHints` now exclude `status = draft`. The
"8 Brambling Crescent" folder resolves to the one live file, folder-matching turns
back on, and the forward **self-attaches on the next sync** (it's still in the
folder, within the 90-day window) — no manual placement needed.

### Phase 1 — Clean the body on ingest (signature + boilerplate)
Shared `cleanIngestedEmail(rawBody)` helper (with unit tests) used by BOTH ingest
paths (`logMessage` and the manual `logSingleMessageToFile`). Strips the signature
block + confidentiality disclaimer. Store cleaned text as `content`, raw in
`providerWebhookData.raw`.

### Phase 2 — Just the new message + dedupe
- Same helper cuts the quoted history: everything from the first reply marker
  ("On … wrote:", "From: … Sent:", "-----Original Message-----", Outlook `____`
  divider) downward.
- Dedup: before insert, also match an existing row on (sender + subject +
  received-time within a minute), not just `providerMessageId`, so Inbox+folder
  copies collapse to one.

### Phase 3 — Forwards + folder tiebreak
- Detect a forward (outer sender = mailbox owner / the agent; body has "Begin
  forwarded message" / a leading "From:" block) and parse the **inner "From:"** to
  recover the real party, then match on that.
- If two **live** files ever share an address, tiebreak on postcode + house number
  rather than giving up (rare once drafts are excluded).
- Guard against creating a second **live** file for the same address + agency.

### Retro-clean (part of Phases 1–2)
A one-off backfill job: for existing inbound email rows, run `cleanIngestedEmail`
over `content`, keeping the pre-clean text in `providerWebhookData.raw`. Idempotent
(skip rows already cleaned). Run on staging first, spot-check, then prod.

## Order
Phase 0 (done) → Phase 1 + 2 together (the biggest visible win, and the retro-clean
rides on the same helper) → Phase 3.

## Risks / notes
- Over-trimming could cut a genuinely-referenced quote. Mitigated by keeping the
  raw original + "show original", and conservative markers.
- Retro-clean rewrites live rows — staging-first, idempotent, reversible via the
  stored raw.
- No DB migration needed for Phase 0. Phases 1–2 may add nothing to the schema if
  the raw is stashed in the existing `providerWebhookData` JSON.
