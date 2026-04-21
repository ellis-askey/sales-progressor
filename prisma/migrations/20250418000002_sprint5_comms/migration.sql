-- Sprint 5: CommunicationRecord + summaryTemplate + summaryText

-- Add summaryTemplate to MilestoneDefinition
ALTER TABLE "MilestoneDefinition" ADD COLUMN "summaryTemplate" TEXT NOT NULL DEFAULT '';

-- Add summaryText to MilestoneCompletion
ALTER TABLE "MilestoneCompletion" ADD COLUMN "summaryText" TEXT;
CREATE INDEX "MilestoneCompletion_transactionId_completedAt_idx" ON "MilestoneCompletion"("transactionId", "completedAt");

-- CommunicationRecord enums
CREATE TYPE "CommType" AS ENUM ('internal_note', 'outbound', 'inbound');
CREATE TYPE "CommMethod" AS ENUM ('email', 'phone', 'sms', 'voicemail', 'whatsapp', 'post');

-- CommunicationRecord table
CREATE TABLE "CommunicationRecord" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "type" "CommType" NOT NULL,
    "method" "CommMethod",
    "contactIds" TEXT[] NOT NULL DEFAULT '{}',
    "content" TEXT NOT NULL,
    "ccEmails" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CommunicationRecord_transactionId_createdAt_idx" ON "CommunicationRecord"("transactionId", "createdAt");

ALTER TABLE "CommunicationRecord"
    ADD CONSTRAINT "CommunicationRecord_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommunicationRecord"
    ADD CONSTRAINT "CommunicationRecord_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
