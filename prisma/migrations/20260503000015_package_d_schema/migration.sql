-- Package D: outsourced workflow schema additions
-- Apply to staging first (npx prisma migrate deploy with staging DATABASE_URL).
-- Do not apply to production until staging verification passes (CHECKPOINT P1).

-- Add assignedAt to PropertyTransaction
-- Nullable — back-filled only on future assignments; existing rows stay null.
ALTER TABLE "PropertyTransaction" ADD COLUMN "assignedAt" TIMESTAMP(3);

-- OutsourcedAssignmentNotification
-- Idempotency record for the "new outsourced file" admin email notification.
-- One row per transaction lifetime. If row exists, notification has already fired.
CREATE TABLE "OutsourcedAssignmentNotification" (
    "id"             TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId"  TEXT NOT NULL,
    "sentAt"         TIMESTAMP(3) NOT NULL,
    "recipientEmail" TEXT NOT NULL,

    CONSTRAINT "OutsourcedAssignmentNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OutsourcedAssignmentNotification_transactionId_key"
    ON "OutsourcedAssignmentNotification"("transactionId");

CREATE INDEX "OutsourcedAssignmentNotification_sentAt_idx"
    ON "OutsourcedAssignmentNotification"("sentAt");

ALTER TABLE "OutsourcedAssignmentNotification"
    ADD CONSTRAINT "OutsourcedAssignmentNotification_transactionId_fkey"
    FOREIGN KEY ("transactionId")
    REFERENCES "PropertyTransaction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
