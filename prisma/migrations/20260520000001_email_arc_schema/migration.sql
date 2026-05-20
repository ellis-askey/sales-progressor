-- Email Arc — Schema migrations
-- Apply to STAGING first, verify, then PRODUCTION.
-- All additive and non-breaking. No data loss risk.

-- User: global email opt-out timestamp
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailUnsubscribedAt" TIMESTAMP(3);

-- ChainLink: invite-specific opt-out timestamp (Model A — invite email only)
ALTER TABLE "ChainLink" ADD COLUMN IF NOT EXISTS "inviteUnsubscribedAt" TIMESTAMP(3);

-- PropertyChain: once-per-chain celebration guard
ALTER TABLE "PropertyChain" ADD COLUMN IF NOT EXISTS "celebrationSentAt" TIMESTAMP(3);

-- OutboundEmailQueue: quiet-hours scheduling for milestone + celebration emails
CREATE TABLE IF NOT EXISTS "OutboundEmailQueue" (
    "id"              TEXT NOT NULL,
    "emailType"       TEXT NOT NULL,
    "sourceId"        TEXT NOT NULL,
    "recipientEmail"  TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "payload"         JSONB NOT NULL,
    "scheduledFor"    TIMESTAMP(3) NOT NULL,
    "sentAt"          TIMESTAMP(3),
    "errorAt"         TIMESTAMP(3),
    "errorMessage"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OutboundEmailQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OutboundEmailQueue_dedup"
    ON "OutboundEmailQueue" ("emailType", "sourceId", "recipientUserId");

CREATE INDEX IF NOT EXISTS "OutboundEmailQueue_drain"
    ON "OutboundEmailQueue" ("sentAt", "scheduledFor");
