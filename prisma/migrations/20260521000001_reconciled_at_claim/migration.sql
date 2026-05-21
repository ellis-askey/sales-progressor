-- Reconciliation-on-Claim Arc — Commit 1
-- Adds reconciledAtClaim flag to MilestoneCompletion.
-- Mirrors the existing reconciledAtExchange field. Additive, no data loss.
-- Apply to STAGING first, verify, then PRODUCTION.

ALTER TABLE "MilestoneCompletion"
  ADD COLUMN IF NOT EXISTS "reconciledAtClaim" BOOLEAN NOT NULL DEFAULT false;
