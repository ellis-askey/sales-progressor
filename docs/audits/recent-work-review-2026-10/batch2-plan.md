# Batch 2 — fix plan with knock-on analysis (9 live findings)

Verified against current code 2026-10-31. ML-4 dropped (already fixed, "Audit MILE-007").
Format per item: FIX / AFTER-BEHAVIOUR / KNOCK-ON (wider effects) / EFFORT.

## Contained five (traced directly)

### AE-2 — Moving an upcoming auto-email shows no change for ~60s
FIX: forecast is a per-user TTL memo (automated-emails-upcoming.ts:133, `getUpcomingForecastCached` :139; only consumer = automated-emails/page.tsx:150). Add `invalidateForecastCache()` (calls forecastMemo.clear()) and call it in the 4 mutating actions: movePendingEmail (automated-emails.ts:223), cancelPendingEmail (:242), sendPendingEmailNow (:265), rescheduleChaseThreadAction (chase-timeline.ts:104); + resendQueuedEmailAction.
AFTER: move/skip/send/reschedule a predicted email → Outbox + By-sale cockpit reflect it on the next render, not up to 60s later.
KNOCK-ON: forecastMemo.clear() clears ALL users' cached forecasts on that server instance (in-memory, per-instance, 60s TTL). Effect = one extra recompute for anyone else mid-window; negligible (it already recomputes every 60s). No data effect. LOW.
EFFORT: Small.

### AE-3 — Errored auto-email has no Resend in its detail drawer
FIX: resendQueuedEmailAction(emailId) already exists (resend-queued-email.ts:19, returns {ok,error}). In EmailDetailDrawer footer, when row.status==="errored" && row.source==="queue", render a Resend button calling it + toast.error(res.error) on fail (matches the panel's pattern).
AFTER: opening a failed email shows a Resend button in the drawer; clicking requeues it, with a plain-English error toast if it fails. No more "close drawer, scroll up, refind".
KNOCK-ON: reuses the exact action NeedsAttentionPanel already uses; no new write path. Must invalidate forecast cache too (see AE-2). LOW.
EFFORT: Small.

### CS-2 — A bounced/failed email shows as "Sent" in the viewer
FIX: sent-chase-email.ts delivery type is "sent"|"delivered"|"opened" (:31), computed :108 from openedAt/deliveredAt only. OutboundMessage has `status` (enum incl. `bounced`, schema :2624), `failedAt` (:2494), `failureReason` (:2495) — NOT currently selected. Add them to the select; compute delivery = failed/bounced first. Add a red terminal step to SentEmailModal's STEPS stepper (reuse the Agency File's EMAIL_STATE_META styling) + show failureReason.
AFTER: opening a bounced/failed email shows a red "Failed/Bounced" state with the reason, instead of a green-less "Sent".
KNOCK-ON: viewer-only display + 3 extra selected fields. The Agency File log already surfaces bounced, so data + semantics exist. No write path. LOW.
EFFORT: Small.

### CH-2 — Wrong author name/avatar after logging a chain update
FIX: CheckInsList already gets currentUserId + currentUserRole (:118) but NOT currentUserName/currentUserImage. The optimistic logUpdate (:224) sets lastUpdateAuthorName to the OLD row value and never updates image/role. Pass currentUserName + currentUserImage as props (from the parent), and in the three agent-side optimistic updates (logUpdate :224, toggleStep, confirmReady) set lastUpdateAuthorName/Image/Role to the viewer (role "agent"). Avatar render at :577 already reads those three.
AFTER: logging/ticking a check-in immediately shows YOUR name + photo beside the line, not the previous author's / a generic "Your team".
KNOCK-ON: parent (ChainsWorkspace / wherever CheckInsList mounts) must pass name+image — need to confirm it has them (it has currentUserId already, likely from session). Optimistic-only; server already attributes correctly on refresh, so worst case pre-fix persists. LOW-MED.
EFFORT: Small-Medium.

### CH-3 — Joining two chains is irreversible with no confirm
FIX: the merge already SHOWS a warning line (AddNodeDrawer.tsx:706-714 "The two chains will be joined into one" / "brings N other properties") but the primary "Add to chain" button commits with no confirm. Add a confirm step when selectedFile.chain is set (a merge): "This permanently joins two chains and can't be undone. N properties will move. Continue?" Server merge (chains.ts:1777 propertyChain.delete) unchanged.
AFTER: an accidental mis-click can't silently merge two chains; you get one explicit "yes, join them" gate naming how many properties move.
KNOCK-ON: client-side UX gate only; no server change. Does NOT add un-join (that's the bigger Significant option if you want it). LOW.
EFFORT: Small (confirm) — DECISION: confirm-step now, or also build un-join later?

## The four riskier (deep blast-radius dives)

### RM-4 — Sticky "internal" notes visible to the agency on outsourced files
RESULT: the leak is real ONLY on multi-org files (outsourced / external-business); self-managed single-org files are unaffected. CRUCIAL: "internal scratchpad" is only in CODE COMMENTS — the user-facing tooltip is already neutral ("Add a sticky note"). No UI string promises privacy. StickyNote has createdById/Name but NO author-org field.
- Option (b) RELABEL (near-zero risk): keep notes shared; fix the misleading "internal" wording in comments. No schema/behaviour/visual change. Effectively says "these are shared notes on the file", which they are.
- Option (a) PRIVATE (bigger): schema migration to stamp author-org + read/write filter. Needs 2+ policy decisions: does admin/founder see both sides? does an external-business owner see agency notes? how to backfill legacy rows? No existing internal-vs-agency private-data pattern to mirror (closest is TransactionDocument.sharedWithOtherSide, a different axis).
DECISION NEEDED: do you actually want per-org private notes (option a, a proper build), or are shared file notes fine and we just fix the misleading word "internal" (option b)? My lean: (b) unless progressors genuinely write candid things expecting the agency can't see.
EFFORT: (b) Tiny / (a) Medium + migration + decisions.

### FOC-2 — "Connect to WhatsApp" shows at the wrong times
DIVE RESULT: the originally-proposed fix ("resolve the real connection state") is NOT cleanly feasible and would create a new bug. Why: (1) no agency/business/book-level "is WhatsApp connected" helper exists; (2) Focus is internal-staff-only + cross-tenant, and connection state is per-user (Baileys) or per-owner-tenant (Cloud) — doesn't map to Focus's book; (3) the "Connect to WhatsApp" CTA ALREADY 404s for Focus's core audience (admin/superadmin/plain sales_progressor) — a live bug; (4) a wa.me link needs NO connection at all, only a phone number — the sibling FilesCockpit already gates purely on hasPhone.
REVISED FIX (simpler, safer, fixes more): drop the "connection" gate on the WhatsApp contact action entirely and mirror FilesCockpit — show/enable WhatsApp whenever the side has a phone, always open wa.me; keep whatsappInUse ONLY for the per-side readout column. Removes the dead 404 CTA AND the stale-message false-positive in one move, no new plumbing.
AFTER: WhatsApp works whenever there's a phone number (opens wa.me); the misleading "Connect to WhatsApp → (404)" prompt is gone; the per-side WhatsApp readout still only shows when there's real WhatsApp history.
KNOCK-ON: contained to Focus (focus.ts + FocusClientComms.tsx + focus/page.tsx); no other page uses these flags. Removes a live 404. LOW.
EFFORT: Small.

### ML-1 — Undo-exchange leaves a stale completion date (hub over-counts "completing")
DIVE RESULT: the originally-proposed fix (clear completionDate on undo) is UNSAFE. completionDate is NOT exchange-derived — it's set 4 ways, incl. a MANUAL date picker (saveCompletionDateAction, transactions.ts:716) and a pre-exchange exchange-day agreement (exchange-day.ts:140). Clearing on undo = silent loss of a hand-entered date, no recovery, no activity-log trace, and re-entry friction if they re-exchange. Also asymmetric: expectedExchangeDate is NOT cleared on undo either.
BONUS FINDING: the hub "Completing this week" gate never checks exchange at all — a manually-set near-term completion date on a NEVER-exchanged file already over-counts today. The undo case is just one way in.
REVISED FIX (non-destructive, fixes MORE): fix it at the READER — add `exchangedAt: { not: null }` (or VM19/PM26-complete) to the hub "Completing this week" query (hub.ts:295-312 + drill-down :548-556). No stored data mutated, no data loss, symmetric, and it also fixes the never-exchanged over-count.
AFTER: "Completing this week" only counts files that have actually exchanged and are completing within the window. An undone-exchange file (or a never-exchanged file with a stray date) stops showing. No completion dates are ever wiped.
KNOCK-ON: changes the stat's DEFINITION slightly (exchanged + completing, vs any active + completion date). That's a product call — but it matches what the stat is meant to mean. No data/migration. LOW (reader-only).
DECISION: agree the stat should mean "exchanged & completing soon"? (My strong rec: yes, reader-side fix, not the data-clear.)
EFFORT: Small.

### RM-3 — Opening the work queue writes to the database (and already makes duplicates)
DIVE RESULT: worse than it looked, and the fix is bigger than it looked.
- It's called from THREE places incl. the NAV BADGE (nav-badges.ts:50), which runs on EVERY /agent/* page via layout.tsx:71 — so the write-on-read fires app-wide, and concurrent layout+page renders ALREADY create duplicate ReminderLog+ChaseTask rows in production today (no unique constraint, no transaction).
- The reuse lookup isn't buyer-round-scoped, so the drawer can bind to a STALE prior-buyer PM14 task (chase logs land on the wrong round).
- Moving provision to send-time is feasible BUT: the Chase button needs a REAL chaseTaskId before it fires, or Generate 404s and Send hits an FK-400 (the `?? ""` empty-string is the trap). And a proper dedupe needs a UNIQUE CONSTRAINT = staging-first migration + cleanup of the duplicate rows the current bug has already created.
REVISED FIX (proper, Medium): (1) provision the PM14 task when the chase drawer OPENS (a server action), scoped to activeBuyerRoundId; (2) make it idempotent via a unique constraint (migration) + dedupe/cleanup of existing duplicates; (3) remove the read-time create so the list/badge are truly read-only.
AFTER: viewing the work queue / any /agent page / file reminders tab writes nothing. The task is minted only when an agent actually opens a chase, on the correct buyer round. No more silent duplicate rows.
KNOCK-ON: needs a staging migration + a one-off cleanup of existing duplicate rows; touches the chase-drawer open path + the escalation card; Phase-3 surface so wants a re-baselined happy-path test (Law 17/18). MEDIUM-HIGH effort, real care needed. Not a quick win.
EFFORT: Medium (migration + cleanup + careful wiring).
