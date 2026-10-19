-- Per-(progression business, agency) sending identity.
--
-- Two progression companies at the same agency must never share one sending
-- address (that merges two separate businesses). The address lives per link so
-- Jo's files at Knights and Annalise's files at Knights carry distinct senders.
--
-- Additive + idempotent (IF NOT EXISTS) so prod's `migrate deploy` applies cleanly
-- and a staging re-run is a no-op.
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN IF NOT EXISTS "senderEmail" TEXT;
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN IF NOT EXISTS "senderVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN IF NOT EXISTS "senderVerifiedAt" TIMESTAMP(3);

-- Backfill: on an agency with a SINGLE active progressor, the agency's verified
-- sender unambiguously belongs to that one progressor, so adopt it as their per-link
-- sender (preserves every existing single-progressor setup, e.g. Naked.). Multi-
-- progressor agencies are left null on purpose — the shared agency address can't be
-- attributed to one company, so each must be provisioned its own.
UPDATE "ProgressionBusinessClient" pbc
SET "senderEmail"      = a."quoteSenderEmail",
    "senderVerified"   = a."quoteSenderVerified",
    "senderVerifiedAt" = a."quoteSenderVerifiedAt"
FROM "Agency" a
WHERE pbc."agencyId" = a."id"
  AND pbc."removedAt" IS NULL
  AND pbc."senderEmail" IS NULL
  AND a."quoteSenderEmail" IS NOT NULL
  AND a."quoteSenderVerified" = true
  AND (
    SELECT COUNT(*) FROM "ProgressionBusinessClient" x
    WHERE x."agencyId" = pbc."agencyId" AND x."removedAt" IS NULL
  ) = 1;
