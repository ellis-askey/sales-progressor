# WhatsApp Rebuild — Investigation Report & Implementation Plan

Date: 2026-10-12. Status: **INVESTIGATION ONLY — nothing implemented.** Prepared as the foundation for a future build; every claim below carries a file reference (code) or source URL (Meta platform, live-verified 2026-10-12).

---

## A. Current implementation — what actually exists today

The most important framing: **"WhatsApp" in TSP today is three separate things**, and none of them is a sending integration.

### A1. The Baileys capture bridge (the Railway workaround)

A passive, listen-only linked-device bridge. It **never sends a message** — there is no `sendMessage` call anywhere in `whatsapp-bridge/src`, it connects with `markOnlineOnConnect: false` (`whatsapp-bridge/src/connection.ts:131`), and passivity is an explicit design decision (ban-risk mitigation, `docs/WHATSAPP_INTEGRATION.md:223-225`).

- **Architecture**: `whatsapp-bridge/` package deployed separately to Railway (excluded from the Vercel build). Baileys multi-device socket per connection; session credentials on a Railway volume via `useMultiFileAuthState` (`connection.ts:119`); auto-reconnect with QR re-pair on logout; a persisted watermark so restarts don't re-drop or re-flood (`watermark.ts`); disk-backed retry queue for when the app is unreachable (`delivery.ts`). Multi-session: one internal number + one per agency connection (`manager.ts:28-36`).
- **Flow**: bridge normalises every group message (inbound AND the agent's own `fromMe` sends) → POSTs to `/api/integrations/whatsapp/ingest` (Bearer `WHATSAPP_BRIDGE_SECRET`) → `lib/integrations/whatsapp/ingest.ts` dedups on `waMessageId`, routes by **group name** (`Sale of {addr}` → SELLER, `Purchase of {addr}` → BUYER, first-line address match against active files, `match.ts:13-19`), writes an `OutboundMessage` (`method:"whatsapp"`) or holds it in `WhatsAppPendingMessage` (internal number only) or drops it. Once a chat maps, `WhatsAppGroupMapping.waChatId` is permanent and pending messages replay onto the file (`ingest.ts:369-395`).
- **DMs are deliberately OFF** since 2026-09-14: any 1:1 message with no prior mapping is dropped (`ingest.ts:142-144`). The DM-ambiguity machinery (`candidateTransactionIds`, needs-assigning for DMs) is dead code for new data.
- **Media**: bridge downloads and POSTs to `/api/integrations/whatsapp/media`; stored in the private `whatsapp-media` Supabase bucket, 25MB cap, signed-URL serving.
- **Statuses are cosmetic**: ingest hardcodes `status:"sent"` (our side) / `"delivered"` (inbound) at write time (`ingest.ts:293`); no delivery/read receipts are ever consumed. Dedup is app-code only — the designed DB partial unique index on `providerMessageId` was never created.
- **Surfaces**: agent connect card (Account → Connections, consent + QR, polls every 3s); Command Centre `/command/whatsapp` (bridge status, needs-assigning queue, assigned-conversations with reassign/unassign, re-pair button); internal-only WhatsApp tab on files (`app/agent/transactions/[id]/whatsapp` — gated `isInternalTeam && !fileProgressor`); agency-captured rows land on the Activity timeline only.
- **The "Promises" engine**: cron every 30 min scans captured outbound WhatsApp for dated self-commitments ("I'll chase Monday") and creates tasks. Works only if the bridge captures; agency-visible output is behind `Agency.whatsAppTasksEnabled` (default off). Dormant in practice.
- **Deploy state**: all committed on `staging`; bridge LIVE on Railway paired to the internal number +447508862929 as of 2026-09-15 (memory + `docs/WHATSAPP_INTEGRATION.md:3-5`); customer-agency multi-session capture is committed but effectively dark (needs agencies to link + volume config). No WhatsApp commits in ~2 weeks — parked, not iterated.

### A2. "Sending": deep-link handoff only

- **Chase drawer** (`components/chase/ChaseDrawer.tsx`): WhatsApp channel toggle; AI drafts a 50–80-word informal message; on Send it (1) logs an `OutboundMessage` `method:"whatsapp"` `status:"sent"` linked to the ChaseTask, then (2) `window.open('https://wa.me/…?text=…')`. The toast says "Chase sent" **regardless of whether the agent actually pressed send in WhatsApp**. The code itself calls this the "logged on faith" model (`ChaseDrawer.tsx:518,1364`).
- **Contacts card**: `whatsapp://send?phone=…` quick action — no logging at all (`ContactsSection.tsx:57-61`).
- **Group-setup helper** (`WhatsappGroupModal.tsx`): helps the agent manually create a correctly-named group in their own WhatsApp and paste back the invite link (stored on `PropertyTransaction.whatsappGroupInviteUrl`); per-client "join the group" deep links.

### A3. The paste importer

`PasteWhatsAppPanel` / `importWhatsAppChat`: agent pastes an exported chat; parsed into timeline rows (`channel:"other"`, `method:"whatsapp"`, `importBatchId` groups them). Pre-dates the bridge. Known reader problems (rows carry no `waChatId`, so history merges into one bucket — `docs/audits/WHATSAPP_CAPTURE_AUDIT_2026-08-25.md` R1–R3).

### A4. Data model today

- `WhatsAppConnection` (pairing/status only; creds live on bridge) — `schema.prisma:3482`
- `WhatsAppGroupMapping` (waChatId → transaction + side; permanent) — `:3501`
- `WhatsAppPendingMessage` (needs-assigning holding area) — `:3520`
- `WhatsAppIgnoredChat` — `:3545`
- Messages live in the channel-agnostic **`OutboundMessage`** spine: `method:"whatsapp"`, `channel:"other"` (a first-class `whatsapp` channel enum value was deferred), `providerMessageId` = WA message id, `senderLabel`, `mediaUrl`, `providerWebhookData` JSON (waChatId, connectionId, isGroup…). WA writes only `sentAt`; `deliveredAt/openedAt/failedAt` never populated for WA.
- `Agency.whatsAppCaptureEnabled` (default on), `Agency.whatsAppTasksEnabled` (default off).

### A5. Verdicts

| Capability | State |
|---|---|
| Group capture (internal number) | WORKING (live) |
| Group capture (customer agencies) | COMMITTED, dark in practice |
| Sending from TSP | DOES NOT EXIST (deep-link handoff only, logged on faith) |
| DM capture | REMOVED (deliberate) |
| Delivery/read statuses | ABANDONED — cosmetic hardcoded values |
| DB-level dedup | MISSING (app-code only; race-prone) |
| Media capture | WORKING (bucket must exist per env) |
| Promises → tasks | WORKING but dormant |
| History on bridge restart | FIXED since the Aug audit (watermark), but pre-link history only via paste import |
| Compliance | Violates WhatsApp ToS; ban risk accepted knowingly on the live business number |

### A6. Communication indicators — the truth audit

There is **no stored last-contacted column** for clients anywhere; every recency figure is recomputed from `OutboundMessage` rows, whose `status` **defaults to `sent` at creation** (`schema.prisma:2264`).

| Indicator | Surface | Source | Truthfulness |
|---|---|---|---|
| "Contacted today / Nd ago" pill | `LastContactedPill.tsx:47` via `ContactsSection.tsx:1117` | `getLastContactedByContact` (`comms.ts:825`): OutboundMessage status∈{sent,delivered,opened,clicked} + PortalMessage + confirmed queue sends | MIXED — queue path confirmed; OutboundMessage path trusts default-`sent`; outbound only. WhatsApp feeds it |
| "N chases this week" | `ContactsSection.tsx:1129` | automated+channel=email+purpose=chase, 7d | Confirmed sends; EMAIL-ONLY — WhatsApp invisible |
| Activity timeline | `ActivityTimeline.tsx` | `getActivityTimeline` — **excludes** `method:"whatsapp"` by design | WhatsApp has a separate reader (`getWhatsAppConversations`, internal-only tab) |
| Hub "Gone quiet" | `hub.ts:710-927` | coarse `PropertyTransaction.lastActivityAt` + a 14-day silence-break scan that DOES include WhatsApp both directions | Coarse stamp; silence-break honest |
| Hub No-comms / weekly touch | `hub.ts:976+` | OutboundMessage/PortalMessage scan, both directions, WA included | Record-based |
| Outbound log (Command Centre) | `OutboundRow.tsx` | raw status columns | Only surface that could show bounce/fail — but see bug 1 |
| Chase-engine recency | `ChaseTask/ClientChaseState/SolicitorChaseState/EnquiryTracker .lastChasedAt` etc. | written at engine action sites | Honest, email-cadence only |

**Confirmed truth bugs to fix in any rebuild:**
1. **Bounces never demote status**: the SendGrid webhook stamps `failedAt` but deliberately leaves `status:"sent"` (`app/api/webhooks/sendgrid-bounce/route.ts:229,255-262`) → a bounced chase still renders "Contacted today" and still counts in no-comms scans.
2. **Manual logs are unconditionally "sent"**: `createCommunicationRecord` writes no status (default `sent`), and its follow-on client email failure is only console-logged (`comms.ts:1062-1086,1618-1629`).
3. **Manual chase emails are unreachable by the bounce webhook** (no queue link / providerMessageId) — permanently `sent` even if they bounce (`app/api/chase/send-email/route.ts:118-132`).

---

## B. Official API feasibility (Meta platform, verified October 2026)

Meta docs have moved to `developers.facebook.com/documentation/business-messaging/whatsapp/...` — cited URLs were live-verified by the research agents.

### B1. Fundamentals

- Hierarchy: Business portfolio → WhatsApp Business Account (WABA) → phone numbers. Portfolios start capped at 2 numbers, rising automatically to 20 on verification or the 2,000 messaging tier (`…/docs/whatsapp/cloud-api/phone-numbers`).
- Tokens: **System User tokens** (60-day or never-expiring) for our own WABA; **Business Integration System User tokens** (per-tenant, from Embedded Signup code exchange) for the multi-tenant phase (`…/documentation/business-messaging/whatsapp/access-tokens/`).
- Webhooks: app-level callback + per-WABA `POST /<WABA_ID>/subscribed_apps`; GET handshake echoes `hub.challenge`; every payload signed `X-Hub-Signature-256` = HMAC-SHA256(raw body, app secret). Per-number/per-WABA callback overrides exist.
- Versioning: Graph API v26.0 current; ~2-year support per version. On-Premises API is dead (sunset 23 Oct 2025) — Cloud API is the only option.
- Delivery lifecycle via `statuses` webhooks: **sent → delivered → read / failed** (+ `played` for voice notes from Mar 2026). The send API response only means "accepted", never "delivered". Key error codes: 131047 (outside 24h window → must use template), 131056 (per-recipient rate), 131026 (undeliverable), 131049/131050 (marketing limits/opt-out), 190 (token expired).
- Media: images 5MB, docs 100MB, audio/video 16MB; **Meta retains media 30 days, download URLs live 5 minutes** → we must fetch and store everything in our own bucket (the existing `whatsapp-media` bucket pattern is exactly right). Voice notes officially supported (OGG/Opus + `voice:true`).
- Throughput: 80 msgs/sec per number; ~1 msg per 6s per sender→recipient pair.

### B2. Groups — the make-or-break answer

**A Groups API now exists and is officially supported** (launched 6 Oct 2025; "now open to all businesses with an Official Business Account" — `…/documentation/business-messaging/whatsapp/groups`). What it gives and what it doesn't:

| Need (current workflow) | Official answer |
|---|---|
| Create a buyer-side / seller-side group per sale | YES — `POST /groups`, business is creator/admin |
| Add participants by number (as Baileys/app does) | **NO — invite-link only** (`chat.whatsapp.com/…`), optional join-approval mode |
| Group size | **8 max** including the business — fits one side's parties (progressor + 1-2 clients + solicitor), NOT a mega-group |
| Send/receive group messages via API | YES — text, media, templates; inbound webhooks carry `group_id`; aggregated delivery statuses |
| Group lifecycle visibility | YES — webhooks for create/delete/joins/leaves/settings |
| Join a group a CLIENT created | **NEVER** — unchanged, impossible |
| Migrate existing Baileys-era groups | **NO** — groups live on the phone number's app account; moving a number to Cloud API abandons them; coexistence mode explicitly does NOT sync groups and coexistence numbers are INELIGIBLE for the Groups API |
| Eligibility | **Official Business Account (OBA) badge required.** Materially de-risked by the current official criteria (`…/documentation/business-messaging/whatsapp/official-business-accounts/`): OBA is a **free, self-serve request** needing only a verified business portfolio, 30+ days on the platform, an approved display name, two-step verification and policy compliance — **the old "well-known brand / press coverage" notability test no longer appears in the official doc.** Approval may still be discretionary in practice (denials re-requestable after 30 days), so treat as probable-but-unproven until TSP's own request is granted (§I decision 2) |
| Cost | Per-message pricing ×, billed per delivered recipient (a template to a 5-person group costs 5 messages) |

BSP support: 360dialog exposes the Groups API as standard; Twilio only offers a simulated-group relay (not real groups); Vonage none.

**Implication**: the group workflow CAN survive — reshaped (TSP-created groups, invite links, 8 seats, OBA-gated) — but must not be the foundation. The architecture below treats 1:1 threads as the base layer and groups as an additive capability unlocked when/if OBA lands.

### B3. Multi-tenant route (progression businesses)

- Meta's **Tech Provider** model is the sanctioned shape: TSP's app onboards each business via **Embedded Signup v4** (v2/v3 die 15 Oct 2026 — build v4 only); each tenant gets its OWN portfolio + WABA + phone number + payment method with Meta; TSP exchanges the signup code for a per-tenant token and receives all tenants' webhooks on one endpoint, routed by WABA/phone-number id.
- Requirements: TSP business verification + App Review for advanced access to `whatsapp_business_messaging` and `whatsapp_business_management` (two demo videos). No published timescales.
- **Pooling tenants through one TSP number/WABA is non-compliant** (resell restriction, Platform Terms §4.1) — per-tenant WABA is mandatory, which validates building tenant-aware from day one.
- Payment enforcement is live: tenants without a card on file with Meta stopped receiving service-message delivery from 1 Oct 2026.
- Messaging limits: new portfolios start at 250 unique contacts/24h (business-initiated), scaling 2k→10k→100k→unlimited; reaching 2k needs business verification OR 2k quality messages in 30 days. Service-window replies are unlimited and free.
- BSP alternative if App Review/OBA stalls: **360dialog partner tier** (€250–1000/mo + €15–49/channel, zero markup on Meta fees, Groups API exposed) is the best fit; Twilio adds $0.005/message both directions.

### B4. Numbers, coexistence, verification (verified on official pages 2026-10-12)

**Numbers** (`…/business-phone-numbers/phone-numbers`):
- Eligible: any owned number that can receive a voice call or SMS — mobile, **landline (voice OTP; disable IVR/forwarding for the verification call)**, toll-free, VoIP. Not eligible: short codes, numbers already active on WhatsApp (must be deleted from the app first — history permanently lost), banned numbers pre-appeal.
- An existing app number has two routes in: **delete-and-register** (history lost) or **coexistence** (below). A number on Cloud API can later be ported between WABAs/BSPs non-destructively (display name, quality rating, limits and OBA survive; template quality ratings reset; two-step verification must be off during migration).

**Coexistence — now officially available in the UK** (changelog 23 Oct 2025; `…/embedded-signup/onboarding-business-app-users/`):
- Same number on the WhatsApp Business **app** AND Cloud API, onboarded via a Tech Provider/Solution Partner's Embedded Signup (app version ≥2.24.17). Consent-gated sync of **180 days of 1:1 chat history** (must be pulled within 24h of onboarding) and contacts; ongoing two-way mirroring (app-side sends reach the API via `smb_message_echoes` webhooks).
- Costs of coexistence: **group chats never sync and the number is ineligible for the Groups API**; broadcast lists disabled; disappearing/view-once/live-location off; catalog/labels/quick-replies unavailable on the API side; throughput capped at 20 msgs/sec.
- Implication for TSP itself: **do not use coexistence on the TSP number** (it kills the Groups option). Implication for tenants later: it is the ideal onboarding story for small agencies living in the Business app — they keep their phone workflow, TSP gets their 1:1 traffic + 180 days of history, groups stay phone-only.

**Display names**: required at registration; many names usable immediately (`AVAILABLE_WITHOUT_REVIEW`); review re-triggers on change (10 changes/30 days allowed) and at messaging-limit upgrades; approval via `phone_number_name_update` webhook. No official review timescales published.

**Business verification**:
- **Not needed to start**: unverified portfolios get 2 numbers and 250 business-initiated conversations/24h, scalable to 2,000 WITHOUT verification via the quality-template path (2,000 delivered high-quality template messages to unique users in 30 days).
- **Needed for**: the 20-number cap, the verified scaling path, **Tech Provider status (hard prerequisite before App Review)**, and **OBA**.
- Process: business details + documents in Business Manager; exact UK document list and turnaround not machine-verifiable (Help Center pages are JS-walled) — verify in Business Manager; third-party consensus is days-to-two-weeks.

**OBA (the Groups gate)**: free, self-serve request (WhatsApp Manager or API since Jun 2025). Current official criteria: policy compliance, 30+ days on platform, verified portfolio, two-step verification on, approved display name — **no notability/press requirement in the current doc** (a significant change from the old regime). Denied requests re-submittable after 30 days. The paid Meta Verified subscription is the *Business-app-side* badge route and is NOT required for platform OBA.

### B5. Messaging rules & pricing (verified from Meta's own rate cards, effective 1 Oct 2026)

- **24-hour customer service window**: opens/resets on every inbound user message; free-form messages only inside it; templates only outside it. Tracked per business+user pair.
- **Pricing is per DELIVERED message** (since 1 Jul 2025), inbound always free. **Changed 1 Oct 2026**: service (free-form) messages are now free only for the **first 1,000/month per business number**, then charged; utility templates inside the window are also now charged. The only fully-free lanes left: the first 1,000 service messages/month and the ad-click (CTWA) free-entry-point window (now up to 7 days).
- **UK rates (official rate card, Oct 2026)**: utility **£0.0159**, authentication £0.0159, service beyond free tier £0.0159, marketing **£0.0458** per delivered message. Volume discounts start at 100k utility messages/month (irrelevant at TSP's scale).
- **Templates**: automatic review "up to 24 hours" (usually much faster); 250 templates per WABA unverified, 6,000 verified; low-quality templates get auto-paused (3h → 6h → disabled) on user blocks/reports.
- **Marketing caution**: marketing templates to US numbers are not delivered at all (paused since Apr 2025); Meta's per-user marketing frequency caps are **inactive for UK recipients**. TSP's chase traffic should be UTILITY category throughout — transactional sales-progression updates fit the definition, cost 3× less than marketing, and avoid the pause regime.
- Per-recipient pair rate (~1 msg/6s to the same user) and 250-contact starting cap (§B3) shape early automation: chases are low-volume, well within limits.

---

## C. Recommended architecture

**Option A — direct Meta Cloud API — built tenant-aware from day one.** No BSP in the critical path (360dialog partner tier is the named fallback if App Review or OBA becomes a blocker). Rationale in §J.

### C1. Principles

1. **Extend the existing comms spine, don't fork it.** `OutboundMessage` remains the single message ledger (timeline, indicators, admin log all already read it). WhatsApp gains first-class status: add `whatsapp` to the `OutboundChannel` enum (ending the `channel:"other"` hack) and make the status column mean what it says via webhook-driven transitions.
2. **Statuses are events, not labels.** `queued → accepted(sent) → delivered → read | failed`, each driven by a provider webhook, each timestamped in the existing `sentAt/deliveredAt/openedAt(read)/failedAt` columns. Nothing user-facing ever says "sent" on faith again.
3. **Threads are the mapping unit.** A persistent conversation record owns the transaction link; messages inherit it. Ambiguity goes to a needs-assigning queue, never guessed — the Baileys-era pattern (`WhatsAppGroupMapping` + pending + ignore) generalised to 1:1.
4. **Tenant-aware everywhere**: every thread/message/credential row hangs off a WABA record, which belongs to TSP today and to a ProgressionBusiness/Agency tomorrow.

### C2. Data model (additive; names indicative)

- **`WhatsAppBusinessNumber`** — one row per connected Cloud API number: `wabaId`, `phoneNumberId`, `displayPhone`, `ownerType/ownerId` (tsp | progression_business | agency), encrypted access token (AES-256-GCM via existing `token-crypto`, same pattern as `OutlookConnection`), `tokenExpiresAt`, `status`, `qualityRating`, `messagingTier`, `webhookSubscribedAt`, `lastEventAt` (health).
- **`WhatsAppThread`** — the conversation: `businessNumberId`, `kind` (direct | group), `waId` (E.164 for 1:1, `group_id` for groups), `transactionId?`, `side?` (BUYER|SELLER), `contactIds[]`, `assignmentState` (auto | manual | needs_assigning | ignored), `lastInboundAt` (**drives the 24h service window**), `lastOutboundAt`, `unreadCount`, `groupInviteLink?`, `groupSubject?`. Unique on `(businessNumberId, waId)`. Reassignment moves the thread AND its messages' transaction link in one transaction, with an audit log entry.
- **`OutboundMessage` additions**: `threadId?`, `channel:"whatsapp"`, `waStatus` detail if needed beyond existing status enum; **DB partial unique index** `ON (providerMessageId) WHERE channel='whatsapp'` (the constraint the old system never got).
- **Template registry**: `WhatsAppTemplate` — name, category (utility/marketing), language, body, Meta status (pending/approved/rejected/paused), variables map; synced via the Management API webhooks.
- **Consent**: `Contact.whatsappConsent` (granted_at / revoked_at / channel-preference) — chase automation refuses template sends without it (GDPR + Meta policy).
- Baileys-era models (`WhatsAppConnection/GroupMapping/PendingMessage/IgnoredChat`) stay untouched until decommission (§E).

### C3. Services & routes

- `app/api/webhooks/whatsapp/route.ts` — the Meta webhook: GET verify handshake; POST signature-verify (X-Hub-Signature-256, raw body) → enqueue-and-ack fast → processor handles `messages` (inbound), `statuses` (lifecycle), template status, account/quality events. Idempotent on `wamid`; tolerant of duplicates and out-of-order statuses (status rank only ever advances).
- `lib/integrations/whatsapp-cloud/` — `client.ts` (send text/media/template, typed errors incl. 131047 window-closed → automatic template fallback path), `media.ts` (inbound: fetch URL within 5-min validity, store to `whatsapp-media` bucket; outbound: upload), `threads.ts` (resolve-or-create thread, matching ladder), `windows.ts` (service-window maths off `lastInboundAt`).
- **Matching ladder for inbound 1:1** (accuracy > coverage): existing thread mapping → exact phone match to a Contact on exactly ONE live transaction → auto-assign (thread-level, so it sticks) → phone matches multiple live transactions → needs-assigning with candidates → unknown number → needs-assigning (unknown). Group messages route purely by thread (group id), set at creation time by TSP. Agents/solicitors/progressor numbers are recognised and labelled, never used for transaction matching on their own.
- **Send path**: one server action `sendWhatsAppMessage(threadId | {transactionId, contactId}, body/media)`; checks window state — inside 24h window send freeform; outside, either block with a clear "window closed — send the re-open template?" affordance or send an approved utility template. Writes the OutboundMessage `queued`, flips to `sent` only on API accept, then webhooks take over.
- **Background jobs** (Vercel cron, consistent with existing patterns): webhook-queue drain (if queued), media fetch retries, token-expiry sentinel (alert at <7 days), health monitor (no events for N hours on an active number → Command Centre alert + agent-visible banner — "WhatsApp must not silently stop working").

### C4. Inbox architecture

One data source, two views (the same `WhatsAppThread`/`OutboundMessage` rows):
- **Central inbox** `/agent/messages`: thread list (unread, awaiting-reply = lastInbound > lastOutbound, buyers/sellers, needs-assigning for permitted scope), search, composer with window-state awareness, assignment UI. Access-scoped via `getAccessScope` (Law 7) exactly like transactions.
- **Transaction tab**: the existing WhatsApp tab (currently internal-only) becomes the per-file view for all roles with file access: buyer-side and seller-side threads, full history, reply inline. The internal-only gate drops once sending is real.
- **Realtime**: poll-based refresh initially (matches app conventions; the portal/agent app has no websocket infra), 10–15s on open thread view; revisit SSE later. Unread state per user via a lightweight read-cursor on the thread.
- Activity timeline: WhatsApp rows join the main timeline (ending the deliberate exclusion) with the channel badge, now that senders/statuses are trustworthy; the WhatsApp tab remains the full-fidelity conversation view.

### C5. Indicator repairs (ties to §A6/§D)

- One helper: `lastContactFor(contact | transaction, {direction, confirmedOnly})` reading status-aware rows; all surfaces converge on it.
- Status semantics: a row counts as "contacted" only at `sent-or-better` AND not `failed`; bounce/fail demotes status (fixes bug 1; email benefits too).
- Split indicators where the brief demands: last outbound vs last inbound surfaced separately (hub cards already scan both; the contact pill gains "last reply" alongside "last contacted").
- "N chases this week" includes WhatsApp template chases (drop the email-only filter; count by channel).

### C6. Automated chasing on WhatsApp

- Template-first: each chase type that may fire outside a service window needs an approved **utility** template (instruct-solicitor nudge, docs outstanding, milestone update, info request). Drafted conservatively (utility category discipline — marketing-ish copy gets rejected/paused).
- Channel selection in the existing chase engine: per-contact channel preference + consent + window state → WhatsApp template, else email as today. All existing caps/dedup (`ChaseTask.lastChasedAt`, chase counts) apply channel-agnostically; a WhatsApp chase only marks "chased" on provider-accepted send, and delivery failure surfaces on the task.
- Client opt-in collected via portal (a `whatsappOptIn` preference already exists in portal settings JSON — formalise onto Contact) and recorded with timestamp.

---

## D. UI integration map

Surfaces that change (file refs in §A):
1. `ChaseDrawer` — deep-link handoff → real send with window-awareness; honest status feedback replacing the faith toast.
2. `ContactsSection` — WhatsApp quick-action becomes "open thread" (deep link remains as secondary "open in WhatsApp app"); `LastContactedPill` gains confirmed-status semantics + last-reply line; chases-pill counts WhatsApp.
3. `WhatsAppChat`/`WhatsAppPanel` + file tab — becomes the per-file thread view, un-gated from internal-only, send-capable.
4. NEW `/agent/messages` central inbox.
5. `ActivityTimeline` — WhatsApp rows included with badges.
6. Hub cards (`gone quiet`, `no-comms`, weekly touch) — no structural change; inherit honest statuses; copy audit for "contact" definitions.
7. Command Centre `/command/whatsapp` — reworked around Cloud numbers: health, quality rating, messaging tier, template statuses, needs-assigning queue (kept), per-tenant number list.
8. `WhatsAppConnectionCard` (agent Connections) — replaced by business-number management (TSP-owned now; Embedded Signup entry later). QR pairing UI retires with the bridge.
9. `WhatsappGroupModal` — v2: creates the group via API (when OBA unlocked) and sends invite links; v1: unchanged manual flow.
10. Outbound log (`OutboundRow`) — gains the WhatsApp channel filter (enum fix) and true lifecycle strips.
11. Portal (client side) — opt-in/consent capture; optional "message us on WhatsApp" entry point (free entry-point conversations).

---

## E. Migration strategy

Principle: **parallel run, never a cliff.** The bridge keeps capturing while the Cloud number proves itself.

1. **Phase 0 freeze**: no new feature work on the bridge; document Railway access.
2. **Parallel period**: Cloud API number live for new sending + 1:1 inbound; bridge continues capturing the legacy groups (they live on the old number and cannot move). New sales start on the new workflow (TSP-created API groups if OBA is in hand, else 1:1 threads per side).
3. **Historical data**: all Baileys-era rows stay exactly where they are (`OutboundMessage` `method:"whatsapp"`); tag them (e.g. `providerWebhookData.source:"bridge"` already distinguishes them) and label in UI as "captured history — delivery unverified". No re-import, no dedup risk (different id namespaces: Baileys ids vs `wamid.…`).
4. **Thread back-linking**: where an old `WhatsAppGroupMapping` exists for a still-active sale, create the new-era thread for the same transaction/side so the file shows one continuous story (old capture section + new thread section). Phone-number threads back-link by contact match at assignment time.
5. **What cannot be migrated** (say it plainly in-app): old group conversations cannot continue on the new number; clients must join the new TSP-created group (invite link) or continue 1:1. Messages that only exist in the phone's WhatsApp (pre-bridge) remain importable only via the existing paste importer.
6. **Decommission**: once legacy sales with active old-number groups complete (or a cutoff date), unlink the bridge device, stop the Railway service, archive the `whatsapp-bridge/` package, keep the DB models read-only for history. The old number stays alive on the phone app for any stragglers until retired.

---

## F. External setup checklist (Ellis, outside the codebase)

Mandatory, in order:
1. **Meta Business Portfolio** — confirm/claim the TSP portfolio in business.facebook.com; complete **Business Verification** (docs: company reg + proof; unlocks the 2k tier and 20-number cap).
2. **Meta App** — create (Business type) with the WhatsApp product attached to the portfolio.
3. **Phone number** — provision a NEW dedicated number for the API (mobile, or a voice-capable landline with IVR/forwarding off for the verification call — both officially fine, §B4). Do NOT touch +447508862929: deleting/moving it would permanently destroy its app history, and coexistence would make it Groups-ineligible.
4. **WABA + number registration** — via the app dashboard; set display name ("The Sales Progressor" — subject to display-name review).
5. **System User token** — create an admin system user, generate a never-expiring token scoped to `whatsapp_business_messaging`, `whatsapp_business_management`, `business_management`; store in Vercel env (staging + prod values).
6. **Webhook config** — callback URL + verify token to the new route; subscribe the WABA to `messages` (+ template/account fields).
7. **Payment method** on the WABA (per-message billing; UK utility rates `PENDING RESEARCH`).
8. **Templates** — submit the initial utility set (chase nudges, milestone update, window-reopen) for approval.
9. **OBA request** — THE groups gate, now looking very winnable: once Business Verification is done, the number has an approved display name + two-step verification and 30 days on the platform, submit the free OBA request from WhatsApp Manager (no notability/press requirement in the current criteria). If declined, re-request after 30 days. This decides §G Phase 6 timing.
10. GDPR: DPA/records update for Meta as processor; privacy policy WhatsApp clause; retention statement.

Later (multi-tenant phase): TSP business verification must be done (it will be, per step 1); App Review with the two demo videos; Embedded Signup v4 configuration (Facebook Login for Business config); per-tenant onboarding runbook.

Optional: 360dialog partner-tier account as fallback/accelerator; Meta Verified subscription trial for the badge question.

---

## G. Phased roadmap (dependencies ordered)

1. **P1 — Platform plumbing**: external setup F1–F7; `WhatsAppBusinessNumber` model + encrypted creds; webhook route (verify, signature, idempotent store); send client; health monitoring. *Exit*: test number sends/receives in a sandbox file; statuses flow.
2. **P2 — Threads + matching**: `WhatsAppThread`, matching ladder, needs-assigning queue (generalising the Command Centre pattern), reassignment with history move.
3. **P3 — Honest ledger**: `channel:"whatsapp"` enum, DB dedup index, status transitions wired into `OutboundMessage`; **indicator repair** (incl. the email bounce-demotion bug — pre-existing, fixed here because the same semantics land).
4. **P4 — Surfaces**: per-file thread view (send + history + media + statuses), then central inbox; timeline inclusion; ChaseDrawer real-send swap.
5. **P5 — Automated chasing**: template registry + approvals, consent capture, chase-engine channel integration, caps/dedup, failure surfacing.
6. **P6 — Groups** (gated on OBA outcome from F9): group creation per side, invite-link flow replacing `WhatsappGroupModal` manual steps, group webhooks → threads; falls back to 1:1-per-side if OBA refused.
7. **P7 — Migration + decommission** (§E): parallel-run wind-down, bridge retirement.
8. **P8 — Multi-tenant**: App Review, Embedded Signup v4, per-tenant WABA onboarding, tenant isolation tests, per-business inbox scoping. (Independent of P6; can start after P4 if demand pulls.)

TSP's own team gets full value at P5 without groups and without Meta app review — those are the two external-approval risks, and both are isolated at the end.

---

## H. Testing & acceptance criteria

Platform: send from a file → status reaches `delivered` (webhook, not assumption); reply arrives in <5s poll and on the right file; duplicate webhook delivery creates no second row (DB constraint proven); out-of-order `read` before `delivered` ends at `read`; failed send (invalid number) surfaces on the thread + chase task and does NOT bump last-contacted; token expiry alert fires; webhook silence alert fires; media round-trip (inbound image/PDF/voice stored + rendered; outbound delivered); window: freeform blocked at 24h+1min with template affordance shown; template send outside window delivers and is billed-tagged.
Matching: unknown number → needs-assigning (never auto-filed); contact on two live sales → candidates queue; assignment sticks for subsequent messages; reassignment moves history and leaves an audit trail; shared phone number (couple) attaches both contacts.
Indicators: bounced email chase no longer shows "Contacted today" (regression test on the fixed bug); last-outbound vs last-inbound distinct; WhatsApp chase counts in weekly chase pill.
Chasing: duplicate-chase prevention across channels (one chase event regardless of channel); consent-revoked contact never receives a template; caps respected.
Multi-tenant (P8): tenant A's webhook events never readable by tenant B (access-scope tests per Law 7 harness); tenant disconnect stops sends within one minute and marks threads read-only.
Groups (P6): group created with correct subject; join via invite link observed via webhook; message to group fans out with per-recipient statuses; 8th-seat rejection handled gracefully.

---

## I. Decisions you need to make

1. **Groups-dependency appetite** — proceed 1:1-first with groups as upside (recommended), or block on OBA before any build? Consequence: 1:1-first delivers in weeks and degrades gracefully; OBA-first risks indefinite stall on a discretionary badge.
2. **OBA timing** — the request is free and the current criteria are mechanical (verification + 30 days + display name + 2FA), so the real decision is just: submit as soon as eligible and treat Groups (P6) as planned-but-unscheduled until it's granted. Paid Meta Verified is NOT needed for the platform badge.
3. **New number vs existing** — CONFIRMED recommendation: new number. Moving +447508862929 would destroy its history and still not bring its groups; coexistence on it would block Groups API forever.
4. **Direct vs BSP** — direct Cloud API (recommended: no per-message markup, full data control, we already run webhook infra for SendGrid/Outlook) vs 360dialog partner tier (faster multi-tenant onboarding, Groups support confirmed, €250+/mo). Switching later is possible (number porting between hosting types) but not free.
5. **Client migration posture** — actively invite existing clients into new-number conversations (template invite) vs let legacy sales finish on the old workflow. Affects how long the bridge runs.
6. **Bridge end-of-life date** — hard cutoff vs "when last mapped group completes".
7. **Chase channel policy** — WhatsApp-preferred-when-consented vs email-primary with WhatsApp for urgent steps only (cost + 250/day starting cap both argue for selective use initially).
8. **Multi-tenant timing** — P8 pulled earlier only if a progression business commits; App Review lead time is the long pole.

---

## J. Final recommendation

**Build Option A — direct Meta Cloud API, tenant-aware schema from day one, 1:1-threads-first, groups as a gated Phase 6, bridge retired via parallel run.**

Why: the current system cannot send, cannot confirm, and sits on a ToS-violating bridge carrying ban risk on the live business number; the official platform now covers every core need (send, receive, statuses, media, templates, multi-tenant onboarding) and — newly — groups, with the one discretionary gate (OBA) isolated where it can't block the rest. Direct-over-BSP because TSP already operates exactly this shape of infrastructure (SendGrid webhooks, Outlook sync, signed-webhook handling), per-message BSP markup compounds forever, and 360dialog remains available as a bolt-on fallback without re-architecting (the schema is provider-agnostic at the thread/message layer).

Operating cost (UK rate card effective Oct 2026): Railway's ~$5/mo goes away. Inbound free; replies free up to 1,000 service messages/month per number (ample at current volumes), then £0.0159 each; utility template chases £0.0159 per delivered message; marketing category avoided entirely. Realistic worked example: 50 active sales × 20 template chases + updates/month = 1,000 utility messages ≈ **£16/month**, plus one phone line rental. Multi-tenant phase: each business pays Meta directly for its own usage (Tech Provider model) — TSP carries no message costs for tenants.

Order: G's P1→P5 is the commitment (TSP team fully served, honest indicators everywhere); P6–P8 are option-value phases triggered by OBA and tenant demand respectively.

---

*Compiled from: codebase audit (file-referenced throughout), communication-indicator inventory, and five Meta-platform research tracks (Groups API, Cloud API fundamentals, Tech Provider/BSP, numbers/coexistence/verification, messaging rules/pricing — all complete, all claims live-verified against official Meta pages and rate cards on 2026-10-12). Primary repo sources: `docs/WHATSAPP_INTEGRATION.md`, `docs/active/whatsapp-agent-facing/SPEC.md`, `docs/audits/WHATSAPP_CAPTURE_AUDIT_2026-08-25.md`, `prisma/schema.prisma`.*
