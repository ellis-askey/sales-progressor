# Client → Solicitor Follow-up Sender — SPEC

**Status:** agreed in principle 2026-08-18, pending copy-deck approval before build. Staging first, then prod.
**Portal ledger:** see `docs/active/portal-feature-ledger.md`.

An evolution of the shipped "Email your conveyancer" button (2026-08-17). Adds: a state that knows whether the ball is with the client's own solicitor, a proactive nudge timed just before our internal chase, and a pre-filled follow-up email in the client's own voice. Not two-way in-portal messaging (declined) — it hands off to the client's own mail app.

---

## 1. What it is

On the buyer/seller portal "Your team" card, the existing "Email your conveyancer" button gains a **status label** and, at the right moments, becomes a **Follow up** that opens the client's mail app with a ready-written, situation-appropriate email to their own conveyancer, agency CC'd.

The client stays in full control: it opens in their mail app, they read it, they hit send (or edit first, or bottle it). We never send on their behalf.

## 2. Who / where

- Both sides (buyer portal and seller portal), per-contact token, so drafts sign with that contact's name and target that side's own solicitor.
- Lives on the "Your team" card next to the conveyancer's Email button. Also surfaced as a gentle prompt on the Overview at the moment a step is nudge-able (distinct from "Your next step", which is the client's own to-do). [PLACEMENT — confirm]
- Only shows when the conveyancer's email is on file (existing guard).

## 3. The states the client sees

The label next to the button reflects whose court the ball is in for the current live step on their side:

| State | When | Button |
|---|---|---|
| **With your solicitor** (calm) | A live step is one their own solicitor holds, and it's early | "Email your conveyancer", first-touch draft |
| **Worth a check-in** (warm) | 2 working days before that step's reminder fires | "Follow up", nudged |
| **Running behind** (firm, not shouty) | The step is genuinely overdue / we're internally chasing with no movement | "Follow up", firmer template |
| **Waiting on the other side** (calm) | Ball is with the other party's solicitor | Button present, no nudge |
| *(nothing extra)* | It's the client's own job (→ "Your next step"), or we're waiting on their lender/us | Plain button |

## 4. When it appears — the step list

Steps where the client's **own solicitor** holds the work (from the milestone glossary "who is responsible"):

**Seller (emails their conveyancer)**
- Welcome pack (VM3)
- Property information / protocol forms (VM5)
- Draft contract pack going to the buyer's side (VM7)
- Management pack requested *(leasehold, VM8)*
- Management pack back *(leasehold, VM9)*
- Contract documents for signing (VM16)
- Ready to exchange (VM18)
- Enquiries: whenever the ball is on the seller's solicitor (tracker)

**Buyer (emails their conveyancer)**
- Draft contract pack received (PM7)
- Searches ordered (PM8)
- Management pack received *(leasehold, PM12)*
- Search results back (PM13)
- Final report / report on title (PM21)
- Contract documents for signing (PM22)
- Ready to exchange (PM25)
- Enquiries: whenever the ball is on the buyer's solicitor (tracker) — covers raising, reviewing replies / raising further, and confirming satisfied

**Deliberately excluded** (the client's own job → "Your next step"): instruct solicitor, MOS, ID/AML, money on account, mortgage application, valuation, survey + report, returning protocol forms, providing enquiry replies, signing contracts, deposit, exchange/completion confirmations. **Also excluded:** mortgage offer received (PM11 — that's lender/broker, not the solicitor).

## 5. Timing (three levels)

A single lead-time knob, default **2 working days** before that step's reminder rule fires (its grace period; see `prisma/seed.ts` reminder rules). Every step has a grace/repeat/escalate rule, so this is uniform; tunable per-step later if one needs it.

- **Calm** ("with your solicitor") — from when the step becomes their solicitor's move.
- **Worth a check-in** (warm) — 2 working days before the reminder fires. Where grace < 2, this shows immediately.
- **Running behind** (firm) — once the step is genuinely overdue (reminder has fired / internal chase running with no movement). Firmer template, still polite.

Enquiries key off the tracker's 9-working-day cadence instead of a reminder rule (calm → check-in as the cadence approaches → running-behind once escalated/stalled).

## 6. The compose experience

1. Client taps the button (or the "Follow up" label).
2. A sheet slides up with a **ready-written draft** tailored to the current step (names the property + the thing).
3. They can **edit it**, or type their own in a **plain text box** (no AI), then continue.
4. They tap **Open in email**.
5. Their phone's default mail app opens, everything pre-filled: **To** = their conveyancer, **CC** = agency address (fallback `ellis@thesalesprogressor.co.uk`), subject + body done.
6. They read, hit send (or edit first). We never send it for them.

## 7. Send mechanic (mailto) — honest limits

- Hands to the phone's **default** mail app; we can't show an app picker, the OS decides.
- **Plain text only**, body kept under ~1,500 chars.
- We **cannot confirm** they hit send, and cannot force the CC to stay.
- Editing subject/body does **not** break the inbox filing (it matches on people, not words), but stripping the CC would make it invisible to us.
- This is by design: their email, their control, lower liability.

## 8. Copy system (templates, no live AI)

- Per step: a **subject** + the **thing** it's about + body shapes on two axes:
  - **Urgency** (from the state ladder): calm check-in / firmer "running behind" (still polite).
  - **Repeat:** **first touch** ("just checking in") vs **following up again** — references the **real date of their last SENT email** to that solicitor (from the filed copy), so it reads like a genuine chase.
- 2–3 wordings per shape (light rotation) so repeats are never identical.
- **Which shape** is chosen by whether a **filed copy exists** (proof of an actual send), NOT by the button tap. So: no filed email (never sent, or opened-and-bottled, or CC stripped) → first-touch again, never a false "your email from the 12th". Fails safe in every case.
- Enquiries need 2–3 sub-templates (raise / chase replies / confirm satisfied).
- All copy voice-gated (no em-dashes, no exclamations, plain English, client first-person).
- **Full copy deck to be written and founder-approved before any build.**

## 9. How "with your solicitor" is known (the one real build)

- A per-step **responsibility map** (milestone code → who we're waiting on: their solicitor / other side / client / lender / agent), seeded from the glossary. Static code map, no schema change.
- A **resolver**: given file + side, returns the current nudge state {state, stepCode, thing, subject, lastSentDate} by reading the open milestones + the enquiry tracker (for the enquiry stretch) + the reminder schedule (for timing) + the last filed client→solicitor email (for the date).
- During enquiries it reads the tracker's whose-court (`currentlyWith`), so the client's label and the internal chip never disagree.

## 10. Recording — reuses the inbox sync, nothing new

Because the agency is CC'd, the client's sent email lands in the agency inbox and the existing Outlook sync files it to the file (matches on from/to/cc vs the file's contacts + solicitors; `lib/integrations/outlook/sync.ts`). Internal only, not shown to the client. Same treatment as any solicitor correspondence. No separate recording build.

## 11. Command Centre usage view

- Log a lightweight **tap event** when they tap Open-in-email (file, contact, step, time) → new small table + a portal API route.
- CC board shows, per feature/step: **Opened** (taps), **Sent** (filed client→solicitor emails), **Gap** (opened, no email received = started but didn't send / or CC stripped). Attribution is inferential (timing), not cryptographic.
- Sits alongside the App-adoption page.

## 12. Guardrails

- Fixed, pre-approved copy = the guardrail. Never states a legal position, invents a date/figure, or makes a promise; gentle "checking in / any update / rough timeline".
- Daily cap per client per step (can't be hammered).
- A **global on/off** feature flag, and optional **per-file suppression**, so a solicitor/file that objects to client chasing can be muted. [confirm]

## 13. Edge cases

- **No solicitor email on file:** show an "Add your conveyancer to email them here" prompt that opens the **solicitor section of the portal menu drawer in edit state** (reuses the existing "Update your conveyancer" flow already on the team card). Button appears once an email is added.
- **Ball with the other side / lender / client:** no nudge (calm or nothing).
- **Leasehold-only steps:** naturally hidden on freehold (auto-not-required).
- **Relist / new buyer round:** resolver reads the active round; tracker is round-aware.
- **Withdrawn / on-hold / completed:** no live steps → no nudge.
- **Desktop with no mail client:** mailto does nothing; most portal users are mobile. Minor.
- **Multiple buyers/sellers:** each has their own token; drafts sign with that contact.
- **CC stripped / heavy edit:** fails safe (treated as not-sent for the date logic).

## 14. Build inventory

**New:**
- Step responsibility map (`lib/portal/step-responsibility.ts` or similar).
- Nudge-state resolver.
- Copy deck (templates) + the approval doc.
- Portal UI: the pill + compose sheet (evolves the team-card email button).
- Tap-event table + migration (staging first) + portal API route.
- Command Centre usage view.
- Global on/off flag (+ optional per-file suppression).

**Reused:** mailto button, Outlook inbox sync (recording), enquiry tracker (whose-court), reminder rules (timing), agency sender resolution (CC address), portal glass/UI primitives.

## 15. Rollout

1. Write + approve the copy deck (gate).
2. Build behind the global flag, staging first.
3. Founder tests on real staging files.
4. Prod. Move the ledger row to Shipped.

## 16. Decisions (locked 2026-08-18)

- **States:** four (calm / worth-a-check-in / running-behind / waiting-on-other-side). Lead time = 2 working days before the reminder.
- **Placement:** team-card button + an Overview prompt that is a second doorway to the *same* compose sheet (a "Follow up" pill/line in context). [confirm wording, not mechanism]
- **No solicitor email:** prompt → opens the solicitor menu-drawer section in edit state.
- **Solicitor relationship:** self-regulating (a solicitor who updates resets the clock and calms the pill); global off-switch kept as a cheap safety valve, not a primary concern.
- **Copy deck:** founder-approved before any build (gate).

## 17. Phase 2 (deferred — set up properly after the core build)

**Proactive notifications:** push/email to the client when a step becomes nudge-able (e.g. "your searches have been with your solicitor a while — want to check in?"), rather than passive in-portal only. Deliberately deferred so it's built as its own piece; the core feature ships passive first.
