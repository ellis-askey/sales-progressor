-- Content & Personal Brand, Phase 2.3: rolling quarter focus + brand review.
-- docs/active/content-brand/SPEC.md

-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN "quarterFocus" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "BrandReview" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leanInto" JSONB,
    "overused" JSONB,
    "breakout" JSONB,
    "underusedExpertise" JSONB,
    "summary" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BrandReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrandReview_createdAt_idx" ON "BrandReview"("createdAt");
