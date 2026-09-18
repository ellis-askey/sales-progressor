# Keep the other side posted — spec

**Status:** Plan approved 2026-09-18. Not started.
**Owner:** Ellis. Drafted with Claude Code.
**Approved artifact (banner polish + wording A):** https://claude.ai/code/artifact/56b453ab-47fa-4909-9b70-3d9ece0b4cc4

---

## 1. The idea, in one line

When you finish a chase, we offer you ready-written updates for the people who are now out of the loop — your own client if they weren't copied in, and the side that's waiting — each one written from the chase you actually just sent, and delivered the way each person can receive it.

Chasing itself does not change. This is a quiet, opt-in step that appears **after** a chase.

---

## 2. The journey

### The progressor
1. Chase as normal: open the chase drawer, generate, send. Unchanged.
2. On send, the drawer settles into a **"Sent ✓"** state (it no longer just closes). That state holds up to two little pre-written offers (see §4). Ignore them and tap Done — finished, nothing sent, never nags.
3. Tap an offer and the ready-written update is already there, editable. A line states how it will reach that client ("Priya has notifications on, she'll get this on her phone" / "We'll email this to Priya"). Send.

### The client
4. The update lands in their portal **Updates feed** (always — the record), plus **one alert**: a phone notification if they can receive one, otherwise an email. Never both.
5. A not-yet-installed client, right after reading a fresh update, sees the **install banner** (wording A). One tap and they're on notifications next time.

---

## 3. Generation timing + accuracy (load-bearing)

- **Written at send, from the FINAL sent message.** Not alongside the initial chase draft. This is what makes edits count: if the agent adds "…and can you confirm the boiler service certificate is included?" to the chase, the follow-up reflects it. Kick off generation the instant Send is pressed so drafts are ready by the time the "Sent ✓" state renders.
- **Reuses the drawer's existing per-step context.** The follow-up must run through the same deterministic step/action-holder machinery the chase email already uses (`lib/chase/derive-chase-ask.ts` + `lib/chase/milestone-glossary.ts`), so it never mis-states who does what. Example of the trap: the **seller** completes and returns the property information forms, **not** their solicitor — the follow-up copy must respect that.

**Correct example.** You chase the seller's solicitor about "return property forms" and don't copy the seller. Buyer = Priya, seller = Sam.
- To Priya (other side): *"We're pushing the seller's side to get their property information forms completed and back with their solicitor, so the contract pack can come across to yours. We'll let you know the moment it's moving."*
- To Sam (own side, not copied): *"Just so you're in the loop, we've chased your solicitor to get your property information forms finalised so your sale keeps moving. We'll let you know as soon as that's done."*

---

## 4. The two possible follow-ups

After a chase we ask "who's now in the dark that shouldn't be?" There can be two gaps:

### Update A — the same-side client (if left out)
Shown **only when both** are true:
- the person chased was **not** that client (i.e. you chased their solicitor/broker, not them), **and**
- the same-side client was **not** CC'd on the send.

If you chased the client directly, or copied them in, they already know — the offer does not appear. Not shown if there's no same-side client on file. Framing: informational, "here's what we did for you."

### Update B — the opposite-side client (the other side)
The opposite side is never on the original chase (the chase CC is same-side only), so this is offered whenever an opposite-side client exists on the file. Framing: reassurance.

**Opposite side = opposite the RECIPIENT's side.** Chase anything seller-side (their solicitor, or the seller) → update the buyer. Chase anything buyer-side (broker, buyer's solicitor, the buyer) → update the seller.

Each offer is independent: send, edit, or ignore either/both.

---

## 5. What the update is allowed to say

- Names the step honestly ("the property forms", "the searches").
- Frames us as working on the client's behalf.
- **Never** airs the other side's business, delays, internal sentiment, solicitor names it shouldn't, prices, or anything outside the fact of the chase. (Same confidentiality posture as the existing draft-update route, tuned to allow "we're chasing the other side for X", which is appropriate and reassuring.)
- Voice per `docs/reference/VOICE.md` (Law 21): no em dashes, no exclamation marks, no "the system/automatically" (use "we"), no titles, "remove" not "delete".

---

## 6. Delivery — feed always, one alert

For each recipient client of an update:
- **Always** post to their portal Updates feed (the permanent record).
- **Plus exactly one alert:**
  - **Phone notification** if they have a live push subscription right now (`PortalPushSubscription` exists for them). "Working notifications right now", not merely "installed once" — installed-but-declined counts as no push.
  - **Otherwise email.**
  - Never both.

Today `lib/services/portal-messages.ts` (`sendProgressorPortalReply`) can push AND email (email as a toggle). This must be tightened to pick one.

---

## 7. The install banner (client side)

- Reuses the existing `components/portal/PortalOnboardingToasts.tsx` `PromptCard`.
- **New trigger:** right after a not-yet-installed client has read a fresh update (the moment they most feel the value). At most a few asks ever; one "Not now" moves it to the next sensible moment.
- **Wording A (approved):** heading "Want a heads-up the moment there's news?"; body "Add [address] to your home screen and we'll message you when something moves, like these forms coming back. No checking in, no missed updates."; primary "Keep me posted"; secondary "Not now".
- On tap: install (iOS add-to-home-screen sheet / Android native prompt), then push-subscribe → on notifications for next time.

---

## 8. Edge cases

- **Chase all (in scope).** One message to one person covering several steps. The follow-up mirrors it: **one note per gap, summarising all the bundled steps.** Waiting side is still opposite the chased recipient.
- **Installed but notifications declined** → treated as not-installed for delivery → email. (Confirmed.)
- **Chains where the agency runs both sides.** Rule still holds (update the opposite-side client, a different person). Nothing cleverer about chains in this build.

---

## 9. Build order (each one concern, staging first per Laws 3 + 5)

1. **Delivery rule** — DONE (local, awaiting sign-off). "Feed always, one alert (push if live subscription, else email)". `pushToContact` now returns `{ delivered }`; `sendProgressorPortalReply` picks one alert with email fallback; the "Also email" toggle removed.
2. **After-chase step** — split into 2a (flow) and 2b (voice-learning).
   - **2a — DONE (local, awaiting sign-off).** New route `app/api/ai/chase-followup/route.ts` resolves who is out of the loop (same-side client if not the recipient and not CC'd; opposite-side client always) from the file's real contacts, and drafts a per-side update grounded in the sent chase (situational anchoring allowed here since it IS tied to the step; names resolved; who-does-what accuracy). New component `components/chase/ChaseSentOffers.tsx` renders the "Sent ✓" state with up to two collapse-on-send offers, delivered via step 1 (`sendDraftClientUpdateAction`). `ChaseDrawer` now enters this state on send instead of closing; `onSent` fires only when the user finishes. Chase-all covered (one note per gap, summarising all steps).
   - **2b — DONE (staging applied, awaiting sign-off).** Voice-learning (§11): SEPARATE update-voice profile in `lib/chase/update-voice-profile.ts` (mirrors the chase one, reuses its `redactPairs`, own client-update distil prompt, dedupes per-recipient duplicates). Capture seam: `PortalMessage.generatedText` stores the draft; `sendProgressorPortalReply` + `sendDraftClientUpdateAction` take it; `DraftForEveryonePanel` + `ChaseSentOffers` pass it. Injected + refreshed (`after()`) in `draft-update` + `chase-followup`. Migration `20260918170000_add_update_voice_learning` (idempotent `ADD COLUMN IF NOT EXISTS`: `User.updateVoiceProfile/BuiltAt/Samples`, `PortalMessage.generatedText`) applied to STAGING via the pooler (direct connection is IPv6-unreachable locally; `migrate deploy` on Vercel will re-run it as a no-op and record it for PROD). Prisma engine regen needs a dev-server restart (Windows file lock).
3. **Per-side "Draft for everyone"** — DONE (local, awaiting sign-off). `DraftForEveryonePanel` now renders three boxes (Seller update / Buyer update / File note), no greeting, checkbox recipient chips (pills removed), Skip per box, fade-and-collapse on send/save that closes the panel when the last goes. `/api/ai/draft-update` returns `{ internalNote, sellerMessage, buyerMessage }` (only sides present). **Content enrichment = names-only** (see §11).
4. **Install banner** — DONE (awaiting sign-off). Retimed the portal's existing `PortalOnboardingToasts` rather than adding a component: new install variant `A_UPD` fires when there's a fresh update this visit (`hasFreshUpdate = unreadCount > 0`, passed from `PortalShell`), with wording A ("Want a heads-up the moment there's news?" / "Keep me posted", bell icon). Slots into the existing cadence (max 3 asks, gaps, once-per-session) and chains install → push as before. Mobile-only (`lg:hidden`), not on `/respond`.

---

## 10. Existing plumbing to build on

- Chase drawer: `components/chase/ChaseDrawer.tsx` (knows recipient, side, CC state, milestone(s), chase count).
- Chase draft context: `app/api/ai/generate-chase/route.ts`, `lib/chase/derive-chase-ask.ts`, `lib/chase/action-holders.ts`, `lib/chase/milestone-glossary.ts`.
- Sides / recipients: `lib/services/chase-recipients.ts` (vendor/purchaser; solicitors are side-tagged FKs, not Contacts).
- Auto passive "other side" note that already exists: `postChaseEcho` in `lib/services/chase-echo.ts` (this feature is the deliberate, editable, alerted version).
- Draft-for-everyone: `components/activity/DraftForEveryonePanel.tsx`, `app/actions/draft-update.ts`, `app/api/ai/draft-update/route.ts`.
- Delivery: `lib/services/portal-messages.ts` (`sendProgressorPortalReply`), `lib/services/push.ts` (`pushToContact`).
- Client state: `Contact.portalToken`, `Contact.pwaInstalledAt`, `PortalPushSubscription` model.
- Portal chrome + tokens: `components/portal/PortalShell.tsx`, `components/portal/portal-ui.tsx` (coral `#FF6B4A`), `components/portal/PortalOnboardingToasts.tsx`.

---

## 11. Content quality — enrichment + voice learning (decided 2026-09-18)

**Names-only enrichment (activity-tab "Draft for everyone"):** the typed fact stays the ONLY source of what happened. The model may resolve a generic reference in the fact to a real name we hold (seller/buyer solicitor firm, broker, surveyor) and use tenure/purchase type for natural phrasing. It must NOT introduce a subject, step, date or party the fact did not state. **No stage/milestone is fed in here on purpose** — from the activity tab an update can be about anything, and handing over the current step is the wire that would let it force-fit the message onto a milestone (Ellis's concern). **Situational/step anchoring belongs at the chase drawer (step 2)**, where the update genuinely is tied to a milestone.

**Exchange date: out everywhere for now.** Not precise enough to draw more client attention to it.

**Exchange LANGUAGE gate (added after testing).** Copy must not mention exchange / completion / "moving toward exchange" until the file reaches the enquiries-satisfied stage or later. Enforced deterministically via `lib/chase/exchange-stage.ts` (`EXCHANGE_STAGE_CODES` = VM15-VM20, PM20-PM27; `exchangeTalkAllowed(codes)`), applied to `generate-chase`, `chase-followup`, and (soft, fact-only) `draft-update`.

**We are the estate agent, not the solicitor (added after testing).** Prompts for `chase-followup` + `draft-update` now forbid saying a document/form "comes back to us" or "lands with us" — the paperwork passes between the solicitors; we chase and coordinate, we do not receive it.

**Hold-backs (never into a client message):** purchase price, buyer financials (deposit/mortgage/SDLT), the other side's internal status/delays. Factual "we're chasing them" is fine.

**Voice learning (build in step 2, register-separate):** mirror the existing chase system (`lib/chase/voice-profile.ts`: reads a user's (draft → sent) pairs off `OutboundMessage`, redacts PII, distils style bullets via Haiku, stores on `User.chaseVoiceProfile`, injects into future drafts; silent, learns only from real edits). For client updates we add the same loop but with a SEPARATE profile so the client-update voice, the chase voice, and the blunt internal-note voice never cross-contaminate. Needs a "capture the (draft → sent) edit" seam on the update-send path — which step 2 builds and both the activity panel and the after-chase updates then share. No announcement to clients.

## 12. Open items

- None blocking. All operating decisions confirmed with Ellis 2026-09-18.
- Next unseen surface before build: a faithful mock of the drawer's "Sent ✓" two-offer state (offered; awaiting Ellis's go).
