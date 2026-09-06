-- Claimed-in-progress exclusion flag on PropertyTransaction.
-- Mirrors isMigrated: excludes files claimed onto the platform while already
-- underway from date-derived velocity metrics (their createdAt is the claim
-- day, not the day the sale was agreed, and reconciled milestones carry
-- backdated/unknown dates). Additive, no data loss.
-- Apply to STAGING first, verify, then PRODUCTION.

ALTER TABLE "PropertyTransaction"
  ADD COLUMN IF NOT EXISTS "claimedInProgress" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any existing file that already had milestones reconciled at claim
-- was, by definition, claimed while in progress. Idempotent.
UPDATE "PropertyTransaction" pt
SET "claimedInProgress" = true
WHERE EXISTS (
  SELECT 1 FROM "MilestoneCompletion" mc
  WHERE mc."transactionId" = pt.id
    AND mc."reconciledAtClaim" = true
);
