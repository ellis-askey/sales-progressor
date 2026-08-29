-- Intro-call onboarding (2026-08-29). Additive: two nullable columns on
-- PropertyTransaction recording that the team completed the introduction for a
-- file (from either side). Drives the "intro done" state on the client card.
-- No backfill, no change to existing rows.

ALTER TABLE "PropertyTransaction" ADD COLUMN "introCallCompletedAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "introCallCompletedById" TEXT;
