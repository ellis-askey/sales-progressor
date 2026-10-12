-- WhatsApp Cloud API Phase 1 (docs/active/whatsapp-rebuild/REBUILD_PLAN.md §G P1):
-- business-number registry (encrypted token at rest) + idempotent raw webhook
-- event store. Additive only; Baileys-era tables untouched.
CREATE TABLE "WhatsAppBusinessNumber" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL DEFAULT 'tsp',
    "ownerId" TEXT,
    "wabaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhone" TEXT,
    "displayName" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "qualityRating" TEXT,
    "messagingTier" TEXT,
    "lastEventAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppBusinessNumber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppBusinessNumber_phoneNumberId_key" ON "WhatsAppBusinessNumber"("phoneNumberId");

CREATE TABLE "WhatsAppCloudEvent" (
    "id" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wamid" TEXT,
    "waFrom" TEXT,
    "status" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppCloudEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppCloudEvent_dedupKey_key" ON "WhatsAppCloudEvent"("dedupKey");

CREATE INDEX "WhatsAppCloudEvent_phoneNumberId_receivedAt_idx" ON "WhatsAppCloudEvent"("phoneNumberId", "receivedAt");

CREATE INDEX "WhatsAppCloudEvent_wamid_idx" ON "WhatsAppCloudEvent"("wamid");

CREATE INDEX "WhatsAppCloudEvent_processedAt_idx" ON "WhatsAppCloudEvent"("processedAt");
