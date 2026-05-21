-- Add SystemNotification table for one-shot platform-level event flags.
-- First user: the "medians_ready" notification fired by /api/cron/medians-ready-check
-- when enough completed milestones have accumulated to swap the hardcoded
-- MILESTONE_DURATION_MEDIANS in lib/services/fees.ts for learned values.
-- Generic enough to reuse for future one-shot notifications (key is unique).

CREATE TABLE "SystemNotification" (
    "id"        TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "firedAt"   TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SystemNotification_key_key" ON "SystemNotification"("key");
