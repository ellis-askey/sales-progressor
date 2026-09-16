-- Inbound emails the sync couldn't confidently file (ambiguous or no match).
-- Kept so the agent gets a standing "Needs filing" tray with one-tap
-- file-to-property. Unique (userId, providerMessageId) means a filed/dismissed
-- email never re-queues on the next sync. (Email ingestion v2, Phase E2.)
CREATE TABLE "PendingInboundEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "folder" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "body" TEXT NOT NULL,
    "rawBody" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "candidates" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedTransactionId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingInboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PendingInboundEmail_userId_providerMessageId_key" ON "PendingInboundEmail"("userId", "providerMessageId");
CREATE INDEX "PendingInboundEmail_userId_status_idx" ON "PendingInboundEmail"("userId", "status");
CREATE INDEX "PendingInboundEmail_agencyId_status_idx" ON "PendingInboundEmail"("agencyId", "status");

ALTER TABLE "PendingInboundEmail" ADD CONSTRAINT "PendingInboundEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
