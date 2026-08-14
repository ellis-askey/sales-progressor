-- Enquiries rework: the "get enquiries raised" chase. A per-transaction record
-- that tracks the pre-loop chase to get the buyer's solicitor to raise
-- enquiries (buyer nudge -> solicitor chase -> escalation). Opens when searches
-- are ordered, closes when enquiries are raised.

-- CreateEnum
CREATE TYPE "RaiseChaseTarget" AS ENUM ('buyer', 'buyer_solicitor');

-- CreateTable
CREATE TABLE "EnquiryRaiseChase" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastNudgedAt" TIMESTAMP(3),
    "lastTarget" "RaiseChaseTarget",
    "nudgeCount" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnquiryRaiseChase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryRaiseChase_transactionId_key" ON "EnquiryRaiseChase"("transactionId");

-- CreateIndex
CREATE INDEX "EnquiryRaiseChase_closedAt_idx" ON "EnquiryRaiseChase"("closedAt");

-- AddForeignKey
ALTER TABLE "EnquiryRaiseChase" ADD CONSTRAINT "EnquiryRaiseChase_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
