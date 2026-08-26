# Enquiries Stage Rework — Spec Proposal

**Status:** In build on staging. **Stages 1.0–1.2 complete** (baseline; data model; milestone set + gate + weights). See `enquiries-rework-baseline.md`.
**Author:** Claude Code session, 2026-08-14

**Progress log:**
- 1.0 baseline — done. Key finding: the solicitor-chase engine already exists and covers the enquiries codes.
- 1.1 data model — done. `EnquiryTracker` + `EnquiryMovement` + enums, applied to staging.
- 1.2 milestone set — done. Retired PM15-19 / VM11-15 (removed from the exchange gate, weight 0, **hidden** from every list rather than shown as "not required"); PM20 repointed to PM14; new seller VM21 "enquiries satisfied" added; enquiries weights applied (PM14 6 / PM20 14 / VM10 8 / VM21 16), both sides still sum to 100. VM21's `blocksExchange` flips true in Stage 1.10 after in-flight files get a completion row. Weights folded in here, so Stage 1.3 is now just the doc + a sum-check test.
**Companion to:** `docs/MILESTONES_SPEC_v1.md`, `docs/MILESTONES_WEIGHTS_v1.md`, `docs/reference/milestone-list.md`
**Touches:** milestone state machine, exchange gate, progress weights, the chase engine, the bilateral email subsystem, the portal, the client-facing email set. This is a large change with downstream reach. It is specced in full here and delivered in two phases.

---

## 1. The problem

The enquiries stage is the one part of the journey that consistently loses fidelity. Three symptoms, one root cause.

**Symptoms**
1. **More rounds than the model allows.** The model hard-codes exactly two rounds (initial + additional). Real files often run three or four.
2. **Partial responses.** Solicitors answer some enquiries and not others. A binary tick can't say "replies in, three still outstanding," so the progressor is stuck choosing between overstating (tick it) and understating (leave it, file looks stalled).
3. **Burst confirmation.** After weeks of silence the solicitor says "enquiries are satisfied," and the progressor has to tick five intermediate steps they never witnessed, all at once, just to unlock the one that's true.

**Root cause**
The stage is modelled as a **straight line** (raise → receive → review → raise → receive → review → satisfied) when it is actually a **loop of unknown length** ending in a human judgement. Worse, the intermediate steps are **predecessors of the exchange gate**, so the software forces the progressor to assert things they cannot observe (we are frequently not CC'd on the solicitors' correspondence) in order to record the one thing they can. The model demands unobservable data and then blocks the file until someone invents it.

**Design principle for the fix:** stop recording the back-and-forth as milestones. Keep the two moments that actually gate or matter, model the messy middle as a loop with a "whose court" state, and source the movement signal from the two people who *can* see it — the buyer and the seller, each watching their own solicitor.

---

## 2. The new model (both phases, end state)

### 2.1 Milestones that survive

Per side, two milestones carry weight and meaning:

| Side | Milestone | Role |
|---|---|---|
| Buyer | PM14 — enquiries raised / underway | opens the stage, starts the chase |
| Buyer | PM20 — enquiries satisfied | the exchange gate; markable directly from PM14 |
| Seller | VM10 — enquiries received / underway | opens the stage on the seller side |
| Seller | **NEW — enquiries satisfied (seller-side mirror)** | ticks the same real event as PM20; gives the seller bar a second movement |

**Deleted milestones:** PM15, PM16, PM17, PM18, PM19 (buyer) and VM11, VM12, VM13, VM14, VM15 (seller). Ten milestones removed.

**The predecessor chain is cut.** PM20's only required predecessor is PM14. When "satisfied" lands after silence, the progressor ticks one thing. Nothing else is a required step. Symptom 3 is gone by construction.

### 2.2 The enquiries tracker (replaces the intermediate ticks)

One tracker per enquiries loop (not per file side). It holds:

- **A "currently with" state** — whose court the ball is in. Defaults to the seller's solicitor at "raised" (they owe the replies). Never guessed by the system. It **flips only on a real signal**: (1) the seller's solicitor replies to a chase, (2) a client reports their side has acted ("my solicitor has sent the replies across"), or (3) the progressor sets it by hand. Until one of those happens it stays put, and the chase stays pointed at whoever holds it ("ball's with you — where are the replies?"). The signal that flips the court is the same signal we translate into the update the other party sees — one movement, three jobs: reset the chase, flip the court, inform the other side.
- **An optional movement log** — unlabelled one-line entries, e.g. "replies received, 14 Aug." **No round number, no initial-vs-additional label**, because that is exactly the distinction we often can't observe. Never blocks anything. Logging a movement **resets the chase clock and can flip the court**.
- **An optional free-text "outstanding" note** — one scratch line ("waiting on: management pack, FENSA cert") the progressor can copy into WhatsApp. Not structured, not per-enquiry. Empty it, mark satisfied.

The tracker is **internal / agent-facing**. The client portal shows state only (see 2.4). "Satisfied" is always a human decision by the progressor; it is never inferred from the log and never self-served by a client (it opens the exchange gate).

### 2.3 The chase (replaces the signal the deleted ticks used to carry)

- **Cadence:** every **7 working days** of silence. An odd number of working days so the nudge lands on a different weekday each time instead of becoming "the Monday email" that gets ignored.
- **Targeted:** the chase points at whoever holds the ball.
  - Seller's solicitor (replies owed): *"Any update on the outstanding replies?"*
  - Buyer's solicitor (reviewing / deciding): *"Are you now satisfied, or is anything still outstanding?"*
- **Clock resets on movement.** Any logged reply or sensor report restarts the 7-working-day timer, so an active file is chased more calmly.
- **Replyable, human, per-sender.** The chase sends as a real email from the correct sender for the file (each agency from its own connected domain; EXP files from ellis@thesalesprogressor.co.uk). A solicitor who never touches the portal can simply **reply in Outlook**, and that reply lands in the right human inbox and *is* a movement signal. The chase and the sensor (section 5) are the same mechanism from two directions.
- **Format:** plain, professional, friendly — the way a person writes in Outlook. **No branded milestone template.** Body + one button "**Provide an update**" (opens the portal link) + the option to just reply. Signature:
  ```
  Kind regards,
  {Sender Name}
  {Agency Name}
  ```
  (Sender name/agency resolve per file and tier: the assigned internal progressor + Sales Progressor for EXP/outsourced; the agency's negotiator + agency for self-managed. "Ellis Askey / EXP" is the outsourced case.)

### 2.4 The escalation (the "3-week ceiling")

- **Ceiling:** **13 working days** (about 2.5 weeks) of continuous silence is the maximum tolerated with no comms.
- Timeline from "raised" or last movement, if fully silent: nudge at working day 7; at working day 13 it **escalates**.
- **Escalation = a task + a visible flag.** A task lands on the right owner: *"Enquiries: chased, no movement in 3 weeks — time to call them."* And the file's enquiries block shows an amber **"stalled — 3 weeks, no reply"** flag, which also surfaces in the owner's hub attention list / daily view so it can't hide behind a polite email.
- **Nudges continue** after escalation; escalation adds a human, it does not stop the robot.
- **Owner routing by tier:** internal progressor for outsourced files; the agency's negotiator for self-managed.

### 2.5 What the client sees

- **Portal state, not detail:** "Enquiries underway" while open → "Enquiries satisfied" when closed. The client never sees the outstanding list or the round-by-round; that conversation stays in the WhatsApp groups, which work.
- **"Underway" is a visibly active state,** not a dead step, so the progress bar doesn't read as frozen during the quiet weeks (see weights, section 6).
- **One upfront reassurance email** at "raised": *"Your solicitor is now working through enquiries. This stage can take a few weeks; we're chasing both sides on your behalf and we'll come to you when there's something real to report."*
- **No per-chase client email.** The client is never emailed "we chased, no news." The portal shows it passively ("Chasing both solicitors, last chased 12 Aug"). The next client *email* is reserved for real news: movement worth sharing, the stall escalation if it matters to them, or satisfied.
- **Derived "whose court" line** (Phase 2): "Last we heard, with the seller's solicitor." Derived from the last logged movement, never a maintained toggle.

---

## 3. Email changes

### 3.1 Deleted client emails (all verified as safe to cut)

Read in full during design. **None carries load-bearing information** — no document, date, deadline, or required client action. Every one is either expectation-setting reassurance or bilateral confirm-to-sync machinery tied to the milestones being deleted.

| Skeleton | What it was | Verdict |
|---|---|---|
| PM15 | replies received (bilateral + hand-off nudge) | delete |
| PM16 | initial replies reviewed (reassurance: "lands in one of three places") | delete; harvest content (see 3.4) |
| PM17 | additional raised (bilateral + hand-off nudge) | delete |
| PM19 | additional replies reviewed (reassurance) | delete |
| VM11 | seller input provided | delete |
| VM12 | initial responses issued (bilateral + hand-off nudge) | delete |
| VM13 | additional received (bilateral + hand-off nudge) | delete |
| VM14 | seller additional input provided | delete |
| VM15 | additional responses issued (bilateral + hand-off nudge) | delete |

(PM18 has no skeleton file today, so nothing to remove there.)

### 3.2 PM20 — no change

The "satisfied" email is fully self-contained. It never references the intermediate steps as prerequisites and moves cleanly to the final-report stage. Keep as-is. It already includes a **vendor block** ("Enquiries are all satisfied") — so the seller-side "satisfied" mirror milestone (2.1) already has its client email; we are not writing a new one.

### 3.3 PM14 and VM10 — adapt

Both need reworking, not because they name deleted content but because they are built on the **bilateral confirm-to-sync scaffolding** we are removing:

- Collapse the four `direction: default / inverse` variants to a single straightforward version (drop all "the other side has already logged receipt, the two are now in sync" language).
- Remove the **hand-off nudge blocks** (PM14's vendor "tap the highlighted confirm button", VM10's purchaser equivalent). The confirm button they point at is a deleted milestone.
- **Keep the good content:** PM14's "what enquiries are… turnaround 1 to 4 weeks" explainer; VM10's "this is normal, not a sign anything's wrong… the file moves at the speed of your answers."
- **Add the new expectation** (these are now the only enquiries email until satisfied): "This can take a few weeks. We're chasing both solicitors for you and we'll come to you when there's something real to report." Soften PM14's current implication that the client will be told when replies come back — under the new model they won't, unless there's genuine movement.

### 3.4 Harvest, don't lose, the education

PM16's "a review lands in one of three places: all clear / follow-up needed / material concern" framing is good client education. Move it into the portal's enquiries explainer so it survives as help text even though the email doesn't.

### 3.5 Bilateral subsystem removal — needs its own clear plan (founder-flagged)

Deleting PM15/VM12, PM17/VM13, VM15 and de-pairing PM14/VM10 removes the **entire bilateral confirm-to-sync subsystem in the enquiries zone**. This is shared code (`lib/email-assembler`, the direction logic, `__tests__/bilateral-suppression.test.ts`). Requirement before any deletion:

- Enumerate every bilateral pair in the journey and confirm which live *only* in the enquiries zone versus elsewhere.
- Prove that removing the enquiries pairs leaves the assembler's bilateral logic intact for the pairs that remain (e.g. exchange/completion pairs).
- Update or narrow the bilateral-suppression test rather than deleting it wholesale.
- This is a Phase 1 sub-task with its own review gate. It does not ship as a side effect.

---

## 4. Client-as-sensor (the "automatic win")

The root problem is that we are not CC'd on the solicitors' correspondence. But the **two clients always are** — the buyer knows when their solicitor has done something, the seller knows when theirs has. Each sees their own half of the board. So instead of guessing whose court the ball is in, the people who can see it tell us.

**Mechanism**
- Portal offers a lightweight **"Tell us an update"** (free text and/or a couple of quick options: "my solicitor has replied" / "my solicitor has raised new enquiries" / "we're waiting on the other side").
- WhatsApp remains the primary channel; these messages are captured the same way. The portal button is a second channel, not a replacement. **Zero adoption still works** — if no client uses the button, WhatsApp-fed movement still drives the tracker.
- A client report is a **soft signal to the progressor**, never an authoritative tick. It comes to us, we review, then it shows.
- **AI translates** the raw client message into clean, neutral, client-appropriate language (this is the deferred notes-to-activity feature finding its first real use — it *rephrases what a human actually said*, it does not invent).
- The translated movement **lands on the file** (internal) and, **once the progressor okays it**, optionally surfaces to the other party ("The buyer's side reports their solicitor has raised follow-up enquiries"). Cross-party display stays conservative and reviewed to avoid a "well my solicitor says different" fight.
- Movement **resets the 9-working-day chase clock** and updates the derived "whose court" state.

**Guardrails**
- "Satisfied" is progressor-only, forever. A client can never self-serve the thing that opens exchange.
- Nothing a client reports auto-moves the gate or auto-shows to the other side without review.
- Worst case of a bad report: a client tells us something wrong, we review, we don't act.

APIs for this are already hooked up (founder confirmed).

---

## 5. Weights

Current enquiries cluster totals (from `MILESTONES_WEIGHTS_v1.md`):

**Buyer — 20.00% across 7 milestones**

| ID | Milestone | Now | After |
|---|---|---|---|
| PM14 | raised → underway | 3.00 | **6.00** |
| PM15 | received | 3.00 | deleted |
| PM16 | reviewed | 2.00 | deleted |
| PM17 | additional raised | 2.00 | deleted |
| PM18 | additional received | 2.00 | deleted |
| PM19 | additional reviewed | 2.00 | deleted |
| PM20 | satisfied | 6.00 | **14.00** |
| | **cluster total** | **20.00** | **20.00** |

**Seller — 24.00% across 6 milestones**

| ID | Milestone | Now | After |
|---|---|---|---|
| VM10 | received → underway | 5.00 | **8.00** |
| VM11 | seller input | 5.00 | deleted |
| VM12 | initial issued | 5.00 | deleted |
| VM13 | additional received | 3.00 | deleted |
| VM14 | seller additional input | 3.00 | deleted |
| VM15 | additional issued | 3.00 | deleted |
| — | **NEW** enquiries satisfied (mirror) | — | **16.00** |
| | **cluster total** | **24.00** | **24.00** |

**Approach:** keep each side's enquiries cluster total constant and concentrate it into the survivors, so **no milestone outside the enquiries zone changes** and both sides still sum to 100. Both bars keep two movement points (underway + satisfied) instead of a single big jump.

**Open for sign-off:** the exact split. PM20 at 14 makes "satisfied" the single heaviest milestone on the buyer side (heavier than exchange at 8). That is arguably correct — satisfied enquiries is the biggest hurdle in a purchase — but the split is tunable (e.g. PM14 8 / PM20 12) and you sign off the numbers.

---

## 6. Build plan — every stage

The vision is decided now, in full; only the delivery is staged, so a smart sensing layer never rides on top of a risky structural change. Phase 1 is the skeleton and delivers the core pain relief on its own. Phase 2 is the sensor and layers on once the skeleton is stable.

Each stage below is scoped to be a single reviewable change (Law 5: one concern per PR; Law 16: no bulk rewrites). Stages are ordered by dependency. Where two stages are independent, that's noted so they can run in parallel. Every stage ships to **staging first, verified, then production** (Law 3), and every stage that adds a query uses the access-scope helper at `lib/security/access-scope.ts` (Law 7).

### Cross-cutting concerns (apply to every stage)

- **Multi-tenancy.** The new models (tracker, movement log) are transaction-scoped. Every read/write goes through `scopeTransactionWhere` / `scopeOwnershipWhere`. Internal staff (agencyId null) reach them via the access-scope helper, never an ad-hoc `agencyId` filter.
- **Tier fork.** Almost everything with a sender or an owner branches on service tier: outsourced (internal progressor owns; sends as Sales Progressor / ellis@thesalesprogressor.co.uk) vs self-managed (agency negotiator owns; sends from the agency's connected domain). This is resolved once, in a helper, and reused by the chase, the escalation task, and the reassurance email.
- **Working-day calendar.** Already exists: `addWorkingDays()` + an England & Wales bank-holiday table (populated to 2028) in `lib/emails/working-hours.ts`. No new calendar needed. (Confirmed in Stage 1.0 baseline.)
- **Existing chase engine.** The solicitor-chase system (`lib/solicitor-confirm/chase.ts`, `app/api/cron/solicitor-chase/`, `codes.ts`) already chases the enquiries codes with working-day cadence, per-agency replyable sender, pause/snooze, idempotency, and human escalation. Stages 1.4/1.5 **adapt this engine**, they do not build a new one (Law 4). See baseline doc.
- **Voice + DoD.** Every new user-facing string passes `docs/reference/VOICE.md` (no em-dashes, no "delete", "we'll" not "the system"). Every new UI element ships with loading / empty / error / first-time states (Law 12).

---

### Phase 1 — the skeleton

#### Stage 1.0 — Baseline + decisions locked (no code)
- **Goal:** satisfy Law 17 before touching a Phase-3-class surface, and freeze the open numbers.
- **Do:** capture the current enquiries behaviour — every route fetched on the file view and portal, every email fired PM14→PM20 / VM10→VM15, screenshots at desktop 1280px and mobile 375px (portal + internal file view), happy + stalled states. Confirm an E2E happy-path test exists for the enquiries stage; if not, write it first.
- **Lock:** the five decisions in section 10 (weights, seller mirror, client-email format, cadence, go).
- **Verify:** baseline doc committed and linked from this spec.
- **Depends on:** nothing. Blocks everything.

#### Stage 1.1 — Data model
- **Goal:** the tracker and the new seller milestone exist in the schema.
- **Changes (Prisma):**
  - `EnquiryTracker` — one per transaction's enquiries loop. Fields: `transactionId`, `currentlyWith` enum (`seller_solicitor` | `buyer_solicitor`), `outstandingNote` (text, nullable), `openedAt`, `lastMovementAt` (nullable), `chaseNextAt` (nullable), `escalatedAt` (nullable), `snoozedUntil` (nullable), `closedAt` (nullable).
  - `EnquiryMovement` — append-only log rows. Fields: `trackerId`, `note` (text), `occurredAt`, `source` enum (`progressor` | `buyer_report` | `seller_report` | `solicitor_reply`), `createdByUserId` (nullable), `createdAt`.
  - New **seller-side "enquiries satisfied"** milestone: a new milestone ID (not a renumber), definition mirrors PM20 semantics, predecessor VM10, blocks-exchange = per the seller gate rules (confirm against `MILESTONES_SPEC_v1`).
- **Migration:** `YYYYMMDDHHMMSS_enquiries_tracker` — additive only (no drops yet). Staging first.
- **Verify:** `npx prisma generate --no-engine` then `tsc` clean; migration applied to staging and readable.
- **Depends on:** 1.0. Independent of 1.2/1.3.

#### Stage 1.2 — Milestone set + predecessor chain
- **Goal:** the collapsed milestone set is the live shape; PM20 no longer waits on phantom steps.
- **Changes:**
  - Cut PM20's predecessor from PM19 → **PM14**. Set the new seller "satisfied" predecessor to VM10.
  - Mark PM15, PM16, PM17, PM18, PM19, VM11, VM12, VM13, VM14, VM15 for removal from the active milestone set. **Do not hard-delete definitions yet** — flag them removed/inactive so migration (1.10) can map in-flight files off them first. Hard cleanup lands in 1.9.
  - Update the milestone engine + `lib/milestones/display-stages.ts` so the enquiries stage renders as raised → underway → satisfied.
- **Verify:** display-stages test updated and green; a fresh file shows two enquiries steps per side; "satisfied" is selectable directly after "raised" in a test file.
- **Depends on:** 1.1. Pairs naturally with 1.3.

#### Stage 1.3 — Weights
- **Goal:** the bar maths is correct and each side still sums to 100.
- **Changes:** update `docs/MILESTONES_WEIGHTS_v1.md` (with a v1.2 change note) and the weight source in code. Buyer PM14 3→6, PM20 6→14; seller VM10 5→8, new-satisfied 16; deleted milestones removed from the set.
- **Verify:** automated check that vendor and purchaser applicable sets each sum to 100.00; worked example recomputed for a sample file.
- **Depends on:** 1.2 (needs the final milestone set). One concern, its own PR.

#### Stage 1.4 — The chase (adapt the existing engine, don't rebuild)
- **Goal:** an open enquiries loop chases the right solicitor on the 7-working-day drumbeat, replyable, and calms on movement — reusing `lib/solicitor-confirm/chase.ts`.
- **Changes:**
  - Reuse the existing engine: it already computes working-day cadence, resolves the per-agency/EXP replyable sender, respects the per-side pause flag + `expectedDate` snooze, is idempotent via `SolicitorChaseState`, and escalates. We are **configuring and narrowing it**, not writing a cron.
  - **Cadence:** set the surviving enquiries codes' `SolicitorReminderRule` to grace + repeat = **7 working days**.
  - **Differentiated ask:** the per-side digest already targets the right solicitor; adjust the solicitor step labels / copy so the seller's solicitor reads "any update on the outstanding replies?" and the buyer's reads "satisfied, or anything outstanding?".
  - **Seller chase target** (decision 6): resolve how the seller's solicitor stays chaseable once VM12/VM15 are deleted — either the tracker-driven trigger (A) or a retained seller step (B).
  - **Movement resets the clock:** logging a movement (Stage 1.6) writes the same signal the engine reads as "responded", so the cadence restarts.
  - The "Provide an update" solicitor link is the existing tokenised `/s/{token}` confirm/stop flow (already built), not a new button.
- **Verify:** with the master switch on in sandbox, a seeded stalled file sends to the correct solicitor at 7 working days; pause + `expectedDate` suppress; a logged movement restarts the cadence; sender correct for an EXP file and an agency file.
- **Depends on:** 1.1 (tracker), 1.2 (final code set). Reuses the existing working-day calendar + engine.

#### Stage 1.5 — Escalation (reuse the existing pass, add the visible flag)
- **Goal:** three weeks of silence can't hide.
- **Changes:** the engine's escalation pass already notifies the assigned agent after the chase cap. Tune the enquiries codes so escalation lands at the **13 working day** ceiling, and confirm the notification routes to the tier-resolved owner (internal progressor for outsourced; agency negotiator for self-managed) — the engine currently targets `assignedUserId ?? agentUserId`, which already encodes this. **Add** the amber "stalled — 3 weeks, no reply" flag on the tracker + file enquiries block, and surface it in the hub attention list (`lib/services/hub.ts` / `components/hub`) so it's visible without opening the file. Nudges continue after escalation.
- **Verify:** a seeded 3-week-silent file produces one notification to the right owner (no duplicates on re-run) and renders the flag on the file and in the hub.
- **Depends on:** 1.4.

#### Stage 1.6 — Internal tracker UI
- **Goal:** the progressor can see and drive the loop from the file.
- **Changes:** on the internal file view, an enquiries tracker panel — whose-court display, "log a movement" (plain date-stamped line, writes an `EnquiryMovement`, resets the chase), the single free-text outstanding note, chase status line ("next nudge in N working days"), snooze control, and the stalled flag. Uses canonical `components/ui` primitives (Law 14); if a pattern's missing, add to the catalog before building.
- **Verify:** logging a movement resets the chase and updates whose-court; editing the outstanding note persists; snooze reflected in the status line. All four states present.
- **Depends on:** 1.1, 1.4.

#### Stage 1.7 — Client-facing changes
- **Goal:** the client stays reassured through the quiet weeks without noise.
- **Changes:**
  - Portal: "Enquiries underway" as a visibly **active** state (working look, not a dead step) + passive "Chasing both solicitors, last chased {date}" line. No per-chase email.
  - One **upfront reassurance email** at "raised" (tier-resolved sender), replacing the drumbeat the deleted emails used to provide.
  - **Adapt PM14 and VM10** skeletons: collapse the four `direction` variants to one, remove the bilateral hand-off nudge blocks, keep the enquiries explainer + "1 to 4 weeks", add the softened expectation ("we'll come to you when there's something real to report").
  - **Harvest** PM16's "lands in one of three places" framing into the portal enquiries explainer.
- **Verify:** portal renders the active state at desktop + mobile (screenshots); PM14/VM10 assemble with no `direction`/nudge branches; reassurance email fires once at raised; visual regression on the portal enquiries card.
- **Depends on:** 1.2. Independent of 1.4/1.5.

#### Stage 1.8 — Bilateral subsystem removal (own review gate — founder-flagged)
- **Goal:** remove the enquiries bilateral pairing without disturbing bilateral logic elsewhere.
- **Changes:** enumerate every bilateral pair in `lib/email-assembler` / `lib/email-skeletons/journey-order.ts`; identify which live only in the enquiries zone (PM14/VM10, PM15/VM12, PM17/VM13, VM15/PM18) vs elsewhere (e.g. exchange, completion). Remove the enquiries pairs' `direction` handling; prove the remaining pairs still assemble correctly; narrow (don't delete) `__tests__/bilateral-suppression.test.ts`.
- **Verify:** full email-assembler test suite green with the enquiries pairs gone; a non-enquiries bilateral pair (e.g. exchange) still suppresses correctly.
- **Depends on:** 1.7 (PM14/VM10 already de-paired there). Has its own explicit review checkpoint before merge.

#### Stage 1.9 — Hard cleanup of deleted milestones + emails
- **Goal:** remove the now-dead definitions and skeletons.
- **Changes:** delete the PM15/16/17/19 and VM11/12/13/14/15 skeleton files, remove their `journey-order` entries and any references, remove the inactive milestone definitions flagged in 1.2. (PM18 has no skeleton.)
- **Verify:** `tsc` clean; grep confirms no dangling references; email suite green.
- **Depends on:** 1.8 **and** 1.10 (don't hard-delete definitions until in-flight files are migrated off them).

#### Stage 1.10 — Migration of in-flight files
- **Goal:** every live sale lands cleanly on the new shape.
- **Changes:** a one-shot, registered migration script (Law 15 registry entry + deletion ticket). Any file currently anywhere in PM15–PM19 / VM11–VM15 → PM14/VM10 complete, enquiries "underway", deleted steps dropped from its set. Any file at PM20+ stays satisfied; backfill the new seller "satisfied" mirror complete where PM20 is complete. Recompute stored progress for every affected file. Open a tracker row for every file currently in the enquiries window so the chase picks them up.
- **Verify:** on a staging clone, sample files across every pre-migration state map correctly; no progress percentage moves in a way not explained by the redistribution; no file mid-bilateral-handshake elsewhere is disturbed. Then production.
- **Depends on:** 1.2, 1.3, 1.1. Runs before 1.9's definition cleanup.

#### Stage 1.11 — Regression capture + CI
- **Goal:** prove no unexplained behavioural drift (Law 18).
- **Changes:** re-capture the Stage 1.0 baseline; diff and explain every delta. Add/confirm visual-regression coverage for the new portal active state and the internal tracker panel; confirm the enquiries E2E happy-path still passes end to end (raise → chase fires → log movement → mark satisfied → exchange unlocks).
- **Verify:** all three CI layers green; baseline diff reviewed.
- **Depends on:** everything in Phase 1.

---

### Phase 2 — the sensor

#### Stage 2.1 — Client "Tell us an update" capture
- **Goal:** the buyer and seller can report movement their solicitor told them about.
- **Changes:** on both portals, a lightweight "Tell us an update" — free text plus a couple of quick options ("my solicitor has replied" / "raised new enquiries" / "waiting on the other side"). Writes an `EnquiryMovement` with `source = buyer_report | seller_report` in a **pending/soft** state (not yet shown, not yet authoritative).
- **High-value buyer option (founder-requested, 2026-08-14):** *"My solicitor has confirmed they're happy with all the enquiry replies."* The buyer's solicitor declares satisfaction and usually tells their client before they tell us, so this is the single most valuable sensor signal. It is a **report, never a self-tick** — it lands as a pending movement in the review queue, and the progressor confirms and marks PM20. The seller equivalent is "my solicitor has sent all our replies across" (a movement that flips the ball to the buyer), since the seller's side doesn't own satisfaction.
- **Verify:** a report from each portal lands as a pending movement scoped to the right transaction; nothing shows cross-party yet.
- **Depends on:** Phase 1 complete.

#### Stage 2.2 — Progressor review queue
- **Goal:** soft signals get a human okay before they count.
- **Changes:** pending reports surface in the internal tracker panel and the hub attention list; the progressor accepts (promotes to a real movement, resets the chase, updates whose-court) or dismisses. "Satisfied" remains progressor-only and is never reachable from a client report.
- **Verify:** accepting a report resets the chase and flips whose-court; dismissing leaves state untouched; no path from a report to the exchange gate.
- **Depends on:** 2.1.

#### Stage 2.3 — AI translation
- **Goal:** raw client wording becomes a clean, neutral line.
- **Changes:** extend the existing Haiku drafting path (the chase/content AI, not a new integration) to rephrase an accepted report into neutral language for the file activity and the agent-facing log. It **rephrases what the client actually said** — it never invents facts. Progressor sees and can edit the suggestion before it's saved.
- **Verify:** a messy report produces a clean line; the progressor can override; nothing is auto-published without the okay from 2.2.
- **Depends on:** 2.2.

#### Stage 2.4 — Whose-court derivation + conservative cross-party surfacing
- **Goal:** the derived "last we heard, with X" line, and optional one-way visibility to the other side.
- **Changes:** whose-court display derives from the latest accepted movement. Optionally, once the progressor okays it, an accepted movement surfaces to the other party as a neutral one-liner ("The buyer's side reports their solicitor has raised follow-up enquiries") — reviewed, never automatic, never the raw text.
- **Verify:** derived line matches the last accepted movement; cross-party line only appears after explicit okay; both portals at desktop + mobile.
- **Depends on:** 2.3.

> **WhatsApp note:** the groups stay the primary channel. Phase 2 does not integrate the WhatsApp Business API (that remains a separate deferred item). "WhatsApp-fed movement" means the progressor logs what a client said in the group via the same movement action — the portal button is simply a second, self-serve channel. Zero portal adoption still leaves the skeleton fully working.

---

## 7. Migration (in-flight files)

- **State mapping:** any live file currently sitting anywhere in PM15–PM19 (or VM11–VM15) maps to **"raised / underway"** — i.e. PM14/VM10 complete, the deleted milestones gone. Any file already at PM20 (or beyond) stays **satisfied**.
- **Seller "satisfied" mirror backfill:** for files where the buyer's PM20 is already complete, set the new seller-side "satisfied" mirror complete too (same real event). For files mid-enquiries, it's open.
- **Weights:** recompute stored progress for every live file after the milestone set changes; verify no file's percentage moves in a way that isn't explained by the redistribution.
- **Bilateral machinery:** confirm removal doesn't disturb any in-flight file mid-bilateral-handshake elsewhere in the journey (section 3.5).
- **IDs:** keep all surviving milestone IDs stable. The seller "satisfied" mirror gets a **new** ID (not a renumber), to avoid churning references across the codebase.
- Staging first, verified, then production (Law 3).

---

## 8. What we lose (regression accounting), with mitigations

| Lost | Real cost | Mitigation |
|---|---|---|
| Granular client emails (9) | fewer touchpoints in the quiet weeks | one upfront reassurance email + active portal state + Phase 2 movement notes |
| Progress-bar increments | bar could look frozen mid-stage | "underway" active state + reweighting so the two survivors carry the stage |
| Detailed timeline history | file record loses the blow-by-blow | you couldn't fill most of it truthfully anyway; the optional log captures what you did see |
| "Received vs reviewed" as separate steps | distinction vanishes | founder confirmed it's not used as a control, just weighted % |
| Seller-side enquiry visibility | seller file shows less | clients care little in-app; WhatsApp carries it |

**Not lost:** the exchange gate does not weaken (satisfied still required); a clean satisfied date still lands (helps the expected-days feature); enquiry *content* was never in the app, so nothing to lose there. The change also *helps* two in-flight features: a cleaner enquiries duration for expected-days, and far simpler reconciliation of imported mid-way files.

---

## 9. Deferred / explicitly out of scope

- Mirroring actual enquiry *content* between the two sides' portals (maintenance sink; WhatsApp owns content).
- Any enquiry *detail* on the client portal (state only; internal/agent-facing detail only).
- Pushing AI-tidied enquiry notes to the client portal (internal-only for now).
- The broader notes-to-activity AI feature *as a general capability across all milestones* (Phase 2 uses it narrowly for enquiries sensor translation; the general rollout is separate).

---

## 10. Decisions needed before build

1. **Weight split** — confirm PM14 6 / PM20 14 and VM10 8 / new-satisfied 16, or tune.
2. **Seller-side "satisfied" mirror milestone** — confirm we add it (my recommendation) versus loading all 24% onto VM10 (which reintroduces a frozen seller bar).
3. **Client milestone email format** — the plain Outlook-style format is specced for the *solicitor chase* emails. Confirm the *client* milestone emails (PM14/VM10/PM20) stay in the existing branded template with adapted content, or whether you want them revisited separately.
4. **Chase cadence + ceiling** — confirmed: 7 working days between nudges and 13 working days as the escalation ceiling (aligned to the live constants 2026-08-26).
5. **Sign-off to proceed to Phase 1 build**, staging first.
6. **Seller chase target** (surfaced by the Stage 1.0 baseline) — once VM12/VM15 are deleted, the seller's solicitor has no "send your replies" milestone to chase. Choose: **(A)** tracker-driven chase off the whose-court state (truer to the new model, a change to the engine's trigger), or **(B)** retain one open seller-side "enquiries" solicitor step chaseable until satisfied. My lean: **(A)**.

---

*End of draft. No code has been written. This document is the plan for review.*
