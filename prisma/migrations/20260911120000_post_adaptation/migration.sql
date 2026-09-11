-- Content & Personal Brand, Phase 4.1: per-platform post adaptations.
-- docs/active/content-brand/SPEC.md

-- CreateTable
CREATE TABLE "PostAdaptation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "draftPostId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "treatment" TEXT,
    "text" TEXT NOT NULL,
    "mediaHint" TEXT,

    CONSTRAINT "PostAdaptation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostAdaptation_draftPostId_platform_key" ON "PostAdaptation"("draftPostId", "platform");

-- CreateIndex
CREATE INDEX "PostAdaptation_draftPostId_idx" ON "PostAdaptation"("draftPostId");
