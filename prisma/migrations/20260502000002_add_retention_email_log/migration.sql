-- Migration: add_retention_email_log
-- Promotes the loose retention_email_log.sql into a tracked migration.
-- Both statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "retentionEmailOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "RetentionEmailLog" (
  "id"       TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId"   TEXT NOT NULL,
  "emailKey" TEXT NOT NULL,
  "sentAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "agencyId" TEXT NOT NULL,
  CONSTRAINT "RetentionEmailLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetentionEmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RetentionEmailLog_userId_emailKey_idx" ON "RetentionEmailLog"("userId", "emailKey");
CREATE INDEX IF NOT EXISTS "RetentionEmailLog_agencyId_sentAt_idx" ON "RetentionEmailLog"("agencyId", "sentAt");
CREATE INDEX IF NOT EXISTS "RetentionEmailLog_emailKey_sentAt_idx" ON "RetentionEmailLog"("emailKey", "sentAt");
