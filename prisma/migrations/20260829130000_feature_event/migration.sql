-- CreateTable
CREATE TABLE "FeatureEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feature" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "transactionId" TEXT,
    "agencyId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "FeatureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureEvent_feature_occurredAt_idx" ON "FeatureEvent"("feature", "occurredAt");

-- CreateIndex
CREATE INDEX "FeatureEvent_occurredAt_idx" ON "FeatureEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "FeatureEvent_transactionId_idx" ON "FeatureEvent"("transactionId");

-- CreateIndex
CREATE INDEX "FeatureEvent_agencyId_occurredAt_idx" ON "FeatureEvent"("agencyId", "occurredAt");
