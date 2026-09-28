# Enquiry chases — full chase-timeline parity

**Status:** BUILT on `staging` 2026-09-28 (unpushed). tsc clean; 51/51 enquiries tests
pass (12 new); service verified end-to-end against a real staging enquiries file
(nextDueAt + escalatesAt + overrideTarget all populate; thread counts in stats). Only
remaining check: a live browser screenshot (needs the running app + a logged-in session).
**Goal:** every enquiries-related chase (the "get enquiries raised" chase AND the
reply-loop chase to the solicitor holding the ball) behaves in the Chase timeline
**exactly like** a milestone/solicitor chase — scheduled next-send date, "NEXT EMAIL"
preview card, and edit/skip — starting when enquiries are raised and finishing when they
are confirmed satisfied. Agents shouldn't need to know there are separate engines
underneath; the timeline is the single pane of glass.

---

## Locked decisions (founder, 2026-09-28)
- **Count/next-send display:** "Next chase {date}" + "escalates to you if no reply by
  {date}". Honest about the repeat-until-escalation model (no fake "chase 1 of 2" cap).
- **Scope:** display parity AND edit/skip, built together (not display-first).

---

## Current state (evidence)

**The reply-loop chase is LIVE in production.** Global master switch ON, Akeman ON,
this file not paused (14 of 15 agencies enabled). Cadence (working days,
lib/enquiries/cadence.ts:12-14): **first chase 6, repeat every 5, escalate 13**. Emails
the solicitor holding the ball (`EnquiryTracker.currentlyWith`, default seller's
solicitor at raise). Writes `ChaseSend(kind=reply_loop)`, bumps
`EnquiryTracker.lastChasedAt`/`chaseCount`; escalation sets `escalatedAt` and bells the
file owner. Cron: app/api/cron/enquiries-chase (weekdays 09:00 UTC).

**The timeline already renders both enquiry threads** ("Getting enquiries raised",
"Outstanding enquiries") — lib/services/chase-timeline.ts:594-653 — with open / chased /
escalated / resolved events.

**The gap (exact):** both enquiry threads are built with these hardcoded lines
(chase-timeline.ts:615, 619, 618 and 647, 651, 650):
```
nextDueAt: null,
nextSends: [],
overrideTarget: null, overrideEdited: false, overrideSkipped: false,
```
So versus a milestone/solicitor thread they are missing:
1. the **scheduled next-chase date** (`nextDueAt`) — though it's already computable;
2. the **"NEXT EMAIL" preview card** (`nextSends[]` drives it);
3. **edit/skip** (`overrideTarget`).

**Pieces that already exist and get reused (this is mostly wiring):**
- Next-chase date: `getEnquiryTrackerView` → `nextChaseAt` (lib/enquiries/tracker.ts:72-77)
  uses the same cadence constants; the raise-chase has an equivalent.
- Email composer: `buildEnquiryChaseEmail` (lib/enquiries/chase-email.ts) already composes
  the reply-loop email the cron sends; the raise-chase has its own composer.
- Retrospective sent-email view: `getEnquiryChaseEmailAction` (app/actions/enquiries.ts).
- Milestone preview precedent: `previewChaseEmailAction` (app/actions/chase-timeline.ts:99).
- Milestone override precedent: `ChaseEmailOverride` + `ChaseOverrideTarget`
  (lib/services/chase-overrides.ts:20-27) — client/solicitor targets only today.

---

## Build breakdown (one concern per PR — Law 5 — but all four ship as the feature)

### PR1 — Scheduled next-send in the timeline (read-only)
chase-timeline.ts: for the reply-loop thread, set `nextDueAt` = the computed next-chase
date and push ONE `NextSend` (lane `solicitor`, recipientLabel = solicitor holding the
ball, `dueAt`, `isAutomated`, `handedToTeam` when escalated). Add an escalation-deadline
detail string ("escalates to you if no reply by {anchor + 13 wd}"). Do the same for the
raise-chase thread (recipient = buyer or buyer's solicitor per next target). No writes.
Reuse the cadence via a shared `nextEnquiryChaseAt(tracker)` helper extracted from
tracker.ts so timeline and panel agree to the day.

> **Build note (2026-09-28): PR2 and PR3 merge.** The "NEXT EMAIL" preview and the
> edit/skip controls are the SAME component (`NextChaseControl`), which only renders
> when a thread carries an `overrideTarget`. So the preview cannot appear without the
> override plumbing — PR2 and PR3 are built together as one change. PR1 shipped
> separately and is tsc-clean.

### PR2 — "NEXT EMAIL" preview parity
Extend the timeline preview action to compose the **upcoming** enquiry email:
reply-loop via `buildEnquiryChaseEmail` for the current tracker state; raise-chase via its
composer. Return subject + html so the timeline's existing NEXT EMAIL card renders it,
identical to milestone chases. Applies any staged override from PR3 when present.

### PR3 — Edit/skip parity (touches the LIVE cron — handle with care)
- Extend `ChaseEmailOverride`: add enquiry target keys `enquiry:raise` and
  `enquiry:reply` (reuse the table; `milestoneCode` carries a synthetic scope marker).
- `ChaseOverrideTarget` union gains `{ kind: "enquiry"; scope: "raise" | "reply" }`.
- The enquiry cron (lib/enquiries/chase.ts) reads the override before composing: apply
  subject/body override; on `skipNext`, advance the clock (skip-semantics A — set
  lastChasedAt forward WITHOUT sending or incrementing chaseCount) so cadence resumes one
  interval later. Mirror the milestone skip exactly.
- chase-timeline.ts enquiry threads: set `overrideTarget` to the new enquiry kind and
  surface `overrideEdited`/`overrideSkipped`.
- UI: wire the existing edit/skip controls to the enquiry override target (the timeline
  component already renders these generically off `overrideTarget`/`nextSends`).

### PR4 — Polish + tests
- Fix stale cadence docstrings in lib/enquiries/chase.ts (say "7 wd"/"9-day"/"3 weeks";
  real numbers are 6/5/13).
- Confirm stat cards (active/dueToday/escalating) count enquiry threads consistently.
- Tests: next-send date math; escalation-deadline; preview composes; override
  edit/skip round-trips through the cron without breaking a normal send.

---

## Risks / guardrails
- **The enquiry cron sends real solicitor emails in prod.** PR3 must not change send
  behaviour except when an override exists. Land PR3 behind the existing per-file/agency
  flags; test the skip clock-advance carefully so a skip never silently drops a chase
  permanently or double-sends.
- **Two engines, one display.** Keep the next-send math in ONE shared helper so the
  timeline card and the file panel can never disagree.
- **Law 17 baseline:** capture the current chase-timeline render (desktop 1280 + mobile
  375) for a file at the reply-loop stage before PR1; re-capture after each PR.

## Out of scope
- Changing the enquiry cadence (6/5/13) or who gets chased.
- The enquiries STEP unlock-gating question (whether PM14 should also gate on
  money-on-account) — separate, cosmetic, tracked elsewhere.
- The milestone unlock self-heal bug — separate plan
  (docs/active/milestone-unlock-selfheal/00-plan.md).

## DoD
- `npx tsc --noEmit` clean; tests green; screenshots for the timeline card (both enquiry
  threads) desktop + mobile; voice-pass any new strings (VOICE.md); no em-dashes.
