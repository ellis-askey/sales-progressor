-- ContentEngagement — manual engagement metrics logged ~14 days after posting
CREATE TABLE "ContentEngagement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "draftPostId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER,
    "clicks" INTEGER,
    "notes" TEXT,

    CONSTRAINT "ContentEngagement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentEngagement_draftPostId_key" ON "ContentEngagement"("draftPostId");
CREATE INDEX "ContentEngagement_draftPostId_idx" ON "ContentEngagement"("draftPostId");
CREATE INDEX "ContentEngagement_createdAt_idx" ON "ContentEngagement"("createdAt");
