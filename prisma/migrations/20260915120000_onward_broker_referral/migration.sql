-- Seller's onward-purchase broker (Phase 2, 2026-09-15). Parallel broker fields
-- on PropertyTransaction mirroring the buyer's broker, for the seller's onward
-- purchase. The fee is agent income like the buyer's. Written idempotently
-- (IF NOT EXISTS) because the columns are applied to staging manually ahead of
-- deploy (the direct DB host is unreachable from local); this lets the deploy's
-- `prisma migrate deploy` re-run it as a no-op. See docs/active/onward-broker/SPEC.md.

-- AlterTable
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerFirmId" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerContactId" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerReferralFee" INTEGER;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerReferralFeeReceived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "onwardBrokerReferral" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyTransaction_onwardBrokerFirmId_fkey') THEN
    ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_onwardBrokerFirmId_fkey" FOREIGN KEY ("onwardBrokerFirmId") REFERENCES "BrokerFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PropertyTransaction_onwardBrokerContactId_fkey') THEN
    ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_onwardBrokerContactId_fkey" FOREIGN KEY ("onwardBrokerContactId") REFERENCES "BrokerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
