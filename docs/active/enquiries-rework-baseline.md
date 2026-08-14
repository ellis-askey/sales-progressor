# Enquiries Rework — Stage 1.0 Baseline

**Captured:** 2026-08-14 (Stage 1.0 of `enquiries-stage-rework-SPEC.md`)
**Purpose:** record how the enquiries stage behaves today, and what infrastructure already exists, before any code changes (Law 17). Anything that changes later is measured against this.

---

## 1. Current milestone flow

**Buyer side (7 steps, strict predecessor chain):**
PM14 raised → PM15 initial replies received → PM16 reviewed → PM17 additional raised → PM18 additional received → PM19 reviewed → PM20 all satisfied. PM20 (the exchange-gate milestone) requires PM19, which requires PM18 … back to PM14. To mark PM20 you must first mark every step before it.

**Seller side (6 steps):**
VM10 received → VM11 seller input → VM12 initial issued → VM13 additional received → VM14 additional input → VM15 additional issued. No seller "satisfied" milestone; the seller side just stops at VM15.

**Weights:** buyer cluster = 20.00% (PM14–PM20), seller cluster = 24.00% (VM10–VM15). See `MILESTONES_WEIGHTS_v1.md`.

## 2. Current emails

Every milestone above fires a completion email through the skeleton assembler (`lib/email-skeletons/`), with purchaser / vendor / progressor blocks. PM14/VM10, PM15/VM12, PM17/VM13, VM15/PM18 are **bilateral pairs** with `direction: default/inverse` variants and "tap the highlighted confirm button" hand-off nudges. PM16, PM19, VM11, VM14 are unilateral. PM18 has no skeleton file. PM20 is self-contained (no dependency on the intermediate steps in its copy).

## 3. **Existing chase + escalation engine (the key finding)**

There is already a full solicitor-chase system. It is **off by default** (master switch `SolicitorChaseSettings.enabledByDefault`, flipped from Settings → Automation). Files:

- `lib/solicitor-confirm/chase.ts` — the engine.
- `app/api/cron/solicitor-chase/route.ts` — weekday 09:00 cron.
- `lib/solicitor-confirm/codes.ts` — which milestone codes get chased, per side.
- `lib/emails/working-hours.ts` — `addWorkingDays()` + England & Wales bank-holiday calendar (populated through 2028).

What it already does, that our spec described as "to build":

| Spec item (Stage 1.4/1.5) | Already exists |
|---|---|
| Chase the right solicitor on a working-day cadence | Yes — per-code `SolicitorReminderRule` with `graceWorkingDays` + `repeatWorkingDays`, weekends + bank holidays excluded |
| Replyable, per-agency / EXP sender | Yes — `resolveSenderForTransaction` sets `from` + `replyTo` agency-branded, SP fallback |
| Snooze / "can't chase" states | Yes — per-side `…SolicitorEmailsPaused` flag, and `expectedDate` snooze ("solicitor said by the 20th") |
| Idempotent, no double-sends | Yes — `SolicitorChaseState` (chaseCount, lastChasedAt, status) |
| Escalate to a human after silence | Yes — escalation pass flips to `escalated` after `maxChases`, creates a `Notification` (`solicitor_unresponsive`) to the assigned agent |
| A solicitor action link | Yes — tokenised confirm page `/s/{token}` + stop link `/s/{token}/stop` |

**Crucially, the codes it already chases include the enquiries cluster:** seller — VM10, VM12, VM13, VM15; buyer — PM14, PM15, PM16, PM17, PM18, PM19, PM20 (`lib/solicitor-confirm/codes.ts`).

**Implication:** the enquiries chase is **not a new cron**. Stages 1.4/1.5 become an *adaptation* of this engine: update the code list when we delete milestones, and configure the surviving enquiries codes' cadence to 9 working days + a 3-week escalation. This is a Law 4 win and shrinks Phase 1.

**One open design wrinkle it surfaces (needs a decision):** today the engine chases the seller's solicitor *for specific milestone steps* (VM12 "replies issued", VM15 "further replies issued"). We are **deleting** those milestones. After the collapse, the seller side has only VM10 (received) and the new "satisfied" mirror — neither of which is a "send your replies" step the seller's solicitor owns. So "chase the seller's solicitor for the outstanding replies" no longer has a milestone to hang on. Two ways to resolve:
- **(A) Tracker-driven chase:** while PM20 is unsatisfied and the tracker's court is "seller solicitor", chase the seller's solicitor off the *tracker state*, not a milestone. (Truer to the new model; a real change to the engine's trigger.)
- **(B) Retain one seller step:** keep a single open seller-side "enquiries" solicitor step that stays chaseable until satisfied.
This is added as decision 6 in the spec.

## 4. Other infrastructure noted

- **Working-day calendar:** exists and is the shared one (`addWorkingDays`, bank holidays to 2028). No new calendar needed — the Stage 1.4 dependency is already met.
- **Buyer-round concept:** the data model has `activeBuyerRoundId` / `buyerRoundId` on completions (a purchaser can go through rounds, e.g. after a fall-through). This is *transaction* rounds, not *enquiry* rounds — our unlabelled movement log does not touch it, but the tracker must be round-aware for purchaser scoping, exactly as the chase engine already is.
- **Outbound bookkeeping:** sends are mirrored to `OutboundMessage` (purpose `chase`) and `Notification`. The tracker's movement log is separate but should sit alongside these, not duplicate them.

## 5. Test coverage

- No enquiries-specific E2E test exists. Closest: `e2e/surface-file-detail.spec.ts`, `e2e/baseline-file-detail.spec.ts`, `e2e/surface-agent-completions.spec.ts`, `e2e/polish-completions.spec.ts`.
- **Law 17 gap:** a happy-path enquiries E2E (raise → chase fires → log movement → satisfied → exchange unlocks) must be written as part of the build series. Proposed to land with Stage 1.6/1.7 when there's UI to drive, and confirmed in Stage 1.11.
- Multi-tenant coverage test exists (`__tests__/multi-tenant/access-scope-coverage.test.ts`) — the new tracker endpoints must be added to it (Law 7).

## 6. Visual baseline

Desktop 1280px / mobile 375px screenshots of the portal enquiries card and the internal file enquiries block are **not captured here** — they need the running app + browser. Deferred to the point where the dev server is up (they'll be taken before/after for the Stage 1.11 regression diff). The behavioural + code baseline above is complete.

---

*End of baseline. No code changed in Stage 1.0.*
