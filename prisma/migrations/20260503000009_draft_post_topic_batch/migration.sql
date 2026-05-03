-- Add topicId and batchId to DraftPost
ALTER TABLE "DraftPost" ADD COLUMN IF NOT EXISTS "topicId" TEXT;
ALTER TABLE "DraftPost" ADD COLUMN IF NOT EXISTS "batchId" TEXT;

CREATE INDEX IF NOT EXISTS "DraftPost_topicId_idx" ON "DraftPost"("topicId");
