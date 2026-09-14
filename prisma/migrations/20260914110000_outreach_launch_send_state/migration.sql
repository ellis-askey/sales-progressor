-- AlterTable
ALTER TABLE "ProspectEmail" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dispatchStartedAt" TIMESTAMP(3),
ADD COLUMN     "failReason" TEXT,
ADD COLUMN     "sendDedupeKey" TEXT,
ADD COLUMN     "sendState" TEXT;

-- AlterTable
ALTER TABLE "ProspectFlow" ADD COLUMN     "experimentId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "OutreachExperiment" ADD COLUMN     "launchedAt" TIMESTAMP(3),
ADD COLUMN     "launchedById" TEXT;

-- CreateTable
CREATE TABLE "OutreachLaunch" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "launchedById" TEXT,
    "launchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT NOT NULL,
    "requestedSample" INTEGER NOT NULL,
    "eligibleCount" INTEGER NOT NULL,
    "actualSample" INTEGER NOT NULL,
    "assignedControl" INTEGER NOT NULL,
    "assignedChallenger" INTEGER NOT NULL,
    "exclusionCounts" JSONB NOT NULL,
    "initialSent" INTEGER NOT NULL DEFAULT 0,
    "initialFailed" INTEGER NOT NULL DEFAULT 0,
    "initialUncertain" INTEGER NOT NULL DEFAULT 0,
    "initialSuppressed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachLaunch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachLaunch_experimentId_key" ON "OutreachLaunch"("experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectEmail_sendDedupeKey_key" ON "ProspectEmail"("sendDedupeKey");

-- CreateIndex
CREATE INDEX "ProspectEmail_sendState_idx" ON "ProspectEmail"("sendState");

-- CreateIndex
CREATE INDEX "ProspectFlow_experimentId_idx" ON "ProspectFlow"("experimentId");

-- CreateIndex
CREATE INDEX "ProspectFlow_variantId_idx" ON "ProspectFlow"("variantId");

-- AddForeignKey
ALTER TABLE "ProspectFlow" ADD CONSTRAINT "ProspectFlow_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "OutreachExperiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectFlow" ADD CONSTRAINT "ProspectFlow_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "OutreachVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachLaunch" ADD CONSTRAINT "OutreachLaunch_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "OutreachExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

