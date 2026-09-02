# Chase consolidation — Chase timeline as the single "what we're chasing" home

Status: **spec + plan, not started.** Drafted 2026-09-02. Founder decision: **Option A** — consolidate into the Chase timeline (move edit-before-send there + add the solicitor track), then retire/slim the Reminders "Automated emails" card.

This is audit-backed (three-part codebase investigation, 2026-09-02). Every claim below is cited to code.

---

## 1. Why

Two file surfaces both narrate "upcoming chases", which reads as duplication:

- **Reminders tab → "Automated emails" card** (`components/reminders/AutomatedEmailsCard.tsx`, `lib/services/automated-emails-preview.ts`): an *email-queue* view — Pending now / Sent today (real `OutboundEmailQueue` rows + SendGrid delivery status) / Upcoming (a 14-day client-chase forecast), with a **View / Edit** affordance on pending client-chase rows.
- **Chase timeline tab** (`lib/services/chase-timeline.ts`, `components/transaction/ChaseTimeline.tsx`): a *thread/escalation* view — per-milestone threads, auto vs manual chase counts, escalation ladder, history, next-due.

They are different lenses, but the overlap (both list upcoming client chases) is confusing, and neither surfaces **solicitor** chasing at all. Goal: the Chase timeline becomes the single home for "what we're chasing, what's about to send, and edit it before it does" — for client **and** solicitor.

---

## 2. Current state (evidence)

**Chase timeline already does more than its header claims.** The `track` union is `"client" | "solicitor" | "enquiry" | "exchange"` (`chase-timeline.ts:59`); the service already reads `SolicitorChaseState`, `EnquiryTracker`, `EnquiryRaiseChase` and exchange-day stamps and projects solicitor/enquiry/exchange threads. The "Solicitor track + enquiries land in v2" comment (`chase-timeline.ts:3-6`) is **stale**.

**But the solicitor track is incomplete + buggy:**
- Threads are built by mapping `ReminderLog` rows (`chase-timeline.ts:209`). A solicitor state only surfaces if a client `ReminderLog` exists for the same milestone code. Solicitor-only steps (VM8, VM9, VM17, PM8, PM13, PM23…) have **no** thread today.
- It reads `sol.snoozeUntil` (`chase-timeline.ts:231`) which is **never written anywhere** — dead field. The real solicitor snooze is `MilestoneCompletion.expectedDate > now` (`lib/solicitor-confirm/chase.ts:287`).
- Confirming a step **does not close** `SolicitorChaseState` (neither `solicitorConfirmStepAction` nor `completeMilestone` touch it), so `status:"active"` ≠ outstanding. Completion truth must come from `MilestoneCompletion.state`.

**Edit-before-send already exists** for milestone-confirmation emails and is *plumbed* for client chases:
- All sends ride `OutboundEmailQueue` (`schema.prisma:2013-2058`): `scheduledFor` = the hold; `errorAt` = the skip (stamped, never sent, kept for audit); `payload` = the editable body; `editedAt/editedById` = audit.
- `updateEmailPayload` (`app/actions/automation.ts:598-726`) already whitelists **both** `CLIENT_CHASE` and `MILESTONE_CONFIRMATION` for editing and rebuilds branded HTML from the edited text.
- Confirmations get a **5-min hold** (`portal.ts:2127`, 60s for exchange/completion), a **review tray** (`ConfirmReviewTray`), skip (`cancelPendingConfirmEmails`), edit (`updateEmailPayload`/`updateDigestForRecipient`) and Send-now (`drainMilestoneDigestsForFile`) — but all of it is **hard-scoped to `emailType: "MILESTONE_CONFIRMATION"`**.

**Client chases queue but have no surfaced review window, and count too early:**
- `enqueueClientChaseDigest` (`client-chase-digest.ts:423-628`) enqueues a `CLIENT_CHASE` row with **no explicit `scheduledFor`** → defaults to `scheduleForBusinessHours(now)` (`outboundQueue.ts:131`), drained by the **hourly** `drainOutboundQueue`.
- **`ClientChaseState.chaseCount++`, `lastChasedAt`, `firstChasedAt` and the ReminderLog `nextDueDate` are written at ENQUEUE** (`client-chase-digest.ts:562-587`), not at send. So a skipped-after-enqueue chase is already counted + has advanced the clock. **This is the central risk.**

**Solicitor chases don't queue at all:** `sendDigestForGroup` builds the email inline and calls `sendChainEmail` directly (`chase.ts:371-395`); `SolicitorChaseState.chaseCount++` bumps after send. No `OutboundEmailQueue` row, no hold, no edit surface. (Solicitors *are* `Contact` rows via `tx.*SolicitorContactId`, so routing them through the queue is feasible but is a real refactor of `chase.ts`'s send half.)

---

## 3. Target

The Chase timeline detail pane, per thread, shows: who we're waiting on, the escalation ladder, history — **and** "Next email: `<subject>` to `<name>`, sending `<when>`" with **View / Edit** and **Skip this send** (reusing `EmailPreviewModal` + `updateEmailPayload` + a generalised skip). Solicitor chases appear as first-class threads (client + solicitor + enquiry, one ladder). The Reminders "Automated emails" card is retired; its still-unique pieces are re-homed or consciously dropped.

---

## 4. Phased plan (each phase is its own reviewable PR; staging first)

### Phase 1 — Complete + de-bug the solicitor track (read-only, low risk)
- New `getSolicitorChaseThreads(transactionId)` (mirrors the enquiry/exchange projection precedent): iterate solicitor-owned `MilestoneCompletion`s + `SolicitorChaseState`, synthesising `"scheduled"` threads for solicitor-only steps that have no state row yet; predict `nextDueAt` by reusing the pure `findDueSolicitorChases` / `resolveAnchorDate` cadence; take completion/snooze truth from `MilestoneCompletion.state`/`expectedDate`; enrich history from `ChaseSend` (real opened/responded).
- Merge into `getChaseTimeline` so solicitor threads no longer depend on a client `ReminderLog`; fix the dead `snoozeUntil` read.
- Update the timeline UI copy (drop "v1 / client + manual").
- **No writes, no send changes.**

### Phase 2 — Surface the pending email + edit/skip in the timeline (medium)
- `getChaseTimeline` additionally reads pending `OutboundEmailQueue` rows and attaches per-thread `{ queueId, subject, recipient, scheduledFor, editable }`.
- `ThreadDetail` gains a "Next email" block after the next-due row: preview + **View / Edit** (reuse `EmailPreviewModal` + `updateEmailPayload`, already CLIENT_CHASE-ready) + **Skip this send**.
- Generalise `cancelPendingConfirmEmails` (currently `MILESTONE_CONFIRMATION`-scoped) to accept `CLIENT_CHASE`, or add a chase-scoped skip action.
- Depends on Phase 3 for skip to be *safe* (see the count problem) — so ship edit first, gate skip behind Phase 3.

### Phase 3 — Client-chase review hold + safe skip (**the send-pipeline change; highest risk**)
- Give client chases a short review hold: pass an explicit `scheduledFor = now + N min` in `enqueueClientChaseDigest` (mirroring `portal.ts:2127`).
- **Fix the count-at-enqueue problem (Decision D1).** Either (a) move `chaseCount++`/`lastChasedAt`/`nextDueDate` commit to **send time** (in the drain), so a skipped chase is genuinely "not chased"; or (b) keep enqueue-time commit but make skip **reverse** those writes. Recommendation: **(a)** — cleaner and matches the mental model.
- Add a scoped "send now" for a chase row (no per-file chase drain exists today; `drainMilestoneDigestsForFile` is confirmation-only).
- Staging-first, with the `CLIENT_CHASE_ENABLED` flag as the safety valve.

### Phase 4 — Solicitor edit-before-send (**bigger; candidate to defer**, Decision D3)
- Route solicitor chases through `OutboundEmailQueue` (`recipientContactId` = the solicitor Contact), refactoring `sendDigestForGroup` into enqueue + payload-store, moving `SolicitorChaseState` bookkeeping to drain-time. Enables edit/skip for solicitor sends in the timeline.
- Verify solicitor `Contact` rows carry the linkage the confirm-review read scopes on.
- If deferred: Phase 1 still makes solicitor chases **visible** in the timeline; they just aren't editable-before-send yet.

### Phase 5 — Retire / slim the Reminders "Automated emails" card (Decision D4)
- Once pending/sent + edit live in the timeline, remove `AutomatedEmailsCardAsync` from `RemindersPanel`. The Reminders tab keeps its actionable **reminders & tasks** management (snooze / chased / done / chase-now) — the card is only the informational layer.
- Re-home or drop the card's remaining unique pieces:
  - **14-day forecast incl. not-yet-started first chases** — the timeline only has threads for milestones with a reminder/state; a forecast of a *first* chase with no thread has no home. Keep as a small "upcoming" strip, or fold into the timeline as `"scheduled"` synthetic threads.
  - **Pause-state pill** (global / agency / file) — move to the timeline header.
  - **Notification / confirmation emails** (`category:"notification"`, and confirmation-email edit) — arguably out of "chase" scope; the `ConfirmReviewTray` already handles confirmations, and `/agent/automated-emails` remains the full log.

---

## 5. Decisions — LOCKED (2026-09-02)

- **D1 — count at send, not enqueue.** ✅ Move `chaseCount` / `lastChasedAt` / `firstChasedAt` / ReminderLog `nextDueDate` commit to **send-time** (the drain), so a skipped chase is genuinely never counted. Applies to client chases (solicitor already counts post-send today).
- **D2 — edit the *upcoming* chase, not a 5-min window.** ✅ The agent edits/skips the **next scheduled chase** (the one the timeline forecasts) at any time before it fires — because chases are generated by the daily cron when the agent isn't present, a short post-queue window is useless. This is explicitly **not** the confirmation-email flow. **Architecture:** a per-(transaction, recipient side/contact, milestoneCode) **chase override** store — `subjectOverride` / `bodyOverride` / `skipNext`. The chase builder (client + solicitor) reads it at fire time: `skipNext` → don't send **and** don't count; overrides → send the edited copy. Preserves adaptivity (the chase still only fires when actually due; the forecast keeps re-evaluating) while letting the agent pre-edit/pre-skip. Override is consumed (cleared) when that chase sends or the step resolves. The preview shown in the timeline is the live generated copy (from the pure `assembleDigestPayload` / `buildSolicitorDigestEmail`), with the override applied if set.
- **D3 — build edit-before-send for solicitors too.** ✅ Route solicitor chases through `OutboundEmailQueue` (recipientContactId = the solicitor Contact) so they get the same override/edit/skip + send-time counting. Refactors `sendDigestForGroup` into enqueue + payload-store; `SolicitorChaseState` bookkeeping moves to drain-time.
- **D4 — re-home + fully retire the card.** ✅ Move the not-yet-started-chase forecast (as greyed `"scheduled"` timeline threads) + the pause-state pill (into the timeline header) onto the Chase timeline, then remove `AutomatedEmailsCardAsync` from the Reminders tab. Confirmations keep the confirm tray + `/agent/automated-emails` log.
- **D5 — light delivery chips on thread history.** ✅ A small delivered/deferred/bounced/blocked marker on the thread's history events; full delivery forensics stay in `/agent/automated-emails`.

---

## 6. Risks

- **Live client sends** (Phase 3): changing the enqueue schedule + count timing touches real outbound email + the escalation math (cap, 14-day silence key off `lastChasedAt`/`firstChasedAt`). Must be staging-verified and flag-guarded.
- **Double-count on skip** if D1 isn't resolved first — Phase 2 skip must not ship before Phase 3.
- **Solicitor `status` staleness**: any solicitor projection must join `MilestoneCompletion`, not trust `SolicitorChaseState.status`; ideally Phase 1 also closes the row on confirm (durable fix) so other consumers are safe.
- **Two drains**: confirmations use a 5-min dedicated cron, chases the hourly queue — a shared review UI must not imply a 5-min chase send unless chases move to a faster/scoped drain.

---

## 7. Recommended sequence

Phase 1 (solicitor track, safe) → Phase 2 edit-only (no skip yet) → Phase 3 (hold + count fix + safe skip) → wire Phase 2 skip → Phase 5 (retire card) → Phase 4 (solicitor edit-before-send) last, or deferred. This ships visible value early (solicitor track, edit) and gates the risky send-pipeline change behind its own PR.
