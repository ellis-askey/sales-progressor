-- Client-portal document taxonomy + cross-side sharing (Batch 2).
ALTER TABLE "TransactionDocument" ADD COLUMN "docType" TEXT;
ALTER TABLE "TransactionDocument" ADD COLUMN "sharedWithOtherSide" BOOLEAN NOT NULL DEFAULT false;
