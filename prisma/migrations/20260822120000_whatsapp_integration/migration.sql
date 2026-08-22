-- WhatsApp integration (unofficial linked-device bridge). See docs/WHATSAPP_INTEGRATION.md.

-- CreateEnum
CREATE TYPE "WhatsAppSide" AS ENUM ('BUYER', 'SELLER');

-- CreateTable
CREATE TABLE "WhatsAppConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_qr',
    "lastSeenAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppGroupMapping" (
    "id" TEXT NOT NULL,
    "waChatId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "side" "WhatsAppSide" NOT NULL,
    "groupNameAtMatch" TEXT,
    "matchMethod" TEXT NOT NULL DEFAULT 'name_auto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppPendingMessage" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "waChatId" TEXT NOT NULL,
    "isGroup" BOOLEAN NOT NULL,
    "groupName" TEXT,
    "senderPhone" TEXT,
    "senderName" TEXT,
    "fromMe" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT,
    "mediaMeta" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "candidateTransactionIds" TEXT[],
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppPendingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppConnection_userId_phoneNumber_key" ON "WhatsAppConnection"("userId", "phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppGroupMapping_waChatId_key" ON "WhatsAppGroupMapping"("waChatId");

-- CreateIndex
CREATE INDEX "WhatsAppGroupMapping_transactionId_idx" ON "WhatsAppGroupMapping"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppPendingMessage_waMessageId_key" ON "WhatsAppPendingMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppPendingMessage_waChatId_idx" ON "WhatsAppPendingMessage"("waChatId");

-- CreateIndex
CREATE INDEX "WhatsAppPendingMessage_createdAt_idx" ON "WhatsAppPendingMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppConnection" ADD CONSTRAINT "WhatsAppConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppGroupMapping" ADD CONSTRAINT "WhatsAppGroupMapping_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
