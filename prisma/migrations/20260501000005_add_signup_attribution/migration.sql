-- Migration: add_signup_attribution
-- Signup attribution fields on Agency + signupAt index.
-- Safe to re-run (idempotent).

ALTER TABLE "Agency"
  ADD COLUMN IF NOT EXISTS "signupSource"      TEXT,
  ADD COLUMN IF NOT EXISTS "signupMedium"      TEXT,
  ADD COLUMN IF NOT EXISTS "signupCampaign"    TEXT,
  ADD COLUMN IF NOT EXISTS "signupReferrer"    TEXT,
  ADD COLUMN IF NOT EXISTS "signupLandingPage" TEXT,
  ADD COLUMN IF NOT EXISTS "signupAt"          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Agency_signupAt_idx" ON "Agency"("signupAt");
