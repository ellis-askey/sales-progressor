-- Tier 3 stage 2: inbound-email interpretation → proposed file updates awaiting
-- human approval. Also marks an inbound email once interpreted.
ALTER TABLE "OutboundMessage" ADD COLUMN "aiInterpretedAt" TIMESTAMP(3);

CREATE TABLE "MilestoneProposal" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "agencyId" TEXT,
    "sourceMessageId" TEXT,
    "actionType" TEXT NOT NULL,
    "milestoneCode" TEXT,
    "milestoneDefinitionId" TEXT,
    "noteText" TEXT,
    "summary" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "emailFrom" TEXT,
    "emailSubject" TEXT,
    "emailSnippet" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MilestoneProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MilestoneProposal_status_createdAt_idx" ON "MilestoneProposal"("status", "createdAt");
CREATE INDEX "MilestoneProposal_transactionId_idx" ON "MilestoneProposal"("transactionId");

ALTER TABLE "MilestoneProposal" ADD CONSTRAINT "MilestoneProposal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
