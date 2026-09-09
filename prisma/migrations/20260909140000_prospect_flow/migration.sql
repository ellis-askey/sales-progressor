-- CreateTable
CREATE TABLE "ProspectFlow" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "haltedReason" TEXT,
    "startedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectFlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledFor" TIMESTAMP(3),
    "contactId" TEXT,
    "toEmail" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "prospectEmailId" TEXT,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectFlowStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectFlow_prospectId_idx" ON "ProspectFlow"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectFlow_status_idx" ON "ProspectFlow"("status");

-- CreateIndex
CREATE INDEX "ProspectFlowStep_flowId_stepIndex_idx" ON "ProspectFlowStep"("flowId", "stepIndex");

-- CreateIndex
CREATE INDEX "ProspectFlowStep_status_scheduledFor_idx" ON "ProspectFlowStep"("status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "ProspectFlow" ADD CONSTRAINT "ProspectFlow_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectFlowStep" ADD CONSTRAINT "ProspectFlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "ProspectFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
