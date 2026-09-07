# Chase action derivation — design artifact

**Status:** SIGNED OFF (v2, 2026-09-07). Ready to implement.
**Date:** 2026-09-07 (v2 folds in Ellis + ChatGPT review)
**Author:** Claude (with Ellis)
**Problem:** the AI decides *what* we're chasing and can substitute a different
step (e.g. chasing the draft contract pack from the seller came out about property
information forms). Fix: the **application** derives the ask deterministically and
the AI only writes it up. See the observed bug in the scratchpad brief.

## What changed in v2 (from review)

- **Every chase has a real ask.** There is no "nothing needed from you" outcome.
  If we're chasing, something is needed: the recipient does it, their solicitor
  does it (so we ask them to check in with / nudge their solicitor), or for a
  solicitor recipient, have they done it / has the other side sent it. The old
  INFORM_ONLY shape is removed.
- **Receipt milestones are confirmer-led.** For any "has X arrived" step we ask the
  *receiving* party to confirm receipt first; the *sender* is the escalation if it
  hasn't arrived. (Refines the earlier issuer-led proposal.)
- **Notifications are not AI-chased at all.** Exchange has its own chasing; completion
  is a phone call, not an email. VM19/VM20/PM26/PM27 are excluded.
- **The enquiries-tracker milestone (VM21) is excluded.** A future enquiries page
  will generate enquiry-related emails under its own rules.
- **The app controls *what* and *who*; the AI controls *wording*.** The injected
  action is an instruction, never a script, so messages stay natural and non-repetitive.
- **Greeting:** morning / afternoon / evening (evening after 17:00), Europe/London.
- **Every generation logs its derivation** (milestone, recipient, action-holder,
  shape, permitted subject) so any future wrong-chase is instantly diagnosable.

---

## 1. The rule (one sentence)

The AI never chooses the milestone or the action. For every generation the app
computes five fields and injects them; the AI must treat `recipientAction` as
authoritative and may not infer, expand, or replace it.

### The five injected fields

| Field | Type | Meaning |
|---|---|---|
| `milestoneBeingChased` | string | The selected milestone's name, named per the glossary "How to refer to parties" for THIS recipient. Never changes to a neighbour. |
| `actionHolderRole` | enum | Who physically owns moving this milestone forward: `seller \| buyer \| seller_solicitor \| buyer_solicitor \| broker \| agent \| internal`. |
| `recipientRole` | enum | Who we're writing to: `seller \| buyer \| seller_solicitor \| buyer_solicitor \| broker`. |
| `recipientIsActionHolder` | boolean | `recipientRole` is the primary party who can move this milestone. |
| `recipientAction` | shape + text | The exact, app-decided ask for THIS recipient about THIS milestone (see §3). |

`recipientAction` is not free text per milestone — it is one of a small set of
**shapes** filled from a relationship matrix (§3). That is what makes this general
rather than 48 special cases.

---

## 2. Action-holder table (all 48 milestones)

Derived from the `Who is responsible` + `What "outstanding" means` rows in
`MILESTONE_GLOSSARY.md`. **Two facts that break naïve logic:**

- **Action-holder side ≠ milestone side.** VM10/VM13 (vendor-side codes) are owned
  by the **buyer's** solicitor; PM7/PM12/PM15/PM18 (buyer-side codes) depend on the
  **seller's** solicitor. Never derive the holder from the VM/PM prefix.
- **Receipt milestones split "who confirms" from "who sends."** These carry an
  `upstream` party + a cross-reference to the milestone on the other side. That
  drives the "if it hasn't arrived, chase the other side" tail.

Legend — **Type**: `client` = the client does it · `own-sol` = milestone-side
solicitor does it · `receipt` = milestone-side party confirms arrival, `upstream`
party sends it · `client/broker` · `agent` · `notify` = post-event notification ·
`tracker` = managed off the enquiries tracker.

| Code | Milestone | Action-holder | Type | Upstream / cross-ref | Notes / decisions |
|---|---|---|---|---|---|
| VM1 | Seller has instructed their solicitor | seller | client | — | |
| VM2 | Seller has received the MOS | seller (confirm) | receipt | agent (we issue) | We are the upstream. Ask seller to confirm receipt. |
| VM3 | Seller received welcome pack from solicitor | seller (confirm) | receipt | seller_solicitor sends | Confirmer-led: ask seller to confirm receipt; escalate to their solicitor. |
| VM4 | Seller completed ID & AML | seller | client | — | |
| VM5 | Seller received property info forms from solicitor | seller_solicitor | own-sol | — | Sol issues the forms. |
| VM6 | Seller returned completed forms to solicitor | seller | client | — | This is "the forms" step. Only chase forms when THIS is selected. |
| VM7 | Seller's solicitor issued the draft contract pack | seller_solicitor | own-sol | ↔ PM7 | The bug case. |
| VM8 | Seller's solicitor requested management pack | seller_solicitor | own-sol | — | Leasehold only. |
| VM9 | Seller's solicitor received management pack | seller_solicitor | own-sol | ↔ PM12 | Leasehold only. |
| VM10 | Seller's solicitor received initial enquiries | seller_solicitor (confirm) | receipt | buyer_sol raises ↔ PM14 | Confirmer-led; escalation is the buyer's solicitor (cross-side). |
| VM11 | Seller provided initial replies to solicitor | seller | client | — | |
| VM12 | Seller's solicitor issued initial responses | seller_solicitor | own-sol | ↔ PM15 | |
| VM13 | Seller's solicitor received additional enquiries | seller_solicitor (confirm) | receipt | buyer_sol raises ↔ PM17 | Confirmer-led; escalation is the buyer's solicitor (cross-side). |
| VM14 | Seller provided additional replies to solicitor | seller | client | — | |
| VM15 | Seller's solicitor issued additional responses | seller_solicitor | own-sol | ↔ PM18 | |
| VM16 | Seller's solicitor issued contract docs to seller | seller_solicitor | own-sol | — | |
| VM17 | Seller's solicitor received signed contracts back | seller | client | — | Seller signs & returns. |
| VM18 | Seller's solicitor confirmed readiness to exchange | seller_solicitor | own-sol | — | Exchange gate. |
| VM19 | Seller received exchange confirmation | — | **excluded** | — | Exchange has its own chasing. Not AI-chased. |
| VM20 | Seller received completion confirmation | — | **excluded** | — | Completion is a phone call, not an email. Not AI-chased. |
| VM21 | All enquiries satisfied (seller side) | — | **excluded** | via PM20 | Managed off the enquiries tracker. A future enquiries page owns this. |
| PM1 | Buyer has instructed their solicitor | buyer | client | — | |
| PM2 | Buyer has received the MOS | buyer (confirm) | receipt | agent (we issue) | |
| PM3 | Buyer completed ID & AML | buyer | client | — | |
| PM4 | Buyer paid money on account | buyer | client | — | |
| PM5 | Buyer submitted mortgage application | buyer | client/broker | broker | Usually via broker. |
| PM6 | Lender valuation booked | buyer | client/broker | broker/lender | Lender arranges; chase buyer/broker. |
| PM7 | Buyer's solicitor received the draft contract pack | buyer_solicitor (confirm) | receipt | **seller_solicitor** sends ↔ VM7 | The buyer-side mirror. |
| PM8 | Buyer's solicitor ordered searches | buyer_solicitor | own-sol | — | |
| PM9 | Buyer booked a survey | buyer | client | — | Can be not-required. |
| PM10 | Buyer received the survey report | buyer | client | surveyor | |
| PM11 | Buyer's solicitor received mortgage offer | buyer | client/broker | buyer_sol receives; buyer/broker chase | Ask buyer/broker to chase. |
| PM12 | Buyer's solicitor received management pack | buyer_solicitor (confirm) | receipt | **seller_solicitor** sends ↔ VM9 | Leasehold only. |
| PM13 | Buyer's solicitor received search results | buyer_solicitor | own-sol | search providers | |
| PM14 | Buyer's solicitor raised initial enquiries | buyer_solicitor | own-sol | ↔ VM10 | |
| PM15 | Buyer's solicitor received initial replies | buyer_solicitor (confirm) | receipt | **seller_solicitor** sends ↔ VM12 | |
| PM16 | Buyer's solicitor reviewed initial replies | buyer_solicitor | own-sol | — | |
| PM17 | Buyer's solicitor raised additional enquiries | buyer_solicitor | own-sol | ↔ VM13 | |
| PM18 | Buyer's solicitor received additional replies | buyer_solicitor (confirm) | receipt | **seller_solicitor** sends ↔ VM15 | |
| PM19 | Buyer's solicitor reviewed additional replies | buyer_solicitor | own-sol | — | |
| PM20 | Buyer's solicitor confirmed enquiries satisfied | buyer_solicitor | own-sol | — | |
| PM21 | Buyer received final report from solicitor | buyer (confirm) | receipt | buyer_solicitor sends | Confirmer-led: ask buyer to confirm receipt; escalate to their solicitor. |
| PM22 | Buyer's solicitor issued contract docs to buyer | buyer_solicitor | own-sol | — | |
| PM23 | Buyer's solicitor received signed contracts back | buyer | client | — | Buyer signs & returns. |
| PM24 | Buyer transferred the deposit | buyer | client | — | |
| PM25 | Buyer's solicitor confirmed readiness to exchange | buyer_solicitor | own-sol | — | Exchange gate. |
| PM26 | Buyer received exchange confirmation | — | **excluded** | — | Exchange has its own chasing. Not AI-chased. |
| PM27 | Buyer received completion confirmation | — | **excluded** | — | Completion is a phone call, not an email. Not AI-chased. |

---

## 3. The recipient × action-holder matrix (produces `recipientAction`)

Inputs: `recipientRole` (+side), `actionHolderRole` (+side), `upstream`/cross-ref.
"Own-side" = recipient's side equals the party's side. **Every chaseable case
produces a real ask** (there is no "no action" outcome — if we're chasing, something
is needed). The app fills the `{braced}` slots and controls *what* and *who*; the AI
controls *wording* and must phrase it naturally, never as a fixed template.

| # | When | Shape | What the app tells the AI to ask (wording is the AI's) |
|---|---|---|---|
| 1 | recipient **is** the party who does/confirms it (`recipientIsActionHolder`) | **ASK_DIRECT** | Ask {recipient} directly to do or confirm {milestone}. If it's a "has it arrived" step and it hasn't, ask them to chase {upstream party} for it. |
| 2 | recipient is a **client**, and the party who does/confirms it is that client's **own-side solicitor** | **VIA_OWN_SOLICITOR** | Ask {recipient} whether their solicitor has confirmed {milestone} is done / has arrived. If not, suggest they give their solicitor a nudge, and offer that we're happy to chase the solicitor for them. Never ask the client to do the legal step themselves. For a "has it arrived" step, add: if their solicitor hasn't had it, it's worth their solicitor contacting {other-side solicitor}. |
| 3 | mortgage steps — holder is **buyer / broker / lender** (PM5, PM6, PM11) | **VIA_BROKER** | Ask {recipient} (buyer, or their broker) to progress or confirm {milestone}; offer to liaise with the broker directly if useful. |
| — | `excluded` milestone (notifications VM19/20, PM26/27; tracker VM21) | **NOT_CHASED** | AI generation is not offered for these. |

Notes:
- **Solicitor recipients** always land in Shape 1: either they own the action ("have
  you issued/ordered/raised X?") or, for a receipt they confirm, "has X reached you,
  and if not, chase {the other side} for it." No separate shape needed.
- **A client recipient on a step their own side has no part in** (e.g. a purely
  buyer-side legal step, were it ever addressed to the seller) has no sensible ask.
  The recipient list is scoped to the relevant side so this isn't offered; if it ever
  arises, we flag it rather than invent a task. This should effectively never fire.

The anti-bug guarantees stated to the model:
- The subject is **always** `milestoneBeingChased`. Never a prerequisite, neighbour
  or follow-on.
- The AI **must** use the supplied `recipientAction` as the ask. It may not infer,
  expand, or replace it, and may not substitute a different task to "make it
  actionable."

---

## 4. Dry-runs

The six requested combinations plus the ones that actually stress the rules.

Example wordings are illustrative only — the AI phrases each naturally, so no two
sends read the same.

### Requested six
1. **Solicitor-owned → seller** · VM7 → seller · holder = seller's solicitor (own-side) → **VIA_OWN_SOLICITOR**
   → "Has your solicitor let you know the draft contract pack has gone over to the buyer's side yet? If not, worth a quick nudge, or I'm happy to chase them for you." ✅ (no forms)
2. **Solicitor-owned → solicitor** · VM7 → seller's solicitor · is action-holder → **ASK_DIRECT**
   → "Just checking whether you've been able to issue the draft contract pack to the buyer's side yet." ✅
3. **Seller-owned → seller** · VM6 → seller · holder = seller → **ASK_DIRECT**
   → "Would you be able to finish the property information forms and get them back to your solicitor?" ✅ (forms ARE the milestone here — correct)
4. **Buyer-owned → buyer** · PM9 → buyer · holder = buyer → **ASK_DIRECT**
   → "Have you been able to get your survey booked in?" ✅
5. **Buyer-solicitor-owned → buyer** · PM8 (searches) → buyer · holder = buyer's solicitor (own-side) → **VIA_OWN_SOLICITOR**
   → "Has your solicitor confirmed they've ordered the searches? If not, worth a nudge, or I can chase them for you." ✅
6. **Buyer-solicitor-owned → buyer's solicitor** · PM8 → buyer's solicitor · is action-holder → **ASK_DIRECT**
   → "Have the searches been ordered yet?" ✅

### Stress cases (prove it generalises)
7. **Cross-side receipt, client recipient** · PM7 (buyer's sol received DCP) → buyer · confirmer = buyer's solicitor, upstream = seller's solicitor → **VIA_OWN_SOLICITOR + cross-side tail**
   → "Has your solicitor confirmed the draft contract pack has landed with them? If it hasn't turned up, it's worth them chasing the seller's solicitor for it, and I'm happy to help push from our end." ✅ (your exact buyer-side example)
8. **Cross-side receipt, client recipient** · VM10 (seller's sol received the buyer's enquiries) → seller · confirmer = seller's solicitor (own-side), upstream = buyer's solicitor → **VIA_OWN_SOLICITOR + cross-side tail**
   → "Has your solicitor had the buyer's initial enquiries come through yet? If not, worth them chasing the buyer's solicitor, and I can follow up too." ✅ (a real ask, not "nothing needed" — and never invents a seller task)
9. **Receipt, sender-side solicitor recipient** · VM7 → seller's solicitor (the sender) → **ASK_DIRECT** → "Have you been able to get the draft contract pack over to the buyer's solicitor?" ✅
10. **Broker route** · PM5 → buyer · holder = buyer/broker → **VIA_BROKER**
    → "Has your mortgage application gone in with your broker yet? Happy to liaise with them directly if that's easier." ✅
11. **Notification** · PM26 / VM19 → **NOT_CHASED** → AI generation not offered (exchange has its own chasing). ✅
12. **Tracker** · VM21 → **NOT_CHASED** → not offered (future enquiries page owns it). ✅

---

## 5. Tone (already partly in the prompt; keep + enforce)

- **Clients:** warm, plain English. One short "why it matters" clause where genuinely
  helpful. Must not read AI-written or over-explain the conveyancing process.
- **Solicitors / professionals:** concise, professional, no explaining what a DCP /
  searches / enquiries are. Just the action or update needed.

This is `recipientGuidance` today; it stays, driven by `recipientRole`.

---

## 6. Greetings (separate concern, small)

- Pass the current **Europe/London** date/time into generation and derive the
  greeting word in code. Extend `timeGreeting()` in `lib/emails/greeting.ts` to three
  bands: "Good morning" < 12:00, "Good afternoon" 12:00–16:59, **"Good evening" ≥ 17:00**.
- Inject the resolved greeting; the prompt uses it verbatim and must not compute
  time itself. WhatsApp's informal "Morning/Hi" opener follows the same signal.

---

## 7. Decisions (resolved 2026-09-07)

1. **Notification milestones (VM19/20, PM26/27):** ❌ not AI-chased. Exchange has its
   own chasing; completion is a phone call, not an email.
2. **VM21 (tracker):** ❌ excluded. A future enquiries page will generate
   enquiry-related emails under its own rules.
3. **Receipt milestones:** ✅ confirmer-led. Ask the receiving party to confirm
   receipt first; the sender is the escalation if it hasn't arrived.
4. **Greeting:** ✅ morning / afternoon / evening, evening after 17:00.
5. **No "nothing needed from you":** ✅ every chase carries a real ask — the recipient
   does it, their solicitor does it (so they check in / nudge), or (solicitors) have
   they done it / has the other side sent it. INFORM_ONLY removed.

---

## 8. Implementation plan (after sign-off)

1. **Data:** add a typed, hand-authored action-holder map beside
   `DIRECT_PREREQUISITES` in `lib/milestone-prerequisites.ts` (client-safe, no DB
   migration): `code → { actionHolderRole, actionHolderSide, type, upstreamRole?,
   crossRef? }`. Source of truth for derivation; the prose glossary stays for humans.
   *(Alternative: DB columns on `MilestoneDefinition` — heavier, needs a staging-first
   migration per Law 3. Proposed: start with the code map.)*
2. **Derivation:** a pure function `deriveChaseAsk({ milestoneCode, recipientRole,
   recipientSide, contacts, solicitors })` → the five fields + shape, using §2 + §3.
3. **Prompt:** recreate `docs/chase-generation/PROMPT_SPEC.md` (the route claims
   prompts are verbatim from it — **it does not currently exist**, Law 1). Add the
   "recipientAction is authoritative, do not infer or replace it, subject is always
   the named milestone, phrase it naturally not as a template" section. Inject the
   five fields; keep voice/tone/channel.
4. **Greeting:** extend `timeGreeting()` to three bands + inject it (separate small
   commit, Law 5).
5. **Multi-milestone / chase-all:** run derivation per milestone; each gets its own
   action line under the shared opener.
6. **Logging:** every generation logs its derivation (milestone code, recipient
   role+side, action-holder, shape, permitted subject) so any future wrong-chase is
   instantly diagnosable.
7. **Exhaustive tests:** unit-test the derivation for **every chaseable milestone ×
   every valid recipient relationship** (own-client / own-solicitor / other-solicitor
   / broker), not just the §4 examples — asserting the shape and that the subject is
   always the selected milestone. Excluded milestones assert NOT_CHASED.
8. **Live check:** re-run the §4 dry-runs against the live model on the seeded staging
   file before declaring done (Law 2).

### Law notes
- Law 1: `PROMPT_SPEC.md` recreated as source of truth before prompt edits.
- Law 5: greeting ships as its own commit, separate from the derivation.
- Law 3: no migration if we use the code map (preferred).
- Law 16: no bulk rewrite; the map is hand-authored and reviewed row by row.
