-- WhatsApp Cloud API Phase 2 (REBUILD_PLAN §G P2): conversation threads with
-- the transaction mapping + the routed-event link. Additive only.
CREATE TABLE "WhatsAppThread" (
    "id" TEXT NOT NULL,
    "businessNumberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "displayName" TEXT,
    "transactionId" TEXT,
    "side" "WhatsAppSide",
    "contactIds" TEXT[],
    "assignmentState" TEXT NOT NULL DEFAULT 'needs_assigning',
    "candidateTransactionIds" TEXT[],
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "lastPreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "groupSubject" TEXT,
    "groupInviteLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppThread_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppThread_businessNumberId_waId_key" ON "WhatsAppThread"("businessNumberId", "waId");

CREATE INDEX "WhatsAppThread_transactionId_idx" ON "WhatsAppThread"("transactionId");

CREATE INDEX "WhatsAppThread_assignmentState_idx" ON "WhatsAppThread"("assignmentState");

ALTER TABLE "WhatsAppThread" ADD CONSTRAINT "WhatsAppThread_businessNumberId_fkey" FOREIGN KEY ("businessNumberId") REFERENCES "WhatsAppBusinessNumber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppThread" ADD CONSTRAINT "WhatsAppThread_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppCloudEvent" ADD COLUMN "threadId" TEXT;

CREATE INDEX "WhatsAppCloudEvent_threadId_idx" ON "WhatsAppCloudEvent"("threadId");
