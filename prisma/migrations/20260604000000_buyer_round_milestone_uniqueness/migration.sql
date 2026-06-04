-- Phase 1 of the relist feature — load-bearing uniqueness change.
--
-- Replace the file-level @@unique([transactionId, milestoneDefinitionId])
-- with two partial unique indexes so the same MilestoneCompletion
-- composite can exist twice on a transaction once we add per-round
-- purchaser rows: once for the file-level vendor row, once per buyer
-- round on the purchaser side.
--
-- Vendor (file-level) rows:    UNIQUE (transactionId, milestoneDefinitionId)  WHERE buyerRoundId IS NULL
-- Purchaser (per-round) rows:  UNIQUE (buyerRoundId, milestoneDefinitionId)   WHERE buyerRoundId IS NOT NULL
--
-- Prisma's schema language cannot express partial unique indexes;
-- both are raw-SQL here and the schema.prisma @@unique is replaced
-- with a regular @@index for the legacy (transactionId,
-- milestoneDefinitionId) query shape that is still hot across many
-- call sites.
--
-- Pre-flight sanity (run on staging before applying):
--   scripts/check-mc-uniqueness-readiness.ts
-- expected: both duplicate counts = 0. Confirmed on staging
-- 2026-06-03 before this migration applied.
--
-- Also adds BuyerRound.vendorMilestoneSnapshot (Json?) — used by the
-- relist server action (Phase 1, commit 6) to snapshot the VM rows
-- that get reset in place (VM2, VM7, VM10–VM20), preserving an audit
-- record on the archived round.

-- ─── MilestoneCompletion uniqueness ────────────────────────────────────────

-- Prisma's @@unique on PostgreSQL creates a unique INDEX (not a named
-- CONSTRAINT). Drop the index directly. Confirmed on staging via
-- pg_constraint inspection 2026-06-03.
DROP INDEX "MilestoneCompletion_transactionId_milestoneDefinitionId_key";

CREATE UNIQUE INDEX "MilestoneCompletion_tx_def_vendor_uq"
  ON "MilestoneCompletion" ("transactionId", "milestoneDefinitionId")
  WHERE "buyerRoundId" IS NULL;

CREATE UNIQUE INDEX "MilestoneCompletion_round_def_purchaser_uq"
  ON "MilestoneCompletion" ("buyerRoundId", "milestoneDefinitionId")
  WHERE "buyerRoundId" IS NOT NULL;

-- Replacement for the dropped composite — the (tx, def) shape is still
-- queried often (per-side milestone views, prereq checks, etc.). A
-- regular index keeps those reads fast without enforcing the old
-- file-wide uniqueness.
CREATE INDEX "MilestoneCompletion_transactionId_milestoneDefinitionId_idx"
  ON "MilestoneCompletion" ("transactionId", "milestoneDefinitionId");

-- ─── BuyerRound.vendorMilestoneSnapshot ────────────────────────────────────

ALTER TABLE "BuyerRound"
  ADD COLUMN "vendorMilestoneSnapshot" JSONB;
