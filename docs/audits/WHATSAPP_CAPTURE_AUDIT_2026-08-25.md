# WhatsApp capture audit — 2026-08-25

Triggered by a spot-check of the new WhatsApp tab on prod (file `7 East Flint`):
messages from different chats were merged, a live group showed only 1 of many
messages, and senders showed as raw numbers. This audit separates **reader**
problems (the display layer) from **capture** problems (the bridge + ingest that
put data on the file). The reader tab has been re-gated to founder-only
(`master 9bd1ddb2`) until the capture fixes land.

Evidence is code-level; the exact prod rows could not be read from here (local
env points at staging), so live-data symptoms are reasoned from the screenshots
+ the pipeline code. Staging confirmed the paste-import row shape (no `waChatId`,
no `senderLabel`).

---

## Capture findings (bridge + ingest)

### C1 — CRITICAL: all history is discarded on every restart
`whatsapp-bridge/src/index.ts:25` sets `BOOT_TIME = Date.now()`, and
`index.ts:130` drops every message older than it:
`if (msg.timestamp < BOOT_TIME - 60_000) continue; // history / pre-boot — skip`,
reinforced by `syncFullHistory: false` (`index.ts:65`).

Every Railway restart / redeploy / reconnect resets `BOOT_TIME`, so only messages
that arrive **after the last boot** are ever stored. A live group therefore shows
a fraction of its real thread (this is why `Purchase of 7 East Flint` showed a
single message). The only history that exists at all is what was manually
paste-imported.

**Fix options:** (a) persist a "last-seen" watermark so a restart backfills the
gap instead of resetting to now; (b) enable an initial history sync
(`syncFullHistory` / a `messaging-history.set` handler) with the existing
message-id dedup; (c) formally accept passive-live-only and rely on paste import
for history — but then say so in the UI. Recommend (a), consider (b).

### C2 — HIGH: group senders store a LID number, not the name
In a group the sender is `key.participant`, which on modern WhatsApp is a **LID**
(a privacy id that looks like a long foreign number, e.g. `246827525898340@lid`).
`normalise.ts:92,100` turns that into `senderPhone = "+246827525898340"`. The
display name **is** captured — `senderName = wa.pushName` ("Fatbardh Cuni",
`normalise.ts:101`) — but ingest prefers the number:
`resolveSender` falls back to `m.senderPhone ?? m.senderName` (`ingest.ts:290`).

**Fix:** (a) immediate — prefer `senderName` over the raw number in the fallback
(one line); (b) proper — resolve the LID to the real contact (see C3).

### C3 — HIGH: contact matching fails for LID senders
`matchDirect` (`ingest.ts:174`) and `resolveSender` (`ingest.ts:271`) match by
the last 9 digits of a phone number. A LID is not the contact's phone, so the
match fails: the sender never links to the person on the file, and an inbound DM
from a LID won't auto-route. `normalise.ts` reads only `key.participant`, not the
real-phone field (`participantPn` in newer Baileys).

**Fix:** capture `participantPn` (or the account's LID↔phone map) so participants
resolve to the contact on the file.

### C4 — MEDIUM: media needs a prod storage bucket that may not exist
The bridge downloads media and posts it (`index.ts:135-147`); it lands in the
private `whatsapp-media` Supabase bucket. If that bucket doesn't exist on prod,
the message row shows but the media never attaches (already on
`ELLIS_MANUAL_TODO`). Combined with C1, historical media (e.g. the two docs in
the real chat) is dropped regardless.

### C5 — MEDIUM: logged-out = permanent dead pairing (also tracked as audit item 2)
On `DisconnectReason.loggedOut` the bridge returns without clearing auth or
re-emitting a QR (`index.ts:100-103`), so `/pair` sticks forever and re-pairing
needs a host reset.

### C6 — LOW: reply/quoted context is not captured
`normalise.ts` extracts body + media only; quoted-message linkage is dropped, so
threads lose their reply structure. Acceptable for v1, noted for completeness.

---

## Reader findings (the tab display layer — introduced 2026-08-25)

### R1 — HIGH: paste history collapses into one merged bucket
`getWhatsAppConversations` groups by `chatId = waChatId ?? "unknown"`
(`lib/services/comms.ts`). Paste-imported rows carry no `waChatId`
(`comms.ts:1006-1029` sets none), so **all** history — buyer, seller, agent,
across every real chat — merges into one "unknown" bucket, mislabelled
"Direct chat · WhatsApp chat". This is the "mixed up" thread.

### R2 — HIGH: no sender attribution outside groups
The renderer shows a sender name only when `isGroup` is true
(`components/transaction/WhatsAppChat.tsx`). The merged bucket renders as a
direct chat, so no names appear — and paste rows carry no `senderLabel` anyway
(only `contactIds`, which the reader doesn't resolve).

### R3 — MEDIUM: misleading default title
"WhatsApp chat" is the fallback title whenever there's no group name — i.e. every
history message — so it reads like a real chat name when it means "unknown".

---

## Recommended order

1. **C2(a)** prefer the display name — one line, immediately fixes the number.
2. **C1** history watermark/sync — the single biggest gap (missing messages).
3. **C3** LID → contact resolution — real attribution + DM routing.
4. **R1/R2/R3** reader: split history by side, resolve names from `contactIds`,
   show senders everywhere, rename the history bucket to "Imported history".
5. **C4** confirm the prod media bucket.
6. **C5** re-pair (shared with audit item 2).

Only after C1–C3 + R1–R3 should the tab come off the founder gate.
