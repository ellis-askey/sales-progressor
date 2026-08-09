-- Solicitor confirmation emails — Stage 1 groundwork.
--
-- Additive only. Adds:
--   1. Four per-party email pause flags on PropertyTransaction (seller / buyer /
--      seller's firm / buyer's firm), replacing the single clientEmailsPaused.
--   2. Solicitor-confirmer attribution columns on MilestoneCompletion, so a step
--      confirmed via a solicitor's /s/<token> link records "confirmed by {firm}".
--   3. SolicitorChaseState — per-(file, side, milestone) chase state driving the
--      softer solicitor cadence (mirrors ClientChaseState).
--   4. SolicitorChaseSettings — global singleton holding the editable cadence.
--
-- clientEmailsPaused is retained until its consumers migrate to the new flags
-- (Stage 4), then dropped. See docs/active/solicitor-confirm/scope.md.

-- AlterTable
ALTER TABLE "PropertyTransaction" ADD COLUMN     "purchaserEmailsPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "purchaserSolicitorEmailsPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendorEmailsPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendorSolicitorEmailsPaused" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: today's single clientEmailsPaused pauses BOTH client sides. The two
-- solicitor flags start false (the feature is new — nobody has opted out yet).
UPDATE "PropertyTransaction"
   SET "vendorEmailsPaused" = "clientEmailsPaused",
       "purchaserEmailsPaused" = "clientEmailsPaused";

-- AlterTable
ALTER TABLE "MilestoneCompletion" ADD COLUMN     "confirmedBySolicitorContactId" TEXT,
ADD COLUMN     "confirmedBySolicitorFirmId" TEXT;

-- CreateTable
CREATE TABLE "SolicitorChaseState" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "side" "MilestoneSide" NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "chaseCount" INTEGER NOT NULL DEFAULT 0,
    "firstChasedAt" TIMESTAMP(3),
    "lastChasedAt" TIMESTAMP(3),
    "snoozeUntil" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitorChaseState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitorChaseSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "enabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "graceWorkingDays" INTEGER NOT NULL DEFAULT 5,
    "repeatDays" INTEGER NOT NULL DEFAULT 7,
    "maxChases" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SolicitorChaseSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitorChaseState_status_lastChasedAt_idx" ON "SolicitorChaseState"("status", "lastChasedAt");

-- CreateIndex
CREATE INDEX "SolicitorChaseState_transactionId_idx" ON "SolicitorChaseState"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitorChaseState_transactionId_side_milestoneCode_key" ON "SolicitorChaseState"("transactionId", "side", "milestoneCode");

-- AddForeignKey
ALTER TABLE "MilestoneCompletion" ADD CONSTRAINT "MilestoneCompletion_confirmedBySolicitorFirmId_fkey" FOREIGN KEY ("confirmedBySolicitorFirmId") REFERENCES "SolicitorFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneCompletion" ADD CONSTRAINT "MilestoneCompletion_confirmedBySolicitorContactId_fkey" FOREIGN KEY ("confirmedBySolicitorContactId") REFERENCES "SolicitorContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitorChaseState" ADD CONSTRAINT "SolicitorChaseState_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
