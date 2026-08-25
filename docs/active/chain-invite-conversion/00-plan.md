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
- **Phase 3 — Lift the email (open + click).** Subject-line testing, deliverability,
  copy, a gentle nudge/reminder. Needs Phase 0 data first.
- **Phase 4 — Make invites actually get sent.** Measure un-invited neighbours;
  prompt originators to invite; make capturing a neighbour's email natural.
- **Phase 5 — Activation after claim.** Instant first value on join; short guided
  first-run; measure return-within-a-week + first milestone.
- **Phase 6 — The compounding loop.** On join, prompt the new agent to invite THEIR
  onward/downward agents. Measure the knock-on (viral coefficient).

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
