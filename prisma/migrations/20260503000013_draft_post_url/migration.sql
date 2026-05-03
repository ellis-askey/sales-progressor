-- Add optional post URL to DraftPost (filled when marking as posted)
ALTER TABLE "DraftPost" ADD COLUMN "postedUrl" TEXT;
