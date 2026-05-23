-- Chain withdrawal cascade v1 — step-wise, directional, recipient-framed.
--
-- The previous ChainNotificationQueue shape was built for a flat
-- "broadcast to all claimed mates" model that was never used in production.
-- This migration cleanly recreates the table for the step-wise cascade:
-- one row per directional notification, with per-row response state so an
-- agent can hold multiple in-flight notifications independently.
--
-- Pre-flight: aborts if the table has rows in any environment (would not
-- silently drop real data). Both staging and production were verified empty
-- before this migration was authored.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ChainNotificationQueue" LIMIT 1) THEN
    RAISE EXCEPTION 'ChainNotificationQueue has rows; clean recreate would lose data. Aborting.';
  END IF;
END $$;

-- Extend the existing withdrawal-status enum with BREAK_CHAIN. This is the
-- "proceed without onward purchase" response that's only offered downward.
ALTER TYPE "ChainWithdrawalStatus" ADD VALUE IF NOT EXISTS 'BREAK_CHAIN';

-- New enums for the notification rows.
CREATE TYPE "ChainNotificationType" AS ENUM ('LOST_BUYER', 'LOST_PURCHASE', 'ASKED_TO_WAIT');
CREATE TYPE "ChainDirection" AS ENUM ('UPWARD', 'DOWNWARD');

-- Recreate the queue with the new shape.
DROP TABLE "ChainNotificationQueue";

CREATE TABLE "ChainNotificationQueue" (
    "id"               TEXT                    NOT NULL,
    "chainId"          TEXT                    NOT NULL,
    "triggeringLinkId" TEXT                    NOT NULL,
    "recipientLinkId"  TEXT                    NOT NULL,
    "recipientUserId"  TEXT                    NOT NULL,
    "recipientEmail"   TEXT                    NOT NULL,
    "type"             "ChainNotificationType" NOT NULL,
    "direction"        "ChainDirection"        NOT NULL,
    "emailSentAt"      TIMESTAMP(3),
    "response"         "ChainWithdrawalStatus",
    "respondedAt"      TIMESTAMP(3),
    "nudgeSentAt"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainNotificationQueue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChainNotificationQueue_recipientUserId_response_idx"
  ON "ChainNotificationQueue"("recipientUserId", "response");
CREATE INDEX "ChainNotificationQueue_response_respondedAt_idx"
  ON "ChainNotificationQueue"("response", "respondedAt");
CREATE INDEX "ChainNotificationQueue_chainId_idx"
  ON "ChainNotificationQueue"("chainId");
CREATE INDEX "ChainNotificationQueue_recipientLinkId_idx"
  ON "ChainNotificationQueue"("recipientLinkId");

ALTER TABLE "ChainNotificationQueue" ADD CONSTRAINT "ChainNotificationQueue_chainId_fkey"
  FOREIGN KEY ("chainId") REFERENCES "PropertyChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChainNotificationQueue" ADD CONSTRAINT "ChainNotificationQueue_triggeringLinkId_fkey"
  FOREIGN KEY ("triggeringLinkId") REFERENCES "ChainLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChainNotificationQueue" ADD CONSTRAINT "ChainNotificationQueue_recipientLinkId_fkey"
  FOREIGN KEY ("recipientLinkId") REFERENCES "ChainLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChainNotificationQueue" ADD CONSTRAINT "ChainNotificationQueue_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
