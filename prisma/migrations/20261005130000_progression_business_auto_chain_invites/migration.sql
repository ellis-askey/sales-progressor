-- Business controls whether chain invites auto-send at sale creation (critique #23).
-- Additive, idempotent (shared-repo safety).
ALTER TABLE "ProgressionBusiness" ADD COLUMN IF NOT EXISTS "autoChainInvitesEnabled" BOOLEAN NOT NULL DEFAULT true;
