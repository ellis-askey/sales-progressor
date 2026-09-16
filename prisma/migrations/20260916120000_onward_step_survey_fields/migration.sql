-- Onward/related step parity: key-collection + surveyor-firm capture on a
-- reported step, mirroring the main sale's MilestoneCompletion fields. Only ever
-- populated when the linked sale is the agency's own file (resolved in app code).
-- Idempotent so it is safe to re-run via `prisma migrate deploy` on any ledger
-- that already has the columns (they may be hand-applied to staging first).
ALTER TABLE "OnwardStepConfirmation" ADD COLUMN IF NOT EXISTS "keyCollectionRequired" BOOLEAN;
ALTER TABLE "OnwardStepConfirmation" ADD COLUMN IF NOT EXISTS "bookedSurveyorName" TEXT;
