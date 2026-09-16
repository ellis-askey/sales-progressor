# Email Ingestion v2 — Spec

Agreed with Ellis 2026-09-16. Build order: **A→B, then C→D, then E→F.**

## Goal

Inbound email on a property file that reads like clean messages, groups into
conversations, hides junk, and (optionally) understands itself — while never
losing the original. The cleaner the file's comms, the more agents trust it as
the single source of truth.

## Background (how it works today)

- IMAP + Outlook connectors → shared match/ingest engine (`lib/integrations/mail/*`).
- Each email stored as one `OutboundMessage` (`type:"inbound"`, `method:"email"`),
  with the raw original in `providerWebhookData.raw`.
- Body cleaned by `lib/email/clean-inbound.ts` (narrow: only "On … wrote:",
  Outlook header block, Original Message, "-- " signature delim, legal footer).
- Matched to a file by participant email → folder name → subject postcode
  (`lib/integrations/mail/match.ts`); ambiguous → review list; unmatched → not stored.
- Threading fields (`conversationId` etc.) captured but unused.
- Activity tab renders `content` verbatim (`components/activity/ActivityTimeline.tsx`).

## Locked decisions

1. Build order A→B, then C→D, then E→F.
2. Auto-replies: **ingest, tag "auto-reply", hide by default** (recoverable, silent).
3. AI read is **suggest-only, never auto-applies** — and can suggest confirming
   **onward-purchase and related-sale tracker steps** as well as the file's own milestones.
4. Cleaning is **reversible**: cleaned body shown, raw always one click away,
   high-confidence markers only.
5. Threading UX (Phase C): collapse a conversation into **one thread card** in the
   activity feed (latest sender + one-liner + message count; bubbles to top on a
   new reply). Tap to expand a newest-first back-and-forth, each message showing
   only its new text with a per-message "show original". Gmail/Outlook model.
6. Matching: make the **Outlook folder authoritative** when it maps to exactly
   one live file; tighten the fuzzy tie-breakers; clean review tray for ambiguous.

---

## Phase A — Cleaning & noise removal (no AI)

`lib/email/clean-inbound.ts` + auto-reply gate. Raw original always kept.

- **A1 — body cleaning** (`clean-inbound.ts` + tests):
  - Broaden quote-trail markers: dash-wrapped / colon-less "On … wrote" variant
    (`---- On Fri … wrote ----`), "----- Forwarded message -----".
  - Strip inline junk in place (not truncate): `[cid:…]`, `__inline__img__src`,
    Office image alt-text (`[… Description automatically generated …]`, `[image: …]`).
  - Cut a signature/social-token block: a run of `[icon]` / `[facebook]` /
    `[instagram]` / `[linkedin]` / `[googlemaps]` / `[youtube]` / `[tiktok]` /
    `[logo]` lines (keeps the human sign-off above it).
- **A2 — auto-reply gate**: capture `Auto-Submitted` / `X-Autoreply` / `Precedence`
  headers (add to Graph `$select`; read on IMAP) + subject patterns ("Automatic
  reply", "Out of office"); tag the row and hide from the default feed.

## Phase B — Rendering

`components/activity/ActivityTimeline.tsx`.

- Collapse long bodies with "show full email / show quoted history".
- Email-style entry (sender, avatar, time, clean body).
- "Show original" uses the stored raw.

## Phase C — Threading

- Group by `conversationId` into one collapsible thread card (see decision 5).

## Phase D — AI read (Haiku 4.5, suggest-only)

- For each new matched, non-auto-reply message: summarise, extract
  dates/attachments/next-steps, and **suggest** a milestone confirm **or** an
  onward/related tracker step confirm **or** a to-do. Agent approves; never auto-applies.
- Cost control: run only on matched new-content messages; cache the instruction
  prompt; skip trails/auto-replies; cap body length. ~$0.0035/email on Haiku 4.5.

## Phase E — Matching hardening

- Folder → file authoritative when unambiguous; tighten subject-postcode /
  `contains` tie-breakers; clean review tray with one-tap "file to this property".

## Phase F — Attachments & enrichment

- Save attachments into the file's Documents (contract packs, searches).
- Read phone/role from signatures into the contact record, then hide the block.

---

## Safety / constraints

- Never destructive: `content` is the tidy view; `providerWebhookData.raw` is the
  source of truth for "show original".
- High-confidence markers only — better to under-trim than eat real content.
- Tests use real ingested-email fixtures, not invented shapes.
- AI read never writes a milestone/step/to-do without agent approval.
