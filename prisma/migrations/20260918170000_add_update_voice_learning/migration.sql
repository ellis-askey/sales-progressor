-- Client-update voice learning (kept register-separate from the chase voice).
-- All additive: nullable columns + one defaulted counter. Safe to apply live.
-- Written idempotent (IF NOT EXISTS) because on this repo the columns are applied
-- to staging out of band (the direct DB connection is unreachable locally); this
-- lets `prisma migrate deploy` re-run it as a no-op and record it cleanly.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updateVoiceProfile" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updateVoiceProfileBuiltAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updateVoiceProfileSamples" INTEGER NOT NULL DEFAULT 0;

-- The AI draft a client update started as, so the loop can compare draft vs sent.
ALTER TABLE "PortalMessage" ADD COLUMN IF NOT EXISTS "generatedText" TEXT;
