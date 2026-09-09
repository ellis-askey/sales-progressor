-- Content & Personal Brand, Phase 1.2: brand positioning + brand memory.
-- docs/active/content-brand/SPEC.md

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "primaryIdentity" TEXT NOT NULL DEFAULT '',
    "credibility" TEXT NOT NULL DEFAULT '',
    "personality" TEXT NOT NULL DEFAULT '',
    "associations" TEXT NOT NULL DEFAULT '',
    "desiredReputation" TEXT NOT NULL DEFAULT '',
    "targetAudiences" JSONB,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMemory" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "claimClass" TEXT NOT NULL DEFAULT 'ellis_opinion',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "evidenceRef" JSONB,

    CONSTRAINT "BrandMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandMemory_status_kind_createdAt_idx" ON "BrandMemory"("status", "kind", "createdAt");
