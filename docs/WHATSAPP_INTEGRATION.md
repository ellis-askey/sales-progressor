# WhatsApp Integration — living implementation doc

Last updated: 2026-08-22 (Phases 2 + 3 built, committed on `staging`, not pushed).

**Owner:** Ellis. **Status:** PWA ingest (Phase 2) + the bridge service (Phase 3) built. Not
yet deployed/paired — needs the staging push (applies the migration), a Railway deploy, the
shared secret, and a one-time QR scan before it captures anything.

**Decisions (2026-08-22):** (1) Proceed with the unofficial linked-device bridge on the live number, **passive listener only** — ban-risk accepted. (2) Host the bridge on **Railway**.

---

## 1. Goal (the real, minimal spec)

Every WhatsApp message Ellis **sends** and **receives** in his existing WhatsApp Business
group chats (and relevant direct chats) should land automatically against the correct
property file in the PWA, in near real time — **or at least within a few hours**. No manual
export, copy/paste, or moving day-to-day messaging into the PWA. Ellis keeps using the
normal WhatsApp Business app exactly as now.

Target experience: Ellis sends "Morning both, chased the solicitor again" in
`Sale of 24 High Street`; within seconds the **24 High Street** file shows
`Ellis · Seller · WhatsApp — Morning both...`. The seller's reply appears the same way.

Group naming convention today:
- `Sale of {Address}` → SELLER side
- `Purchase of {Address}` → BUYER side
Clients sometimes DM directly; a client can be on more than one active sale, so phone
number alone is not always a definitive property match.

---

## 2. Key finding: reuse the existing comms spine

The PWA side is ~80% already present. WhatsApp should **extend** it, not create a second
messaging system.

| Need | Already exists | Ref |
|---|---|---|
| Message sink | `OutboundMessage` (channel-agnostic; `method` has `whatsapp`; `providerMessageId`, `contactIds`, `providerWebhookData`, `importBatchId`) | `prisma/schema.prisma:1313-1399` |
| WhatsApp ingest logic | `importWhatsAppChat` + `parseWhatsAppChat` (from the paste feature) | `lib/services/comms.ts`, `lib/services/comms/parse-whatsapp`, `app/actions/comms.ts:98-130` |
| Phone→contact matching | `normalizePhone`, `normaliseForMatch`, `autoMap` | `lib/utils.ts:99`, `components/activity/PasteWhatsAppPanel.tsx:59-95` |
| Address→transaction matching | `normaliseAddressString`; single-match `propertyAddress contains` pattern | `lib/utils/address.ts:79`, `lib/integrations/outlook/sync.ts:201-218` |
| Email→transaction index (for DMs) | `buildIndex` query shapes | `lib/integrations/outlook/sync.ts:133-197` |
| Timeline display + WhatsApp badge | `ActivityTimeline` + `getCommBadge` (💚 WhatsApp sent/received, in/out colours) | `lib/agent/comms-display.tsx:24,36`, `components/activity/ActivityTimeline.tsx` |
| Per-transaction comms fetch | `getActivityTimeline` | `lib/services/comms.ts:60-201` |
| Machine-to-machine auth | `Authorization: Bearer ${CRON_SECRET}` inline check + `middleware.ts` whitelist | `app/api/cron/daily-brief/route.ts:10-14`, `middleware.ts:170-191` |
| Connection model template | `OutlookConnection` (encrypted creds via `token-crypto`, reuses `ADMIN_TOTP_ENCRYPTION_KEY`) | `prisma/schema.prisma:1984-2007`, `lib/security/token-crypto.ts` |
| Encryption at rest | `encryptSecret`/`decryptSecret` (AES-256-GCM) | `lib/security/token-crypto.ts` |

**Genuinely new work:** the persistent Baileys bridge; a permanent group→transaction
mapping; a "needs assigning" holding area; the ingest endpoint; a robust dedup constraint;
the QR/connect + status UI.

---

## 3. Architecture

```
WhatsApp Business account (Ellis's existing number, existing groups)
        │  linked device (companion) session
        ▼
Persistent WhatsApp bridge  ── always-on host (Railway recommended)
  · Baileys multi-device connection
  · session persisted to a disk volume (survives restarts, no re-scan)
  · auto-reconnect
  · listens for inbound AND Ellis's own outbound messages
  · normalises → POSTs to the PWA
  · disk-backed retry queue if the PWA is briefly unavailable
        │  HTTPS  Authorization: Bearer ${WHATSAPP_BRIDGE_SECRET}
        ▼
PWA ingest endpoint  POST /api/integrations/whatsapp/ingest   (Vercel)
  · verify bearer secret (+ optional HMAC/timestamp for replay protection)
  · dedup on WhatsApp message id
  · resolve group/DM → transaction + side
  · write OutboundMessage (method=whatsapp) OR hold in "needs assigning"
        ▼
Existing OutboundMessage table → existing Activity timeline on the property file
```

The PWA stays on Vercel. Only the bridge needs the always-on host — WhatsApp needs a
persistent socket, which Vercel serverless cannot hold.

### Bridge location & hosting
- Bridge lives in a top-level `whatsapp-bridge/` folder in this repo, deployed **separately**
  to **Railway** (root directory = `whatsapp-bridge/`). Railway is the simplest fit: Git
  deploy, always-on, persistent volume for the Baileys session, ~$5/mo. (Alternatives:
  Fly.io, Render, a small VPS.)
- Baileys auth state via `useMultiFileAuthState` on a Railway volume. No session
  credentials ever reach the browser or the PWA DB.

---

## 4. Data model changes (Phase 2 — proposed, not yet applied)

All migrations go to **staging first** (Law 3). Multi-tenant: every WhatsApp row resolves
to a transaction and inherits its `agencyId` (Law 7).

1. **`OutboundChannel` enum** — add `whatsapp`. Update the existing paste importer
   (`lib/services/comms.ts:819-820`) which currently stores `channel:"other"` so the admin
   `/command/outbound` channel filter treats WhatsApp as a first-class channel.

2. **`WhatsAppConnection`** (mirror of `OutlookConnection`) — one row per connected number.
   `id, userId, phoneNumber, displayName?, status (pending_qr|connected|disconnected),
   lastSeenAt?, lastMessageAt?, createdAt, updatedAt`. Session creds stay on the bridge;
   this row is status/pairing only. `@@unique([userId, phoneNumber])`.

3. **`WhatsAppGroupMapping`** — the source of truth after first match.
   `id, waChatId (permanent WhatsApp group/chat id, @unique), transactionId, side
   (BUYER|SELLER), groupNameAtMatch?, matchMethod (name_auto|manual), createdAt`.
   After mapping exists, group renames are irrelevant — `waChatId` is authoritative.

4. **`WhatsAppPendingMessage`** — holding area for anything not confidently matched
   (unmatched group, ambiguous DM). `id, waMessageId (@unique), waChatId, isGroup,
   senderPhone?, senderName?, body?, mediaMeta? Json, timestamp, candidateTransactionIds
   String[], reason, createdAt`. On manual assignment: create the `OutboundMessage`,
   persist a `WhatsAppGroupMapping` (for groups) so it never asks again, delete the pending
   row. Kept separate from `OutboundMessage` so null-transaction rows don't pollute the
   comms table / admin outbound log.

5. **Dedup** — partial unique index (raw SQL migration):
   `CREATE UNIQUE INDEX ... ON "OutboundMessage"("providerMessageId") WHERE method='whatsapp'`,
   plus `@unique` on `WhatsAppPendingMessage.waMessageId`. Ingest checks both before writing.
   WhatsApp message id is the idempotency key (events replay after reconnects).

---

## 5. Matching rules

**Groups (primary path):**
1. If a `WhatsAppGroupMapping` exists for `waChatId` → use it (transaction + side). Done.
2. Else parse the group name: `Sale of {X}` → side SELLER; `Purchase of {X}` → side BUYER.
   Resolve `{X}` via `normaliseAddressString` + single-match `propertyAddress contains`
   over in-scope active transactions.
   - Exactly one high-confidence match → save mapping, ingest.
   - Zero / multiple → `WhatsAppPendingMessage` (needs assigning). Never guess.

**Direct messages:**
- Match sender phone (`normalizePhone`) to contacts on active transactions.
  - Belongs to exactly one active transaction → auto-assign.
  - Belongs to multiple → `WhatsAppPendingMessage` with candidates; Ellis picks. Do **not**
    permanently store `phone = property` (people have multiple sales). A DM chat may link to
    a person, but per-message property assignment stays safe under ambiguity.

**Direction:** message sent by the linked account (Ellis) → `type=outbound`, `sender=Ellis`;
anyone else → `type=inbound`. Baileys `fromMe` distinguishes these, so his own app-sent
messages are captured.

---

## 6. Security

- Bridge→PWA auth: dedicated `WHATSAPP_BRIDGE_SECRET` bearer (separate from `CRON_SECRET`
  so a bridge-host compromise doesn't expose cron). Add `/api/integrations/whatsapp/` to the
  `middleware.ts` `authorized` whitelist. Optional HMAC-signature + timestamp over the raw
  body for replay protection (mirror the SendGrid webhook pattern).
- No public unauthenticated ingest endpoint. Validate server-side.
- Session credentials never leave the bridge host; never logged.
- New third-party integration handling client personal data → **DPA note + entry in
  `docs/active/ELLIS_MANUAL_TODO.md`** (env vars, Railway signup, DPA), same as PostHog/Replicate.

---

## 7. Risk (read before Phase 2)

This is an **unofficial** integration. Baileys behaves as a linked/companion device; it is
**not** the official Meta Cloud API.
- **Against WhatsApp's Terms.** A linked-device bridge on the live client-comms number
  carries a real (not huge, but non-zero) risk of that number being **temporarily or
  permanently banned**. For a business whose client relationships live in WhatsApp, that is
  a serious downside to accept knowingly.
- The official Cloud API was correctly ruled out: it cannot read Ellis's existing
  WhatsApp Business **app** groups, cannot capture messages he sends from the app, and would
  change how he uses WhatsApp. It does not meet the goal.
- Mitigation: **passive listener only** for V1 — no automated sending, no chases, no bulk,
  no group creation, no auto-replies. This is the lowest-risk profile. It just captures the
  human comms Ellis already sends/receives.
- WhatsApp protocol changes may occasionally break the bridge; linked sessions sometimes
  need re-pairing. Design for reconnect + clear "disconnected" status in the UI.

**A dedicated separate number would isolate the risk but would NOT capture the existing
groups** (they live on the current number), so it does not meet the stated goal.

---

## 8. Environment variables (Phase 2+)

PWA (Vercel): `WHATSAPP_BRIDGE_SECRET` (shared secret), optional
`WHATSAPP_BRIDGE_HMAC_KEY`. Reuse `ADMIN_TOTP_ENCRYPTION_KEY` for any encryption; no new
crypto secret. Same var name, different value per environment (staging/prod convention).

Bridge (Railway): `WHATSAPP_BRIDGE_SECRET` (same value as PWA), `PWA_INGEST_URL`,
session volume path. Naming: provider-prefixed uppercase snake_case.

---

## 9. Phase plan

- **Phase 1 — Inspect + plan.** ✅ Done (this doc).
- **Phase 2 — Schema + ingest endpoint (PWA only).** ✅ Done, committed on `staging` (not pushed).
  Migration `20260822120000_whatsapp_integration` adds `WhatsAppConnection`,
  `WhatsAppGroupMapping`, `WhatsAppPendingMessage`, `WhatsAppSide` enum. Ingest logic in
  `lib/integrations/whatsapp/ingest.ts`; endpoint `app/api/integrations/whatsapp/ingest/route.ts`
  (bearer `WHATSAPP_BRIDGE_SECRET`); `middleware.ts` whitelisted. `OutboundChannel.whatsapp`
  was **deferred** (low-risk scope) — WhatsApp rows use `method:"whatsapp"`, `channel:"other"`
  like the existing paste importer; the timeline badge keys off `method`. Not yet applied to
  staging DB (applies on the next staging deploy via `prisma migrate deploy`).
- **Phase 3 — Bridge service.** ✅ Done, committed on `staging` (not pushed). Isolated
  `whatsapp-bridge/` package (Railway, excluded from the Vercel build): Baileys connect +
  `useMultiFileAuthState` session persistence, auto-reconnect, `messages.upsert` type=notify
  listener (inbound + `fromMe`), normalise → POST with a disk-backed retry queue, and
  `/health` `/status` `/qr` endpoints. Untested until paired (needs Railway + a QR scan).
- **Phase 4 — Connect/QR + status UI.** Settings → Integrations → WhatsApp: Connect
  (QR from bridge), Connected/Last-sync, Reconnect, Disconnect.
- **Phase 5 — Group messages end to end** (inbound + outbound) via the mapping.
- **Phase 6 — Auto group→transaction matching** from name; needs-assigning for the rest.
- **Phase 7 — DM matching + Needs Assigning UI.**
- **Phase 8 — Unified comms UI polish** (channel filter on the timeline; needs-assigning &
  connection-status surfaces).
- **Phase 9 — Reliability** (retries, reconnection, dedup hardening).
- **Phase 10 — Production deploy + end-to-end test.**

Built incrementally, staging-first, one concern per PR, this doc updated each phase.

---

## 10. Testing checklist (fill in as phases land)

- [ ] Ingest rejects requests without the bearer secret.
- [ ] Duplicate WhatsApp message id never creates two rows (replay after reconnect).
- [ ] `Sale of {addr}` auto-maps to the right transaction, side SELLER.
- [ ] `Purchase of {addr}` → side BUYER.
- [ ] Group rename after mapping keeps messages on the same file.
- [ ] Ellis's own app-sent message appears as OUTBOUND on the file.
- [ ] Client reply appears as INBOUND.
- [ ] Ambiguous DM (multi-sale seller) goes to Needs Assigning, not auto-picked.
- [ ] Manual assign of a group persists the mapping (never asks again).
- [ ] Bridge survives restart without re-scanning the QR.
- [ ] Bridge buffers + retries when the PWA is briefly down; nothing lost.
- [ ] WhatsApp rows are agency-scoped (Law 7) and appear only on the right file.

---

## 11. Decisions (resolved 2026-08-22)

1. **Ban risk** on the live WhatsApp Business number (§7) — **accepted**, passive-only V1.
2. **Hosting** — **Railway**.

Deferred (not blocking): adding `whatsapp` to the `OutboundChannel` enum so the admin
`/command/outbound` log filters WhatsApp as a first-class channel. For now WhatsApp uses
`channel:"other"`, `method:"whatsapp"` (consistent with the paste importer).

### V1 scope defaults (change if you disagree)
- **Media**: V1 records that a media message exists + metadata (type, caption); actual
  file download/storage deferred to a later phase.
- **DMs**: included (Phase 7) with the safe "needs assigning" fallback for ambiguity.
- **History backfill**: not in V1. Live capture from the moment of connection is the
  priority; recent-history import investigated later only if Baileys exposes it safely.

---

## 12. Known limitations (running list)

- Unofficial; may break on WhatsApp changes; sessions can need re-pairing.
- One linked number per connection in V1.
- No outbound sending from the PWA in V1 (capture only).
