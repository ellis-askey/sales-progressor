-- Seller's onward-purchase broker (Phase 2, 2026-09-15). Parallel broker fields
-- on PropertyTransaction mirroring the buyer's broker, for the seller's onward
-- purchase. The fee is agent income like the buyer's. Applied to staging then
-- production via `prisma migrate deploy` on deploy (the direct DB host is
-- unreachable from local). See docs/active/onward-broker/SPEC.md.

-- AlterTable
ALTER TABLE "PropertyTransaction"
  ADD COLUMN "onwardBrokerFirmId" TEXT,
  ADD COLUMN "onwardBrokerContactId" TEXT,
  ADD COLUMN "onwardBrokerReferralFee" INTEGER,
  ADD COLUMN "onwardBrokerReferralFeeReceived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "onwardBrokerReferral" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_onwardBrokerFirmId_fkey" FOREIGN KEY ("onwardBrokerFirmId") REFERENCES "BrokerFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_onwardBrokerContactId_fkey" FOREIGN KEY ("onwardBrokerContactId") REFERENCES "BrokerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
