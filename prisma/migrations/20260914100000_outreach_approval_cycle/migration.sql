-- AlterTable
ALTER TABLE "OutreachExperiment" ADD COLUMN     "approvedSnapshot" JSONB,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "editedAfterReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "humanRejectionReason" TEXT,
ADD COLUMN     "lastEditedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedById" TEXT,
ADD COLUMN     "reviewerOverriddenAt" TIMESTAMP(3),
ADD COLUMN     "reviewerOverriddenById" TEXT,
ADD COLUMN     "reviewerOverrideReason" TEXT;

-- AlterTable
ALTER TABLE "AiModelRun" ADD COLUMN     "cycleId" TEXT;

-- CreateTable
CREATE TABLE "StrategyCycle" (
    "id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "failedStage" TEXT,
    "error" TEXT,
    "initiatedById" TEXT,
    "experimentId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrategyCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StrategyCycle_outcome_startedAt_idx" ON "StrategyCycle"("outcome", "startedAt");

-- CreateIndex
CREATE INDEX "StrategyCycle_experimentId_idx" ON "StrategyCycle"("experimentId");

-- CreateIndex
CREATE INDEX "StrategyCycle_startedAt_idx" ON "StrategyCycle"("startedAt");

-- CreateIndex
CREATE INDEX "AiModelRun_cycleId_idx" ON "AiModelRun"("cycleId");

-- AddForeignKey
ALTER TABLE "StrategyCycle" ADD CONSTRAINT "StrategyCycle_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "OutreachExperiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModelRun" ADD CONSTRAINT "AiModelRun_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "StrategyCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

