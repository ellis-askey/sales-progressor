-- Add referral tracking fields to PropertyTransaction
ALTER TABLE "PropertyTransaction"
  ADD COLUMN IF NOT EXISTS "referredFirmId"      TEXT,
  ADD COLUMN IF NOT EXISTS "referralFee"         INTEGER,
  ADD COLUMN IF NOT EXISTS "referralFeeReceived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PropertyTransaction"
  ADD CONSTRAINT "PropertyTransaction_referredFirmId_fkey"
  FOREIGN KEY ("referredFirmId") REFERENCES "SolicitorFirm"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
