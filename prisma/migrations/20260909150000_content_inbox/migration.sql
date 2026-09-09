-- Content & Personal Brand, Phase 1.3: the content inbox.
-- docs/active/content-brand/SPEC.md

-- CreateTable
CREATE TABLE "ContentInboxItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "whyInteresting" TEXT NOT NULL DEFAULT '',
    "brandFit" TEXT,
    "reachReason" TEXT,
    "claimClass" TEXT NOT NULL DEFAULT 'inference',
    "likelyAudience" JSONB,
    "suggestedAngles" JSONB,
    "evidence" JSONB,
    "freshnessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'new',
    "decidedAt" TIMESTAMP(3),
    "sourceSignalId" TEXT,
    "sourceThoughtId" TEXT,
    "topicId" TEXT,
    "draftPostId" TEXT,

    CONSTRAINT "ContentInboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentInboxItem_dedupeKey_key" ON "ContentInboxItem"("dedupeKey");

-- CreateIndex
CREATE INDEX "ContentInboxItem_status_freshnessAt_idx" ON "ContentInboxItem"("status", "freshnessAt");
