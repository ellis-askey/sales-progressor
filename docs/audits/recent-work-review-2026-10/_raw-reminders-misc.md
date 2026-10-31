# Raw findings — Reminders/enquiries/sticky/professionals/chase/push (agent ae14e8c)

## RM-1 "Founder-gated" professionals gated in UI only — server actions aren't — LOGIC — Small — Confirmed
app/actions/professionals.ts:22-31 assertOwns (file ownership only, Law7) vs OverviewPanel.tsx:482 showOtherProfessionals = currentUserRole==="superadmin". addProfessionalAction/update/remove never check role. Any director/negotiator/sales_progressor scoped to file can invoke addProfessionalAction directly + write TransactionProfessional rows. "Gated while checking" implies data path closed — it isn't. Fix: add hasSuperAdminPowers(session) assertion in professionals.ts actions matching render condition; ungate still "drop role condition in two places".

## RM-2 Sticky-note edits in last ~0.5s before leaving file are lost — PROBABLY NOT CONSIDERED — Small — Confirmed
StickyLayer.tsx:32 unmount cleanup + :36-46 550ms debounced save. Unmount clears pending timers but never flushes pending patch map. Type then click back to Hub within debounce → last edit (<550ms) clearTimeout'd, never written. Reopen → tail of note gone. Autosave scratchpad silent partial data loss. Fix: flush pending.current synchronously on unmount before clearing; optionally flush on visibilitychange/pagehide.

## RM-3 Viewing work queue writes to DB (escalated-enquiry reminder provisions chase task on read) — PROBABLY NOT CONSIDERED — Medium — Confirmed
enquiry-escalations.ts:95 calls ensure-raise-chase-task.ts:37-60. getEscalatedEnquiryReminders documented "Read-only" but for each escalated row with no PM14 chase task calls ensureRaiseChaseTask → reminderLog.create + chaseTask.create. Rendering list creates DB rows. Two near-simultaneous renders (prefetch + nav, or two tabs) both create → duplicate cancelled ReminderLogs/ChaseTasks (existing lookup not transactional). Reuse lookup (:23-28) not buyer-round-scoped → relisted file may reuse previous buyer's PM14 task. Fix: provision lazily at send time (ChaseDrawer open/first send) not list read; if on read, scope reuse by buyerRoundId + dedupe.

## RM-4 Sticky "internal scratchpad" visible to customer agency on outsourced files — MISSED CONNECTION — Medium — Confirmed(intent Q)
sticky-notes.ts:21-26 + app/actions/sticky-notes.ts:15-23 gate on scopeOwnershipWhere only. Notes returned to anyone who can open file. Outsourced file: customer agency director/negotiator own by agencyId, see notes written by internal TSP progressor. Comment frames "internal scratchpad… never reach client portal" (true for portal, not agency). TSP jots "vendor being difficult" → agency director reads it. Fix: decide intent — scope reads by internal-staff vs agency (and/or author org), or soften "internal scratchpad" framing.

## RM-5 Reschedule action header comment contradicts code (says raise lane not moveable) — EASY WIN — Small — Confirmed
chase-timeline.ts:98-99 doc says "raise-chase lane has no hold field, so it isn't moveable" but b6ac3a0a added it — :154-172 handles target.scope==="raise" writing PM14 expectedDate; RescheduleChaseControl offers scope:"raise". Stale comment on load-bearing action. Fix: update comment to document raise lane PM14-expectedDate hold.

## RM-6 Server accepts client-chase reschedule earlier than current due, then falsely confirms "moved" — LOGIC — Small — Confirmed
chase-timeline.ts:114-140 vs RescheduleChaseControl.tsx:45-49. Control computes minISO=max(currentDue,tomorrow) (later only). Server only validates dateISO<=today → reject; doesn't enforce "later than currently due". Client lane writes snoozedUntil=hold; snoozedUntil earlier than natural next fire = silent no-op (chase fires on own cadence) yet toast says "Next chase moved to {date}". Guarantee "hold can delay never conjure earlier" enforced only by client. Fix: mirror UI rule server-side — reject/clamp date earlier than current due.

## RM-7 Escalated-enquiry Chase button can open ChaseDrawer with no task to send on — DEAD END — Small — Possible
AgentRemindersList.tsx:497 chaseTaskId={reminder.chaseTaskId ?? ""}. ensureRaiseChaseTask returns null when no PM14 ReminderRule (ensure-raise-chase-task.ts:34). Card still renders Chase split-button unconditionally → click opens ChaseDrawer with empty chaseTaskId. Missing-email seam handled, missing-task not (Law 13). Fix: when chaseTaskId null, disable/hide Chase (keep Mark chased/raised) or show add-a-rule seam.

## RM-8 Sticky notes clamp X but not Y, never re-clamp after viewport change — UNFINISHED UI — Small — Confirmed
StickyLayer.tsx:48-53 patchNote clamps x to clientWidth-48, no y clamp. y unbounded, absolute px, no re-clamp on load/resize. Note dragged far down or placed right on wide screen then viewed narrow sits off usable area. Fresh notes spawn x:36,y:22 over hero/back controls. 1600px monitor drag right → laptop later off-screen right. Fix: clamp y, clamp on mount against layer size, spawn below hero band.

## RM-9 "Exchanging soon" digest push drops you on unfiltered files list — MISSED CONNECTION — Medium — Possible
push-events.ts:149-153 url ${base}/agent/transactions, body "Tap to see which files are approaching their exchange target". Single-file push deep-links to file (pushExchangeApproaching) but collapsed digest links to bare list with no exchange filter param. "3 sales exchanging soon" → full pipeline, hunt for which 3. Fix: deep-link to filtered/sorted view (?sort=exchange) or Hub section listing them.

## RM-10 Bank-holiday table hard horizon (ends 2028) no refresh alarm — PROBABLY NOT CONSIDERED — Small — Confirmed
working-hours.ts:26-54 BANK_HOLIDAYS ends 2028-12-26 (memory "extend before 2028" satisfied). No runtime guard warning before lapse. Once out, isWorkingDay silently treats future BHs as working days (weekends still safe). 2029 New Year's Day chase sends on BH — the exact failure the work fixed, quietly back. Fix: cheap startup/CI assertion that logs loudly/fails when max(BANK_HOLIDAYS) within ~90 days.

## Sound (checked)
- Working-days conversion wired consistently across engine/client/solicitor/enquiry crons/staleness badge/snooze gaps/chase predictions (2dc162b8).
- Mgmt-pack hold suppresses chase + escalation (enquiries/chase.ts:59), self-heals on PM12 (milestones.ts:367-370).
- Blocker self-heal falls through to live check for email-shaped markers (reminder-autopilot.ts).
- Escalated-enquiry card shares one ledger via markRaiseChased on manual-send + Mark chased.
- Delete has proper 5s Undo before DB write.
