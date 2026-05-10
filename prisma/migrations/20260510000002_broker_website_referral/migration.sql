-- Add website field to BrokerFirm
ALTER TABLE "BrokerFirm"
  ADD COLUMN IF NOT EXISTS "website" TEXT;

-- Add purchaser broker referral flag to PropertyTransaction
ALTER TABLE "PropertyTransaction"
  ADD COLUMN IF NOT EXISTS "purchaserBrokerReferral" BOOLEAN NOT NULL DEFAULT FALSE;
