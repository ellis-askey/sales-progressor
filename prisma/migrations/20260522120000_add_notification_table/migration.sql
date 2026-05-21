-- Per-user, per-event notification queue. Distinct from SystemNotification
-- (which is a one-shot platform flag table with no userId). Used by the
-- Sales Progressor bell on the internal dashboard to surface confirmation
-- events on files assigned to the current SP. Replaces the content-pattern
-- matching against OutboundMessage rows that the SPBell used previously.

CREATE TABLE "Notification" (
    "id"            TEXT NOT NULL,
    "userId"        TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "transactionId" TEXT,
    "payload"       JSONB NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt"        TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
  ON "Notification"("userId", "readAt", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
