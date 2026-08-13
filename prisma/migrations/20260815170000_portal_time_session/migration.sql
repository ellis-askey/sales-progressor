-- Portal-side engaged-time tracking for clients (buyers/sellers). Twin of
-- FileTimeSession but keyed on Contact (token-authenticated) instead of User.
-- No backfill — records from ship date forward. Apply staging-first, verify,
-- then production (Law 3).
CREATE TABLE "PortalTimeSession" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engagementIntervals" JSONB NOT NULL DEFAULT '[]',
    "totalEngagedSeconds" INTEGER,
    "userAgent" TEXT,
    "closedReason" TEXT,

    CONSTRAINT "PortalTimeSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PortalTimeSession_transactionId_contactId_idx" ON "PortalTimeSession"("transactionId", "contactId");
CREATE INDEX "PortalTimeSession_contactId_startedAt_idx" ON "PortalTimeSession"("contactId", "startedAt");
CREATE INDEX "PortalTimeSession_transactionId_startedAt_idx" ON "PortalTimeSession"("transactionId", "startedAt");

ALTER TABLE "PortalTimeSession" ADD CONSTRAINT "PortalTimeSession_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PortalTimeSession" ADD CONSTRAINT "PortalTimeSession_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
