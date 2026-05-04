-- Make SolicitorFirm a global shared pool across all agencies.
-- Firms are no longer owned by a single agency; any agency can pick any firm.
-- AgencyRecommendedSolicitor remains for per-agency customisation (referral fees etc).

ALTER TABLE "SolicitorFirm" DROP CONSTRAINT IF EXISTS "SolicitorFirm_agencyId_fkey";
ALTER TABLE "SolicitorFirm" DROP COLUMN IF EXISTS "agencyId";
