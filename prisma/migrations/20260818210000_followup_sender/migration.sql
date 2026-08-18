-- Follow-up sender: per-file mute + a tap-event log for the Command Centre
-- opened-vs-sent usage view. Applied to staging via db push; this file is for
-- production's `prisma migrate deploy`.

ALTER TABLE "PropertyTransaction" ADD COLUMN "followupNudgesDisabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "FollowupTap" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "contactId" TEXT,
    "side" TEXT NOT NULL,
    "stepCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "tappedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowupTap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FollowupTap_transactionId_idx" ON "FollowupTap"("transactionId");

CREATE INDEX "FollowupTap_tappedAt_idx" ON "FollowupTap"("tappedAt");

ALTER TABLE "FollowupTap" ADD CONSTRAINT "FollowupTap_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
