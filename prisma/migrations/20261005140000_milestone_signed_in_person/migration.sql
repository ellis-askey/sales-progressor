-- "Signed in person with the solicitor" flag on a milestone completion (critique #3).
-- Additive, nullable, idempotent.
ALTER TABLE "MilestoneCompletion" ADD COLUMN IF NOT EXISTS "signedInPerson" BOOLEAN;
