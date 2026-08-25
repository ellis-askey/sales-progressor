# Chain-invite conversion — build plan

**Goal:** lift the number of invited agents who actually join a chain (and end up
using the app). North-star metric: **invited → joined** conversion, broken down by
funnel step so we can see *where* the drop is.

Context: agent-to-agent chain invites already land on a value-first landing page
(`/claim` shows the chain with no login wall). The leaks are (1) a sign-up form
far heavier than its "15 seconds" promise, (2) no visibility into mid-funnel
drop-off, (3) a 7-day expiry + exact-email lock quietly binning invites.

Delivering phase by phase. After each phase: a plain-English explanation of how it
works + every user-facing string.

## Phases

- **Phase 0 — Measure the funnel.** ✅ Shipped (staging). See below.
- **Phase 1 — Cut the sign-up wall.** ✅ Shipped (staging). Sign-up trimmed to
  name, password, agency + two quick taps (tenure, purchase type — the milestone
  engine needs them). The "Where is this sale up to?" reconciliation choice and
  two-step milestone wizard are removed from sign-up; every claim now lands on the
  file with the existing dismissable "Bring this file up to date" banner
  (ReconcileLaterBanner), so catching up on progress happens in-app, in context.
  Note: tenure + purchase type kept at sign-up deliberately — moving them in-app
  too would need a nullable/pre-setup file state (milestone engine depends on
  them) for near-zero friction gain. Existing-agent paths (/claim/login,
  /claim/confirm) keep their inline reconciliation for now.
- **Phase 2 — Stop silently binning invites.** ✅ Shipped (staging). Invite expiry
  extended from 7/14 days to 60. Exact-email lock relaxed: any logged-in agent with
  an agency can claim via a valid token (the originator self-claim guard stays) —
  removes dead-ends from forwarded invites, generic office inboxes, and different
  login emails. Resend cap added (1 initial + 5 resends). Expiry copy on the four
  "expired" screens made window-agnostic. Deferred (not conversion-critical): the
  unused inviteUnsubscribedAt column and decline-notification retry stay as-is
  (Law 19 grandfather — a drop-column migration isn't worth the risk).
- **Phase 3 — Lift the email (open + click).** ✅ Shipped (staging), click-first
  (no open pixel — decided: unreliable under Apple MPP + small deliverability cost,
  and we already capture click-through + bounces). Two changes: (1) invite +
  nudge sender branded from the ORIGINATING FILE (resolveChainInviteSender), so it
  always shows the customer agency "{first} at {Agency}", never "Sales Progressor".
  This fixes outsourced files run by internal staff (agencyId null), which
  previously leaked "Sales Progressor" + the internal person's name because the
  sender was derived from the chain creator's user. Persona = the agency agent
  (self-managed) or the assigned progressor (outsourced). Full agency-DOMAIN
  sending still needs the agency's verified quoteSenderEmail; without it the
  from-name is agency/persona-branded but the address falls back per policy.
  (2) A one-time auto-nudge: a daily weekday cron
  (/api/cron/chain-invite-nudge, 10:00) emails a gentle reminder to invites
  delivered but never opened after 3 days, reusing the SAME token (original link
  still works), capped at one per invite (inviteNudgedAt). Deferred: formal
  subject-line A/B (premature at current volume — needs hundreds of sends to read).
  Migration 20260825130000_chain_invite_nudge (one nullable column).
- **Phase 4 — Make invites actually get sent.** ✅ Shipped (staging). (1) In-app
  nudge: the file's Property chain card shows "N neighbours are added but not invited
  yet" (UninvitedNeighboursNote) when there are unclaimed stub links with an email and
  inviteStatus NOT_SENT; the existing Open chain button is the action. (2) Command
  Centre "Ready to invite" list on /command/chain-invites: every neighbour added with
  an email but never invited, so idle pipeline gets prodded. No migration. Deferred:
  making the neighbour-email field more prominent in the add-node flow (POLISH-TBD).
- **Phase 5 — Activation after claim.** ✅ Shipped (staging). First-value on join
  already existed (ClaimWelcomeModal "You're in" + ClaimedToast + the Phase 1
  reconcile banner), so no new overlay was added (avoided duplication). Built the
  missing measurement: getClaimActivation + an "After they join" section on
  /command/chain-invites showing the share of claimers who've confirmed at least one
  step post-claim (excluding reconciled-at-claim onboarding), plus a "joined but
  quiet" check-in list. No migration.
- **Phase 6 — The compounding loop.** ✅ Shipped (staging). (1) At the join moment,
  the "You're in" welcome modal now prompts the new agent to add the agent above/below
  them so we invite them in too, seeding the next round of invites. (2) getLoopMetrics
  + a "Knock-on" section on /command/chain-invites: joiners → how many then invited
  others → onward invites sent → claims from those. When "joined from those" outpaces
  "joined", the flywheel is turning. No migration.

## Phase 0 — Measure the funnel (shipped)

**What it records** (source of truth = stamps on `ChainLink`):
- `inviteSentAt` (existing) — invite emailed.
- `inviteFirstViewedAt` (new) — first `/claim` landing view = email click-through.
- `claimStartedAt` (new) — first claim step reached (signup / login / confirm) =
  clicked "Claim this sale".
- `claimedAt` / `inviteStatus=CLAIMED` (existing) — joined.
- `inviteDeclinedAt`, `inviteBouncedAt` (existing) — declined / undeliverable.

**Where it's stamped:** `lib/chain/funnel.ts` (`recordInviteViewed`,
`recordClaimStarted`), called from `app/claim/page.tsx` (viewed) and the three
claim-step pages (started). Completed/declined/sent also fire PostHog events
(`ANALYTICS_EVENTS.CHAIN_*`) from the claim route, decline page and invite sender.

**Dashboard:** Command Centre → Growth → **Chain invites**
(`/command/chain-invites`). Funnel bars (Sent → Viewed → Started → Joined with
drop-off), stat cards (Awaiting / Declined / Bounced / Expired), a date-range
toggle (30 / 90 / All), and a **"Looked but haven't joined"** call-list of warm
leads. Data in `lib/command/chain-invites.ts`.

**Deliberately deferred:** email OPEN tracking. It needs SendGrid's open pixel
(a deliverability cost) and is unreliable (Apple Mail Privacy fakes opens). The
click-through is captured for free by the landing view, so the funnel begins
there. Revisit as an explicit decision in Phase 3.

**Migration:** `20260825120000_chain_invite_funnel` — two nullable columns on
`ChainLink`. Applies via `prisma migrate deploy` on the branch deploys
(staging first, then prod). No hand-applying.
