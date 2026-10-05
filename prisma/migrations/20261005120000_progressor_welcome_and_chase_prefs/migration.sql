-- First-run welcome flag for external progression-business owners (separate from
-- the agent welcome so the two never collide). Idempotent (shared-repo safety).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasSeenProgressorWelcome" BOOLEAN NOT NULL DEFAULT false;

-- Business-level chase preferences (default ON). Set by the owner in the welcome
-- modal / settings; enforced future-only by the chase engines.
ALTER TABLE "ProgressionBusiness" ADD COLUMN IF NOT EXISTS "chaseClientsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProgressionBusiness" ADD COLUMN IF NOT EXISTS "chaseSolicitorsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProgressionBusiness" ADD COLUMN IF NOT EXISTS "chaseEnquiriesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProgressionBusiness" ADD COLUMN IF NOT EXISTS "weeklyClientUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProgressionBusiness" ADD COLUMN IF NOT EXISTS "chainUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true;
