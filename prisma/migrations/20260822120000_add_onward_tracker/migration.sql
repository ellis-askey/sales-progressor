-- Onward-Purchase Visibility arc — Stage 1
-- Adds the "shadow tracker" that holds a seller's REPORTED onward-purchase
-- progress on their own sale file. Purely additive: two new tables + two new
-- enums, no change to any existing table (the PropertyTransaction relation is
-- virtual — the FK lives on OnwardTracker.transactionId).
-- Spec: docs/active/onward-visibility/00-discovery.md

-- CreateEnum
CREATE TYPE "OnwardTrackerStatus" AS ENUM ('active', 'exchanged', 'completed', 'abandoned', 'superseded');

-- CreateEnum
CREATE TYPE "OnwardConfirmSource" AS ENUM ('seller', 'agent');

-- CreateTable
CREATE TABLE "OnwardTracker" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "tenure" "Tenure",
    "purchaseType" "PurchaseType",
    "isShareOfFreehold" BOOLEAN NOT NULL DEFAULT false,
    "status" "OnwardTrackerStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnwardTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnwardStepConfirmation" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "source" "OnwardConfirmSource" NOT NULL,
    "confirmedByContactId" TEXT,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnwardStepConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnwardTracker_transactionId_key" ON "OnwardTracker"("transactionId");

-- CreateIndex
CREATE INDEX "OnwardStepConfirmation_trackerId_idx" ON "OnwardStepConfirmation"("trackerId");

-- CreateIndex
CREATE UNIQUE INDEX "OnwardStepConfirmation_trackerId_milestoneCode_key" ON "OnwardStepConfirmation"("trackerId", "milestoneCode");

-- AddForeignKey
ALTER TABLE "OnwardTracker" ADD CONSTRAINT "OnwardTracker_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnwardStepConfirmation" ADD CONSTRAINT "OnwardStepConfirmation_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "OnwardTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
