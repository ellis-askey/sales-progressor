-- Content & Personal Brand, Phase 1.1: Ellis's thoughts capture.
-- docs/active/content-brand/SPEC.md

-- CreateTable
CREATE TABLE "EllisThought" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "topic" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'open',
    "usedInDraftId" TEXT,
    "relatedEvidence" JSONB,

    CONSTRAINT "EllisThought_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EllisThought_status_createdAt_idx" ON "EllisThought"("status", "createdAt");
