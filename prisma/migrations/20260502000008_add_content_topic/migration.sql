-- CreateTable
CREATE TABLE "ContentTopic" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "channelHint" "DraftChannel",
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "usedAt" TIMESTAMP(3),
    "draftPostId" TEXT,

    CONSTRAINT "ContentTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentTopic_status_priority_createdAt_idx" ON "ContentTopic"("status", "priority", "createdAt");
