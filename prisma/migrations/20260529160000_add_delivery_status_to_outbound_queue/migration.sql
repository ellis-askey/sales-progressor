-- SendGrid Event Webhook delivery-status columns on OutboundEmailQueue.
-- Populated by /api/webhooks/sendgrid-bounce when delivery / deferred /
-- bounce / blocked / dropped events fire for a message we sent with
-- customArgs.queueId. sentAt = handed to SendGrid; these = what actually
-- happened after. All nullable so existing rows continue to read as
-- "Sent (status unknown)" until they age out.

ALTER TABLE "OutboundEmailQueue"
  ADD COLUMN "deliveredAt"    TIMESTAMP(3),
  ADD COLUMN "deferredAt"     TIMESTAMP(3),
  ADD COLUMN "deferredCount"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deferredReason" TEXT,
  ADD COLUMN "bouncedAt"      TIMESTAMP(3),
  ADD COLUMN "bouncedReason"  TEXT,
  ADD COLUMN "blockedAt"      TIMESTAMP(3),
  ADD COLUMN "blockedReason"  TEXT;
