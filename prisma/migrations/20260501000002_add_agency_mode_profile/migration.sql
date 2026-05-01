-- Migration: add_agency_mode_profile
-- Adds AgencyModeProfile enum and Agency.modeProfile field.
-- Canonical signal: PropertyTransaction.serviceType
--   outsourced → progressor_managed
--   self_managed → self_progressed
--   both → mixed
-- Safe to re-run (idempotent).

DO $$ BEGIN
  CREATE TYPE "AgencyModeProfile" AS ENUM ('self_progressed', 'progressor_managed', 'mixed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Agency"
  ADD COLUMN IF NOT EXISTS "modeProfile" "AgencyModeProfile" NOT NULL DEFAULT 'self_progressed',
  ADD COLUMN IF NOT EXISTS "modeProfileComputedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Agency_modeProfile_idx" ON "Agency"("modeProfile");

-- ─── One-time backfill ────────────────────────────────────────────────────────
-- After applying this migration, run scripts/backfill-mode-profile.ts
-- OR run this SQL directly for a quick one-shot:
--
-- WITH agency_modes AS (
--   SELECT
--     "agencyId",
--     SUM(CASE WHEN "serviceType" = 'outsourced'   THEN 1 ELSE 0 END) AS outsourced_count,
--     SUM(CASE WHEN "serviceType" = 'self_managed'  THEN 1 ELSE 0 END) AS self_count,
--     COUNT(*) AS total
--   FROM "PropertyTransaction"
--   WHERE "createdAt" >= NOW() - INTERVAL '90 days'
--   GROUP BY "agencyId"
-- )
-- UPDATE "Agency" a
-- SET
--   "modeProfile" = CASE
--     WHEN am.outsourced_count > 0 AND am.self_count > 0  THEN 'mixed'::\"AgencyModeProfile\"
--     WHEN am.outsourced_count > 0                         THEN 'progressor_managed'::\"AgencyModeProfile\"
--     ELSE                                                      'self_progressed'::\"AgencyModeProfile\"
--   END,
--   "modeProfileComputedAt" = NOW()
-- FROM agency_modes am
-- WHERE a.id = am."agencyId";
