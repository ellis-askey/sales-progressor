# Agent email rollout — implementation log

Running record of the agent-email work that follows the forensic audit
(`docs/` audit artifact). Updated as each batch lands. Nothing here is pushed
until Ellis says so.

Status key: ✅ done (working copy) · ⏳ remaining · 🔎 needs a decision

## Emails on the new design (14 of 20)

- Emails **1–6** (Welcome, Waiting-for-you, Ready-for-next, How-are-things,
  Leave-you-to-it, Sale-connected) — ✅ already live before this rollout.
- **#8 Verify email** — ✅ wired to `buildEmailVerification`; reply-to support@.
- **#9 Password reset** — ✅ wired to `buildPasswordReset`; from Sales Progressor; reply-to support@.
- **#10 Sending address needs attention** — ✅ wired to `buildDomainAuth`; first-name only; reply-to support@.
- **#11 / #12 Team invite (director / negotiator)** — ✅ wired to `buildTeamInvitation`; first-name greeting.
- **#13 / #14 Team grew / Director joined** — ✅ wired to `buildTeamJoined`; correct role split; first-name greeting.
- **#20 Client sent you a message** — ✅ wired to `buildPortalMessage`; from Sales Progressor.

- **#7 First sale exchanged** — ✅ wired: retention dispatch (`first_exchange`) now renders the new `first-exchange.ts` hero design; old `buildFirstExchange` in retention superseded (dead, commented).

## Chain emails — all live-wired ✅ (Option A)

- **First invite → "See the whole chain"** — ✅ `lib/chain/invite.ts` → `buildChainOverview`. Eye stat shows "{X} agents connected so far" at 2+, else "Chain visibility · beyond your own sale" (`icon-eye-line.png`). Old inline template removed.
- **3-day nudge → "Your chain is waiting for you"** — ✅ `lib/chain/invite-nudge.ts` → `buildChainInvite`; **now skips unsubscribed neighbours** (`inviteUnsubscribedAt`). Old inline template removed.
- **Neighbour update → "Something's moved in your chain"** — ✅ `lib/services/chain-neighbour-updates.ts` → `buildChainUpdate`. Old inline template removed.
- **Day-14 → "Your chain is still moving"** — ✅ single baked hero (`hero-chainstillmoving-full.png`); new `lib/chain/invite-reminder.ts` (`sendDueChainReminders`) added to the chain-invite-nudge cron; one-time via new `ChainLink.inviteChainReminderSentAt` field (migration `20260906120000_add_chain_reminder_sent` — applies to staging on next deploy).

All chain emails send from the originating agency with the TSP-header design; old agency-logo band dropped.

## Digests — both wired ✅

- **#18 Your week in sales** — ✅ `agent-weekly-brief.ts` → `buildWeeklyBrief`. Directors = whole branch, negotiators = own sales; TSP-managed never flagged attention; cap 8 + "and N more in your pipeline"; footer → `/agent/account/notifications`.
- **#19 Here's what needs you** — ✅ `morning-digest.ts` → `buildMorningBrief`. Directors excluded from TSP-managed files; each section cap 8 + "and N more →" (no more silent truncation); addresses split to two lines; footer → notifications page. **Send time now 08:30 UK year-round**: cron changed to `*/15 6-9 * * 1-5` and the route gates on Europe/London 08:30 (with `?force=1` bypass for on-demand testing).

18 of 20 now live-wired. Remaining: the 3 chain emails (copy done, live wiring pending #3 hero + refactor) + the new day-14.

## Cross-cutting fixes

- **Names first-name-only (#7 problem)** — ✅ `greetingName` + `nameWithoutTitle` helpers in `lib/contacts/displayName.ts`; applied to team emails.
- **Sender consistency (#12 problem)** — ✅ portal message + milestone alerts (agent & progressor) now from Sales Progressor.
- **Password-reset sender (#13 problem)** — ✅ from Sales Progressor, reply-to support@.
- **Hero content folder (#17 problem)** — ✅ `Images/Final Agent Email Hero Content/` (25 images).
- **Stale comment (#19 problem)** — ✅ corrected in `send-claim-welcome.ts`.
- **Duplicate-send hardening (#15 problem)** — ✅ retention now claims (writes the log row) before sending, matching the welcome pattern. NOTE: full concurrent-race atomicity for `first_exchange` would want a `@@unique([userId, emailKey])` on `RetentionEmailLog` (a follow-up migration) — deferred.
- **Unsubscribe links in digests (#3 problem)** — ✅ both digests' footers now link to `/agent/account/notifications`.
- **Chain nudge respects unsubscribe (#4 problem)** — ✅ nudge query now excludes `inviteUnsubscribedAt`.
- **Honour global unsubscribe / bounce (#5 problem)** — ⏳ DEFERRED, needs a product call: the global `emailUnsubscribedAt` flag is set by BOTH hard bounces AND general unsubscribe, so blanket-suppressing every agent email would also block transactional ones (password reset/verify/invites) for someone who opted out. Recommend: suppress non-essential kinds on that flag, keep transactional always-send — but that's a per-kind policy decision.

## For Ellis to confirm (hosting/DNS — not code)

- 🔎 `CHAIN_EMAIL_BCC` unset in production (staging BCC to a personal Gmail).
- 🔎 `NEXTAUTH_URL` set to the live site in production.
- 🔎 Cron jobs enabled + not paused in Vercel.
- 🔎 support@ inbox monitored (now used as reply-to). — confirmed yes.

## Open decision

- 🔎 Domain-auth "fix it" button currently points at `/agent/account/profile`; confirm sending-address settings live there.
