-- Enquiries-chase experiment: a log of every chase email sent, with whether the
-- recipient opened the link, acted (and how), or replied by email (a manual
-- founder tick). Powers the Command Centre experiment board.

-- CreateEnum
CREATE TYPE "ChaseSendKind" AS ENUM ('raise', 'reply_loop');
CREATE TYPE "ChaseSendRecipient" AS ENUM ('buyer', 'seller_solicitor', 'buyer_solicitor');
CREATE TYPE "ChaseResponseType" AS ENUM ('update', 'date', 'confirm');

-- CreateTable
CREATE TABLE "ChaseSend" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "kind" "ChaseSendKind" NOT NULL,
    "recipient" "ChaseSendRecipient" NOT NULL,
    "recipientName" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "responseType" "ChaseResponseType",
    "repliedByEmailAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaseSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChaseSend_sentAt_idx" ON "ChaseSend"("sentAt");
CREATE INDEX "ChaseSend_transactionId_idx" ON "ChaseSend"("transactionId");
CREATE INDEX "ChaseSend_kind_sentAt_idx" ON "ChaseSend"("kind", "sentAt");

-- AddForeignKey
ALTER TABLE "ChaseSend" ADD CONSTRAINT "ChaseSend_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
