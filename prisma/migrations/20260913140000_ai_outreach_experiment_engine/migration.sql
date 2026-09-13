-- CreateEnum
CREATE TYPE "OutreachExperimentStatus" AS ENUM ('draft', 'awaiting_approval', 'approved', 'running', 'review_ready', 'completed', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "OutreachVariantRole" AS ENUM ('control', 'challenger');

-- CreateEnum
CREATE TYPE "OutreachLearningStatus" AS ENUM ('candidate', 'weak', 'supported', 'disproven');

-- AlterTable
ALTER TABLE "ProspectEmail" ADD COLUMN     "experimentId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- CreateTable
CREATE TABLE "OutreachExperiment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "OutreachExperimentStatus" NOT NULL DEFAULT 'draft',
    "hypothesis" TEXT,
    "rationale" TEXT,
    "targetSegment" JSONB,
    "exclusions" JSONB,
    "sampleSize" INTEGER,
    "allocationPct" INTEGER,
    "primaryMetric" TEXT,
    "secondaryMetrics" JSONB,
    "startDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "strategistReasoning" TEXT,
    "reviewerCritique" TEXT,
    "strategistRevision" TEXT,
    "finalConclusion" TEXT,
    "winnerVariantId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "role" "OutreachVariantRole" NOT NULL,
    "name" TEXT NOT NULL,
    "emails" JSONB NOT NULL,
    "createdByModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAssignment" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachLearning" (
    "id" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "OutreachLearningStatus" NOT NULL DEFAULT 'candidate',
    "evidenceExperimentIds" TEXT[],
    "sampleSize" INTEGER,
    "segment" TEXT,
    "metric" TEXT,
    "evidenceSummary" TEXT,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stillActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachLearning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelRun" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costPence" INTEGER NOT NULL DEFAULT 0,
    "experimentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiModelRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutreachExperiment_status_idx" ON "OutreachExperiment"("status");

-- CreateIndex
CREATE INDEX "OutreachExperiment_reviewDate_idx" ON "OutreachExperiment"("reviewDate");

-- CreateIndex
CREATE INDEX "OutreachVariant_experimentId_idx" ON "OutreachVariant"("experimentId");

-- CreateIndex
CREATE INDEX "OutreachAssignment_prospectId_idx" ON "OutreachAssignment"("prospectId");

-- CreateIndex
CREATE INDEX "OutreachAssignment_variantId_idx" ON "OutreachAssignment"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachAssignment_experimentId_prospectId_key" ON "OutreachAssignment"("experimentId", "prospectId");

-- CreateIndex
CREATE INDEX "OutreachLearning_status_idx" ON "OutreachLearning"("status");

-- CreateIndex
CREATE INDEX "OutreachLearning_stillActive_idx" ON "OutreachLearning"("stillActive");

-- CreateIndex
CREATE INDEX "AiModelRun_experimentId_idx" ON "AiModelRun"("experimentId");

-- CreateIndex
CREATE INDEX "AiModelRun_purpose_createdAt_idx" ON "AiModelRun"("purpose", "createdAt");

-- CreateIndex
CREATE INDEX "ProspectEmail_experimentId_idx" ON "ProspectEmail"("experimentId");

-- AddForeignKey
ALTER TABLE "OutreachVariant" ADD CONSTRAINT "OutreachVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "OutreachExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAssignment" ADD CONSTRAINT "OutreachAssignment_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "OutreachExperiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAssignment" ADD CONSTRAINT "OutreachAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "OutreachVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAssignment" ADD CONSTRAINT "OutreachAssignment_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiModelRun" ADD CONSTRAINT "AiModelRun_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "OutreachExperiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

