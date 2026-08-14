-- CreateEnum
CREATE TYPE "EnquiryCourt" AS ENUM ('seller_solicitor', 'buyer_solicitor');

-- CreateEnum
CREATE TYPE "EnquiryMovementSource" AS ENUM ('progressor', 'buyer_report', 'seller_report', 'solicitor_reply');

-- CreateEnum
CREATE TYPE "EnquiryMovementStatus" AS ENUM ('pending', 'accepted', 'dismissed');

-- CreateTable
CREATE TABLE "EnquiryTracker" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "currentlyWith" "EnquiryCourt" NOT NULL DEFAULT 'seller_solicitor',
    "outstandingNote" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMovementAt" TIMESTAMP(3),
    "lastChasedAt" TIMESTAMP(3),
    "chaseCount" INTEGER NOT NULL DEFAULT 0,
    "escalatedAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnquiryTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryMovement" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "EnquiryMovementSource" NOT NULL,
    "flipsCourtTo" "EnquiryCourt",
    "status" "EnquiryMovementStatus" NOT NULL DEFAULT 'accepted',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryTracker_transactionId_key" ON "EnquiryTracker"("transactionId");

-- CreateIndex
CREATE INDEX "EnquiryTracker_currentlyWith_closedAt_idx" ON "EnquiryTracker"("currentlyWith", "closedAt");

-- CreateIndex
CREATE INDEX "EnquiryTracker_closedAt_lastMovementAt_idx" ON "EnquiryTracker"("closedAt", "lastMovementAt");

-- CreateIndex
CREATE INDEX "EnquiryMovement_trackerId_occurredAt_idx" ON "EnquiryMovement"("trackerId", "occurredAt");

-- CreateIndex
CREATE INDEX "EnquiryMovement_status_idx" ON "EnquiryMovement"("status");

-- AddForeignKey
ALTER TABLE "EnquiryTracker" ADD CONSTRAINT "EnquiryTracker_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryMovement" ADD CONSTRAINT "EnquiryMovement_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "EnquiryTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
