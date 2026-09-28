-- Referral ledger (docs/active/referral-ledger/00-spec.md), Phase 1.
-- Purely additive: two enums + one table + indexes + FKs. No changes to existing
-- tables (the back-relations on PropertyTransaction/BuyerRound/SolicitorFirm/
-- BrokerFirm/BrokerContact are virtual — the FK columns live on Referral).

-- CreateEnum
CREATE TYPE "ReferralKind" AS ENUM ('buyer_solicitor', 'seller_solicitor', 'buyer_broker', 'onward_broker');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('pending', 'earned', 'received');

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "buyerRoundId" TEXT,
    "kind" "ReferralKind" NOT NULL,
    "solicitorFirmId" TEXT,
    "brokerFirmId" TEXT,
    "brokerContactId" TEXT,
    "firmNameSnapshot" TEXT NOT NULL,
    "feePence" INTEGER,
    "vat" "FeeVatTreatment" NOT NULL DEFAULT 'plus',
    "status" "ReferralStatus" NOT NULL DEFAULT 'pending',
    "earnedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_transactionId_idx" ON "Referral"("transactionId");

-- CreateIndex
CREATE INDEX "Referral_buyerRoundId_idx" ON "Referral"("buyerRoundId");

-- CreateIndex
CREATE INDEX "Referral_kind_status_idx" ON "Referral"("kind", "status");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_buyerRoundId_fkey" FOREIGN KEY ("buyerRoundId") REFERENCES "BuyerRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_solicitorFirmId_fkey" FOREIGN KEY ("solicitorFirmId") REFERENCES "SolicitorFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_brokerFirmId_fkey" FOREIGN KEY ("brokerFirmId") REFERENCES "BrokerFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_brokerContactId_fkey" FOREIGN KEY ("brokerContactId") REFERENCES "BrokerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
