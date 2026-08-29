-- CreateTable
CREATE TABLE "ProspectEmail" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "contactId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html" TEXT,
    "templateKey" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "replyToken" TEXT,
    "sgMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "bouncedReason" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "ProspectEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectEmail_replyToken_key" ON "ProspectEmail"("replyToken");

-- CreateIndex
CREATE INDEX "ProspectEmail_prospectId_sentAt_idx" ON "ProspectEmail"("prospectId", "sentAt");

-- CreateIndex
CREATE INDEX "ProspectEmail_replyToken_idx" ON "ProspectEmail"("replyToken");

-- CreateIndex
CREATE INDEX "ProspectEmail_sgMessageId_idx" ON "ProspectEmail"("sgMessageId");

-- AddForeignKey
ALTER TABLE "ProspectEmail" ADD CONSTRAINT "ProspectEmail_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
