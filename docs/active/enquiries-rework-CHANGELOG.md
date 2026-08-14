# Enquiries Rework — Change Ledger

**What this is:** a single, plain-English record of every change made while building the enquiries rework, in order, with how to undo each one. If anything misbehaves, start here. The spec (`enquiries-stage-rework-SPEC.md`) is the *plan*; this is the *log of what was actually done*.

**How reverting works, in general:**
- **Code** — every stage is its own git commit (hash noted below). `git revert <hash>` undoes exactly that stage, nothing else.
- **Database** — each schema/data change is a numbered migration file under `prisma/migrations/`. Migrations only ever apply forward, so "undo" means a new counter-migration (noted per entry). Nothing is applied to production until the whole phase is pushed; everything below is **staging only** so far.
- **Decisions** — captured in the spec's progress log + section 10.

---

## Stage 1.0 — Baseline (no code)
- **Date:** 2026-08-14
- **What:** recorded how enquiries work today and what already exists. Key find: the solicitor-chase engine already covers the enquiries steps, so the chase is a config job, not a new build.
- **Files:** `docs/active/enquiries-rework-baseline.md`, spec updates.
- **DB:** none.
- **Revert:** delete the doc; nothing else touched.

## Stage 1.1 — Data model
- **Date:** 2026-08-14
- **Commit:** `feat(enquiries): stage 1.1 data model` (see git log)
- **What:** added two new (empty) tables — the enquiries tracker (whose-court state, outstanding note, chase bookkeeping) and its movement log. Nothing reads or writes them yet.
- **Files:** `prisma/schema.prisma` (models `EnquiryTracker`, `EnquiryMovement` + 3 enums + one link on `PropertyTransaction`).
- **DB migration:** `20260815200000_enquiries_tracker` — additive (new tables only). Applied to **staging**.
- **Revert:** `git revert` the commit; counter-migration to `DROP TABLE "EnquiryMovement"`, `DROP TABLE "EnquiryTracker"`, and the three enum types. Safe — nothing depends on them yet.

## Stage 1.2 — Milestone set + gate + weights
- **Date:** 2026-08-14
- **Commit:** `feat(enquiries): stage 1.2 collapse milestone set` (see git log)
- **What:**
  - Retired the ten enquiry sub-steps (buyer PM15-19, seller VM11-15): removed from the exchange gate (`blocksExchange=false`), weight set to 0, and **hidden from every milestone list** (not shown as "not required"). Their definition rows are left in place so existing files' data doesn't orphan; a later stage deletes them.
  - "All enquiries satisfied" (PM20) now depends directly on "raised" (PM14) — no phantom chain.
  - Added a new seller-side step VM21 (see 1.2a for the corrected framing).
  - Enquiries weights: PM14 6 / PM20 14 / VM10 8 / VM21 16. Both sides still sum to 100.
- **Files:** `lib/milestone-prerequisites.ts` (prereq map + `RETIRED_ENQUIRY_CODES`), `lib/services/milestones.ts` (skip retired on new files + hide from list).
- **DB migration:** `20260815210000_retire_enquiry_steps` — data only (updates weights/gate/predecessor, inserts VM21). Applied to **staging**. Verified: both sides sum to 100.
- **Not yet done (deliberate):** VM21 does not block exchange yet (flips on in Stage 1.10 after existing files get a row); existing files aren't reconciled onto the new shape yet (Stage 1.10); the destructive dev seed is not yet synced to the new model (harmless — never run on staging — but sync before any reseed).
- **Revert:** `git revert` the commit; counter-migration to restore PM20 predecessor `PM19`, restore the ten steps' `blocksExchange=true` + original weights, and `DELETE` the VM21 row.

## Stage 1.2a — Seller step reframed (correction)
- **Date:** 2026-08-14
- **What:** the seller doesn't *confirm* enquiries satisfied — the buyer's solicitor does. So VM21 is renamed from "Seller's solicitor has confirmed…" to plain **"All enquiries satisfied"**, and is a **reflection** of the buyer's confirmation (auto-completes when PM20 is confirmed — that auto-complete wiring lands in the completion-logic stage), never ticked by the seller. The repeatable "seller has replied to all *current* enquiries" is not a milestone at all — it's a movement in the tracker (flips the ball to the buyer's court), so more rounds never cause a re-tick problem.
- **Files:** `prisma/seed.ts` (canonical list synced to the new model: VM10 8, VM11-15 retired, VM21 added, PM14 6, PM15-19 retired, PM20 14 + predecessor PM14), `prisma/migrations/20260815220000_rename_seller_enq_satisfied`.
- **DB migration:** `20260815220000_rename_seller_enq_satisfied`. ⚠️ **NOT YET APPLIED** — the staging Supabase project was unreachable (auto-paused) at the time. Applies on the next `prisma migrate deploy` once staging is resumed. Until then, staging still shows VM21's old name.
- **Verify:** `tsc` clean with the synced seed. DB apply pending (above).
- **Revert:** `git revert` the commit; the rename migration is a no-op if never applied, else a counter-migration to restore the old name.

## Stage 1.3 — Weights doc + sum-check test
- **Date:** 2026-08-14
- **What:** updated `MILESTONES_WEIGHTS_v1.md` to v1.2 (enquiries weights concentrated onto the survivors; both sides still 100). Added a guard test that reads the real prerequisite map (asserts PM20→PM14, VM21→VM10, no retired code in the graph) and locks each side's weight sum at 100.
- **Files:** `docs/MILESTONES_WEIGHTS_v1.md`, `lib/milestones/__tests__/enquiry-weights.test.ts`.
- **DB:** none.
- **Note:** the sum-check asserts a canonical weight map held in the test (mirrors the doc + seed). A DB-sourced sum-check would need the seed's arrays extracted to an importable catalog — deferred to avoid moving the canonical list under time pressure. Live DB sums were already verified = 100 in Stage 1.2.
- **Verify:** 7/7 tests pass; `tsc` clean.
- **Revert:** `git revert` the commit. No DB change.

## Stage 1.3a — Ease the seller "satisfied" weight
- **Date:** 2026-08-14
- **What:** VM21 16 → 12 (a reflection shouldn't outweigh the buyer's own PM20=14). The freed 4 spread onto VM2 (→4), VM3 (→5), VM16 (→5), VM20 (→6). Vendor still sums to 100; enquiries cluster now 20 each side.
- **Files:** `prisma/migrations/20260815230000_ease_enquiry_weights`, `prisma/seed.ts`, `docs/MILESTONES_WEIGHTS_v1.md`, `lib/milestones/__tests__/enquiry-weights.test.ts`.
- **DB migration:** `20260815230000_ease_enquiry_weights`. ⚠️ **NOT YET APPLIED** — staging still paused. Applies with the other pending migrations on resume.
- **Verify:** 7/7 tests, `tsc` clean.
- **Revert:** `git revert` the commit; counter-migration to restore the old weights if applied.

## Stage 1.4a — Enquiries tracker lifecycle
- **Date:** 2026-08-14
- **What:** the enquiries tracker now opens automatically the moment enquiries are raised (PM14) or received (VM10) — with the ball starting on the seller's solicitor — and closes when the buyer's side confirms satisfied (PM20, or the seller reflection VM21). Wired into `completeMilestone`'s side-effect chain, alongside the existing unlock/gate hooks.
- **Files:** `lib/services/milestones.ts` (`syncEnquiryTracker` helper + one hook).
- **DB:** none (uses the tables from Stage 1.1).
- **Verify:** `tsc` clean (Prisma calls + the `seller_solicitor` enum typecheck against the real client); runtime smoke test on staging opened and closed a throwaway tracker, then cleaned up.
- **Revert:** `git revert` the commit. No DB change.
- **Next (1.4b):** the chase send itself — the 9-working-day nudge to whoever holds the ball, the plain "Good morning/afternoon" copy + "Provide an update" button, and the 3-week escalation.

## Stage 1.4b (part 1) — Chase copy + greeting
- **Date:** 2026-08-14
- **What:** the time-based greeting helper ("Good morning" before noon London, else "Good afternoon" — never greets by name), and the enquiries chase email builder. Two directions keyed on the tracker's court (seller solicitor "any update on the replies?" / buyer solicitor "satisfied?"), plain Outlook-style, with a "Provide an update" button and a reply path, signed `Kind regards, {Sender}, {Agency}`. Variant-agnostic (no tenure/funding conditioning).
- **Files:** `lib/emails/greeting.ts`, `lib/enquiries/chase-email.ts`, `lib/enquiries/__tests__/chase-email.test.ts`.
- **DB:** none.
- **Verify:** 4/4 tests (incl. a voice check for no em-dashes/exclamations), `tsc` clean.
- **Next (1.4b part 2):** the chase engine — the cron that reads each open tracker, sends this copy to whoever holds the ball on the 9-working-day cadence via the per-agency replyable sender, and escalates at 3 weeks. Plus removing the enquiries codes from the old solicitor-confirm chase so the two don't overlap.

## Stage 1.4b (part 2) — Chase engine
- **Date:** 2026-08-14
- **What:** the enquiries chase cron. Walks every open tracker, works out who holds the ball, and sends the 9-working-day nudge to that solicitor via the replyable per-agency / EXP sender; escalates to a notification for the file owner after 3 weeks of silence. Reuses the existing working-day calendar, sender resolver, and tokenised `/s/<token>` update page. Gated by the same `SolicitorChaseSettings` master switch (OFF by default). Also removed the enquiries codes (VM10/12/13/15, PM14-20) from the old solicitor-confirm chase so the two never double-send.
- **Files:** `lib/enquiries/chase.ts`, `app/api/cron/enquiries-chase/route.ts`, `vercel.json` (cron entry), `lib/solicitor-confirm/codes.ts` (de-dup), `lib/enquiries/__tests__/chase-decision.test.ts`.
- **DB:** none.
- **Verify:** 12/12 tests (copy + 8-case cadence/escalation decision); `tsc` clean; a live smoke on staging confirmed the cron's tracker query resolves a real tracker + its solicitor email. The actual send only fires when the master switch is on (off by default, so nothing sends in prod yet) — a full sandbox dry-run can be run when you're ready.
- **Revert:** `git revert` the commit. No DB change. (Re-add the enquiries codes to `codes.ts` if you want the old chase to cover them again.)

## Stage 1.6a — Tracker service + movement logging
- **Date:** 2026-08-14
- **What:** the read + mutations behind the internal panel. `logEnquiryMovement` records a one-line movement and **resets the chase** (clears `lastChasedAt` + `escalatedAt`) and **flips the court** if the ball moved; `setEnquiryOutstandingNote` and `setEnquirySnooze` (snooze N working days); `getEnquiryTrackerView` returns the display shape (status, next-chase date, movements). Server actions verify the file is in the caller's access scope (Law 7) before any write.
- **Files:** `lib/enquiries/tracker.ts`, `app/actions/enquiries.ts`.
- **DB:** none.
- **Verify:** `tsc` clean; a staging smoke logged a movement on a chased + stalled file — the court flipped seller → buyer, `lastChasedAt` and `escalatedAt` cleared, movement recorded. Cleaned up.
- **Next (1.6b):** the visual panel on the internal file view that drives these actions.
- **Revert:** `git revert` the commit. No DB change.

## Stage 1.6b — Tracker panel (both file views)
- **Date:** 2026-08-14
- **What:** the enquiries panel on the Overview tab of **both** the internal and the agent file views (so outsourced and self-managed files both get movement logging). Shows whose court the ball is in, the status (chasing with next-nudge date / amber "stalled 3 weeks" / snoozed / closed), a "log an update" box (with an optional "now with seller's/buyer's sol" hand-off that flips the court), the outstanding note, a snooze control, and the movement history. Only renders when the enquiries loop is open. A small server wrapper (`EnquiryTrackerSection`) drops the panel into both pages.
- **Files:** `components/transaction/EnquiryTrackerPanel.tsx`, `components/transaction/EnquiryTrackerSection.tsx`, `app/transactions/[id]/page.tsx`, `app/agent/transactions/[id]/page.tsx`.
- **DB:** none.
- **Verify:** `tsc` clean. **Visual review pending** (needs the running app) — the panel only appears on a file whose enquiries loop is open, so to see it: mark "enquiries raised" on a test file (that opens a tracker via the 1.4a lifecycle), then open that file's Overview.
- **Revert:** `git revert` the commit. No DB change.

## Stage 1.5 — Stalled enquiries in the hub attention list
- **Date:** 2026-08-14
- **What:** a stalled enquiries loop (escalated, no movement in 3 weeks) now surfaces on the hub attention card as an "escalated" item ("Enquiries stalled"), using the same visibility scoping as the existing reminder attention items — so it's visible without opening the file. (The file-level amber flag and the owner notification were already there from 1.4b/1.6b; this is the third surface the spec asked for.)
- **Files:** `lib/services/hub.ts` (extended `getHubAttentionItems`).
- **DB:** none.
- **Verify:** `tsc` clean; a staging smoke confirmed an escalated tracker resolves through the attention query with the right shape.
- **Revert:** `git revert` the commit. No DB change.

---

*Append a new entry per stage. Keep it plain. This file is the first place to look if something needs undoing.*
