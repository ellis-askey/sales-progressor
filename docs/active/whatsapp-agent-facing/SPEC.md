# Agent-facing WhatsApp capture — spec

Status: proposed (2026-09-14). Decisions locked with founder; build not started.
Owner: WhatsApp integration + agent app + Command Centre.
Builds on: `docs/WHATSAPP_INTEGRATION.md` (the live internal system) and
`docs/audits/WHATSAPP_CAPTURE_AUDIT_2026-08-25.md`.

## Why

The WhatsApp integration works today but is **internal-only**: a single global
linked device (Ellis's number) operated from the Command Centre, matching
messages across every agency at once. We want agencies to connect their own
WhatsApp so their property-group conversations land on their files automatically
— without any risk of capturing chats that aren't about a specific sale.

This spec makes it safe to hand to agents: **groups-only capture, per-agency
scoping, an in-app connect flow, and clear consent.** Auto-created to-dos come
last, once capture is proven.

## What exists today (reuse, do not rebuild)

- **Bridge:** an always-on Baileys service on Railway that holds one WhatsApp
  socket, renders the pairing QR, and POSTs messages to the app
  (`whatsapp-bridge/src/index.ts`, `server.ts`). Connection is a QR scan
  (WhatsApp → Linked Devices → Link a device).
- **Ingest:** `POST /api/integrations/whatsapp/ingest` (bearer-secret gated,
  `app/api/integrations/whatsapp/ingest/route.ts`), calling
  `lib/integrations/whatsapp/ingest.ts`. Messages are stored on the existing
  `OutboundMessage` spine (`method: "whatsapp"`), not a bespoke table.
- **Group matching + name parsing already work:** `parseGroupName` handles
  `Sale of {address}` → SELLER and `Purchase of {address}` → BUYER
  (`ingest.ts:166`); `matchGroup` resolves the address to one active
  transaction (`ingest.ts:118`). Mappings persist in `WhatsAppGroupMapping`,
  keyed by `waChatId` so they survive group renames.
- **`WhatsAppConnection` model exists but is an unused stub**
  (`prisma/schema.prisma`, per-user: `userId`, `phoneNumber`, `status`,
  `lastSeenAt`, `lastMessageAt`). Wiring it up is the backbone of this work.
- **Command Centre WhatsApp page** (`app/command/(protected)/whatsapp/page.tsx`)
  — the internal status/pairing/needs-assigning surface. Superadmin only. Stays.
- **To-do creation** (`lib/services/whatsapp-promises.ts`) — internal-only,
  scans the operator's OUTBOUND messages for dated commitments, creates
  `ManualTask`s (`isInternalSelfAssigned: true`). Deferred to Phase 4 here.

## Locked decisions

1. **Connection = the agent's own number**, linked by QR (WhatsApp → Linked
   Devices). Lowest friction; their existing property groups just flow in. The
   ban-risk trade (a ban hits their main business number) is accepted, mitigated
   by strict passivity + fingerprint reduction + explicit consent (below).
2. **Groups-only. Direct 1-to-1 chats are never captured.** DM phone-number
   matching is removed for **every** connection, including the internal number
   (founder decision 2026-09-14 — applies to everyone, not just agencies). An
   explicit prior mapping is the only way a DM can attach to a file.
3. **Silently ignore anything that isn't a property group.** A group whose name
   is not exactly `Sale of {address}` / `Purchase of {address}` (case-insensitive
   prefix) is dropped — never stored, never listed, no "needs assigning" entry.
   Exception: a correctly-named property group that doesn't resolve to one file
   *yet* still goes to the needs-assigning queue (so nothing legitimate is lost
   and the self-heal replay still works).
4. **Address matches on the first line.** Parse both the group-name address and
   the stored `propertyAddress` down to their first line (text before the first
   comma), normalise (trim, lowercase, collapse whitespace), and compare. Full
   address or first-line-only in the group name both work. Replaces the current
   loose substring `contains` (which can mis-hit, e.g. "18 High St" ⊂ "118 High
   St").
5. **Strictly passive.** No sending, no chases, no auto-replies, no presence
   broadcasting, ever. Capture-only.
6. **To-dos come last** (Phase 4), only after capture is proven, and are
   turn-off-able.

## Phase 1 — Groups-only lockdown — DONE (2026-09-14, committed unpushed)

Tighten matching so the pipeline can never store anything but a resolved
property group. Applied to **everyone incl. the internal number** (founder
changed the scope from agencies-only). No schema change, no agent surface yet.

1. **First-line address matching.** New pure module
   `lib/integrations/whatsapp/match.ts`: `firstLineAddress(s)` (text before first
   comma, lowercased, whitespace-collapsed) + `chooseTransaction(needle, rows)`
   (exact first-line equality, then draft-twin preference). `matchGroup` narrows
   in the DB by a first-line substring, then refines with exact equality — so
   "18 High St" can no longer mis-hit "118 High St". `parseGroupName` moved here;
   re-exported from `ingest.ts` for existing importers.
2. **Groups-only.** `ingestOne` drops any non-group message (`status: "ignored"`,
   reason `not_group`). `matchDirect` removed.
3. **Silent-ignore non-property groups.** A group whose name doesn't parse as a
   property group returns `not_property` → ignored, no pending row. A parsed
   property group with no single file match still goes to pending (needs
   assigning), preserving manual match + self-heal.
4. **Tests:** 22 passing — `whatsapp-match.test.ts` (pure: parse, first-line,
   118-vs-18, draft-twin, ambiguity) + `whatsapp-ingest-routing.test.ts`
   (Prisma-mocked: DM ignored, non-property ignored, parsed-unmatched queued,
   matched logged+mapped, explicit mapping still honoured). `tsc` clean.

## Phase 2 — Per-agency connection — DONE (2026-09-14, committed unpushed)

Login-storage decision: **Railway persistent disk** (founder pick). No PWA schema
change was needed. Split into part A (app-side scoping, unit-tested here) and
part B (bridge multi-connection, type-checked, deploy+test on Railway by founder).

- **A (app):** `lib/integrations/whatsapp/connections.ts` (`resolveConnectionScope`
  → agency, `touchConnectionMessage`); `ingest.ts` scopes group matching to the
  connection's agency, drops unknown-connection messages (`unknown_connection`),
  and drops an agency's unmatched-but-named group instead of leaking it to the
  internal queue (`no_file_in_agency`). Legacy internal number (no connectionId)
  unchanged. 4 new tests (26 total), `tsc` clean.
- **B (bridge):** refactored the single-socket bridge into `Connection` +
  `ConnectionManager` holding the internal number plus one socket per agency.
  Per-connection auth under `AUTH_DIR/conn/<id>` (internal keeps the `AUTH_DIR`
  root → no re-scan), per-connection watermark, `resumeAll()` reconnects every
  linked connection after a restart, new `/connections/:id/{pair,status,qr,repair,
  disconnect}` + `/connections/:id/pair-page` control endpoints, agency messages
  stamped with `connectionId` and `syncFullHistory:false` (fingerprint
  reduction). Bridge `tsc --noEmit` clean. Requires a Railway persistent volume
  (see `docs/active/ELLIS_MANUAL_TODO.md`).

Make the bridge and ingest multi-tenant so each agency's messages can only ever
touch that agency's files.

1. **Bridge becomes multi-session.** Instead of one socket, the bridge manages a
   map of `connectionId → Baileys socket`, each with its own persisted auth
   state (`useMultiFileAuthState` per connection). Requires durable per-connection
   storage — a Railway volume, or move auth state to Supabase/Postgres so
   connections survive redeploys. **Infra decision needed** (see open questions).
2. **Pairing per connection.** Bridge control API gains "start pairing for
   `connectionId`" → spins up a socket → returns its QR data URL, and a
   per-connection status. All secret-gated; the agent app never calls the bridge
   directly.
3. **Ingest carries `connectionId`.** Each posted message includes which
   connection it came from. Ingest resolves `connectionId → WhatsAppConnection →
   user.agencyId`, and **scopes matching to that agency's active transactions
   only**. The legacy internal number (no connection / Ellis) keeps its current
   global behaviour unchanged.
4. **Wire `WhatsAppConnection`.** On successful pair, write/update the row
   (`userId`, `phoneNumber`, `displayName`, `status`, `lastSeenAt`,
   `lastMessageAt`, new `consentAcceptedAt`). On disconnect, mark it and tear the
   socket down. This is the per-user record the agent app reads.
5. **Fingerprint reduction for agent sockets:** `syncFullHistory: false` (capture
   from connect-time forward, not the whole history), `markOnlineOnConnect:
   false` (already set), quiet presence, human-paced reconnect/backoff.

**Schema (Phase 2):** none — the existing `WhatsAppConnection` model suffices
(its `id` is the connectionId, `userId` resolves the agency). `consentAcceptedAt`
moves to Phase 3 with the consent screen.

## Phase 3 — Agent-facing connect experience + controls

Built in parts (like Phase 2). **Part 1 (plumbing) DONE + committed
(`3430e71e`).** **Part 2 (connect screen + consent) DONE 2026-09-14 — awaiting
commit.** **Part 3 (CC off-switch + naming helper) remains.**

**Part 2 (done):** `components/account/WhatsAppConnectionCard.tsx` — cream card
mirroring the Outlook `AccountConnectionsCard`, added to the existing
`/agent/account/connections` page under a "WhatsApp" section (no nav change; the
Connections tab already exists). States: not-switched-on, consent (founder copy
verbatim, tick gates the action), waiting-to-scan (polls every 3s, shows the QR
once the bridge emits it), connected (shows the number + disconnect). Talks only
to `/api/agent/whatsapp/*`. DPA/privacy note added to `ELLIS_MANUAL_TODO.md`.
`tsc` clean; 35 tests still pass. Not visually screenshotted (auth-gated + bridge
off locally) — verify on staging.

**Part 1 (done):** schema — `WhatsAppConnection.phoneNumber` made nullable (a row
exists from pairing start, before the number is known) + `consentAcceptedAt`
added (migration `20260914170000_whatsapp_connection_agent_fields`, applies on
deploy, staging first). Server-side `lib/integrations/whatsapp/bridge-client.ts`
(per-connection control calls, secret stays server-side, never throws).
Session-scoped `lib/integrations/whatsapp/agent-connections.ts`
(`getMyWhatsAppStatus` / `startMyWhatsAppPairing` / `disconnectMyWhatsApp`, each
touches only the caller's own row). Agent API `app/api/agent/whatsapp/
{status,pair,disconnect}` (director/negotiator only; pair requires the consent
tick). 9 new unit tests (35 total), `tsc` clean.

**Founder-approved consent copy (verbatim, for the Part 2 screen):**

> Link your WhatsApp so your property group chats appear on the right sale, with
> nothing to copy across.
>
> **What appears on your files:** Only group chats named "Sale of [address]" or
> "Purchase of [address]" that match one of your live sales. Messages from those
> groups will appear on the property's timeline.
>
> **What we never see:** Your one-to-one chats or any groups that aren't property
> groups. We don't read, store or have access to them.
>
> **How the link works:** Your WhatsApp is connected as a linked device, in the
> same way as WhatsApp Web. This is an unofficial connection, so there is a small
> risk to your number. We only ever read messages and never send them, which
> helps keep that risk low. You can disconnect at any time from this screen.
>
> ☐ I understand and want to link my WhatsApp.

Everything an agency needs to turn it on themselves, in the agent app (cream
chrome), reusing the Account > Connections pattern already built for Outlook
(`components/account/AccountConnectionsCard.tsx`).

1. **Connect screen** (`/agent/account/connections`, new WhatsApp card): shows
   status (not connected / awaiting scan / connected as {number}), an in-app QR
   (proxied from the bridge via a new agent-scoped PWA API — the bridge secret
   stays server-side), and a disconnect button. Polls status until linked.
2. **Consent gate.** Before the QR renders, a one-screen explainer + tick:
   what's captured (only groups named `Sale of…`/`Purchase of…` that match your
   files), what's not (never your DMs or other groups), that it's an unofficial
   link carrying a small risk to your number, and that they can disconnect
   anytime. Stores `consentAcceptedAt`. Voice-passed (Law 21).
3. **The naming convention made easy.** On a file, the existing "create WhatsApp
   group" helper (`components/contacts/WhatsappGroupModal.tsx`) pre-fills / shows
   the exact required group name (`Sale of {first line}` / `Purchase of {first
   line}`) so agents don't have to remember it. Copy-to-clipboard of the exact
   name.
4. **On/off controls.**
   - Agent self-serve: disconnect (primary off switch).
   - Command Centre: a per-agency master toggle on `/command/agencies` (beside
     the existing chase/weekly toggles) to force-disable capture for an agency —
     new `Agency.whatsAppCaptureEnabled Boolean @default(true)`.
5. **Where captured messages already show:** they land on the file's
   comms/timeline via `OutboundMessage` — no new surface needed, but verify the
   agent-app timeline renders `method: "whatsapp"` cleanly (label, direction,
   sender-or-"client").

**Schema (Phase 3):** add `Agency.whatsAppCaptureEnabled`. Migration staging
first.

## Phase 4 — Agent-facing to-dos (last, only once capture is solid)

Extend the existing promises engine to agencies, turn-off-able.

1. **Agency scoping + surfacing.** Promises currently create
   `isInternalSelfAssigned` tasks hidden from agency users
   (`manual-tasks.ts:48`). Add an agency-visible variant that shows in the agent
   app on the file, dated (`dueDate`).
2. **Completion date.** `ManualTask` has no `completedAt` today (only a `status`
   flip). Add `completedAt DateTime?` so "done" is dated. Migration staging
   first.
3. **Two ways to complete:** (a) the agent marks it done in-app (easy, reuse
   `updateInternalManualTask` pattern); (b) *stretch* — a confirmation in the
   WhatsApp group auto-completes it. Note (b) needs reading INBOUND group
   messages and detecting completion, and group sender identity is unreliable
   (LID privacy, `lib/command/whatsapp.ts:152`) — spec (b) separately after (a)
   ships.
4. **Turn-off.** New `Agency.whatsAppTasksEnabled Boolean @default(false)`
   (opt-in), surfaced as a CC toggle and/or an agent setting.

## Out of scope

- Any outbound sending, chasing, or auto-reply over WhatsApp (permanent — the
  passivity is the risk control).
- Reading DMs or non-property groups (Decision 2/3).
- The official WhatsApp Business Cloud API — it **cannot read group messages**,
  so it can't serve this feature. Noted so it isn't re-proposed.
- Migrating the internal global number off its current behaviour. It stays as-is.

## Risks / open questions

1. **Ban risk on agents' own numbers.** Passive-only removes the biggest trigger
   (sending), but unofficial-client detection + cloud-hosted socket remain a
   modest, non-zero risk; a ban would cost the agent their business WhatsApp.
   Mitigated by passivity + fingerprint reduction + consent. Accepted by founder,
   disclosed to each agent at connect. **Confirm the consent wording with
   founder before Phase 3 ships.**
2. **Bridge auth-state durability (Phase 2).** Many connections need durable
   per-connection auth storage (Railway volume vs Supabase). Pick before Phase 2.
3. **Scale of sockets.** One Node process holding N WhatsApp sockets has a
   practical ceiling. Fine for early agencies; revisit sharding if adoption grows.
4. **Group sender identity** stays unreliable in groups (direction yes, person
   no). Acceptable for capture; matters for the Phase 4 stretch (group-confirm
   completion).
5. **DPA / new integration surface.** Agent-facing WhatsApp is effectively a new
   third-party data flow for customers — add to
   `docs/active/ELLIS_MANUAL_TODO.md` (consent, privacy-policy line, DPA).

## Definition of done (per phase)

- **P1:** first-line matching + groups-only + silent-ignore live and unit-tested;
  internal system unaffected; `tsc` clean.
- **P2:** an agent can pair their number; their messages match only their
  agency's files; `WhatsAppConnection` reflects live state; internal number
  unchanged.
- **P3:** an agency connects, consents, and captures end-to-end from the agent
  app; disconnect works; CC master toggle works; timeline renders WhatsApp.
- **P4:** dated, agency-visible to-dos from WhatsApp, completable in-app, with a
  per-agency off switch and `completedAt`.
