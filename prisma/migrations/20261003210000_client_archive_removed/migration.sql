-- Soft-remove (archive) for progression-business clients. Removing a client now
-- sets removedAt instead of deleting the ProgressionBusinessClient link: the rate
-- card + history survive and the owner can reinstate. NULL = active client.
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN "removedAt" TIMESTAMP(3);
