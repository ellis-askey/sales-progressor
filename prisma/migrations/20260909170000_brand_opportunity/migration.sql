-- Content & Personal Brand, Phase 2.1: brand opportunities.
-- docs/active/content-brand/SPEC.md

-- CreateTable
CREATE TABLE "BrandOpportunity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "suggestedAction" TEXT NOT NULL DEFAULT '',
    "audience" JSONB,
    "effort" TEXT,
    "horizon" TEXT,
    "brandFit" TEXT,
    "claimClass" TEXT NOT NULL DEFAULT 'inference',
    "evidence" JSONB,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "decidedAt" TIMESTAMP(3),
    "sourceSignalId" TEXT,
    "draftPostId" TEXT,

    CONSTRAINT "BrandOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandOpportunity_dedupeKey_key" ON "BrandOpportunity"("dedupeKey");

-- CreateIndex
CREATE INDEX "BrandOpportunity_status_createdAt_idx" ON "BrandOpportunity"("status", "createdAt");
