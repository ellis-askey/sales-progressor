-- CreateTable
CREATE TABLE "ChainNotificationQueue" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "withdrawingTransactionId" TEXT NOT NULL,
    "withdrawingUserId" TEXT,
    "withdrawingReason" TEXT,
    "recipientUserId" TEXT NOT NULL,
    "recipientLinkId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ChainNotificationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChainNotificationQueue_withdrawingTransactionId_recipientUserId_key" ON "ChainNotificationQueue"("withdrawingTransactionId", "recipientUserId");

-- CreateIndex
CREATE INDEX "ChainNotificationQueue_notifiedAt_idx" ON "ChainNotificationQueue"("notifiedAt");

-- CreateIndex
CREATE INDEX "ChainNotificationQueue_withdrawingTransactionId_idx" ON "ChainNotificationQueue"("withdrawingTransactionId");
