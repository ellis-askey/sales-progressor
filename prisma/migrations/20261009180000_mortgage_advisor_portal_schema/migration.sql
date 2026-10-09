-- Mortgage Advisor Portal — Phase 0 (schema only, no behaviour change).
-- Mirrors the solicitor side onto the existing broker models.

-- AlterTable: per-agency + per-business advisor chase switches
ALTER TABLE "Agency" ADD COLUMN "advisorChaseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "chaseAdvisorsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: broker handler parity with solicitor handler
ALTER TABLE "BrokerContact" ADD COLUMN "secondaryEmail" TEXT;
ALTER TABLE "BrokerContact" ADD COLUMN "image" TEXT;

-- AlterTable: per-side advisor email pause flags on the file
ALTER TABLE "PropertyTransaction" ADD COLUMN "buyerBrokerEmailsPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PropertyTransaction" ADD COLUMN "buyerBrokerEmailsPausedUntil" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "onwardBrokerEmailsPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PropertyTransaction" ADD COLUMN "onwardBrokerEmailsPausedUntil" TIMESTAMP(3);

-- AlterTable: broker confirmer attribution on milestone completions
ALTER TABLE "MilestoneCompletion" ADD COLUMN "confirmedByBrokerFirmId" TEXT;
ALTER TABLE "MilestoneCompletion" ADD COLUMN "confirmedByBrokerContactId" TEXT;

-- CreateTable: per-agency broker CC override
CREATE TABLE "BrokerContactAgencyOverride" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "brokerContactId" TEXT NOT NULL,
    "secondaryEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BrokerContactAgencyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable: advisor chase state
CREATE TABLE "AdvisorChaseState" (
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
    CONSTRAINT "AdvisorChaseState_pkey" PRIMARY KEY ("id")
);

-- CreateTable: advisor portal notification store (the login-free "bell")
CREATE TABLE "BrokerNotification" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "side" "MilestoneSide" NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "BrokerNotification_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "BrokerContactAgencyOverride_agencyId_brokerContactId_key" ON "BrokerContactAgencyOverride"("agencyId", "brokerContactId");
CREATE INDEX "BrokerContactAgencyOverride_brokerContactId_idx" ON "BrokerContactAgencyOverride"("brokerContactId");
CREATE UNIQUE INDEX "AdvisorChaseState_transactionId_side_milestoneCode_key" ON "AdvisorChaseState"("transactionId", "side", "milestoneCode");
CREATE INDEX "AdvisorChaseState_status_lastChasedAt_idx" ON "AdvisorChaseState"("status", "lastChasedAt");
CREATE INDEX "AdvisorChaseState_transactionId_idx" ON "AdvisorChaseState"("transactionId");
CREATE INDEX "BrokerNotification_transactionId_side_readAt_createdAt_idx" ON "BrokerNotification"("transactionId", "side", "readAt", "createdAt");

-- Foreign keys
ALTER TABLE "BrokerContactAgencyOverride" ADD CONSTRAINT "BrokerContactAgencyOverride_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerContactAgencyOverride" ADD CONSTRAINT "BrokerContactAgencyOverride_brokerContactId_fkey" FOREIGN KEY ("brokerContactId") REFERENCES "BrokerContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdvisorChaseState" ADD CONSTRAINT "AdvisorChaseState_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BrokerNotification" ADD CONSTRAINT "BrokerNotification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneCompletion" ADD CONSTRAINT "MilestoneCompletion_confirmedByBrokerFirmId_fkey" FOREIGN KEY ("confirmedByBrokerFirmId") REFERENCES "BrokerFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MilestoneCompletion" ADD CONSTRAINT "MilestoneCompletion_confirmedByBrokerContactId_fkey" FOREIGN KEY ("confirmedByBrokerContactId") REFERENCES "BrokerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
