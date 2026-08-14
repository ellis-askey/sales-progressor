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

---

*Append a new entry per stage. Keep it plain. This file is the first place to look if something needs undoing.*
