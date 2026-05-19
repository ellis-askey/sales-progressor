-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN "createdByRole" TEXT;

-- Backfill: record the current role for all existing messages that have a creator.
-- This is a best-effort backfill — role at time of logging is not recoverable for old
-- records, so we store the user's current role as an approximation.
UPDATE "OutboundMessage" om
SET "createdByRole" = u.role
FROM "User" u
WHERE om."createdById" = u.id
  AND om."createdByRole" IS NULL;
