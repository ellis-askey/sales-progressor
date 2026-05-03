-- Add approvedForBatch flag to DraftPost
ALTER TABLE "DraftPost" ADD COLUMN "approvedForBatch" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "DraftPost_approvedForBatch_idx" ON "DraftPost"("approvedForBatch");

-- ContentBatch — daily digest grouping
CREATE TABLE "ContentBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "itemCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContentBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentBatch_date_key" ON "ContentBatch"("date");
CREATE INDEX "ContentBatch_date_idx" ON "ContentBatch"("date");
