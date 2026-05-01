-- Add retention email opt-out to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "retentionEmailOptOut" BOOLEAN NOT NULL DEFAULT false;

-- Create RetentionEmailLog table
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
-- ^ for future admin dashboard — see future-admin-page ticket
