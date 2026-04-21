-- Sprint 2: MilestoneDefinition + MilestoneCompletion

CREATE TYPE "MilestoneSide" AS ENUM ('vendor', 'purchaser');

CREATE TABLE "MilestoneDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "side" "MilestoneSide" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "blocksExchange" BOOLEAN NOT NULL DEFAULT true,
    "timeSensitive" BOOLEAN NOT NULL DEFAULT false,
    "isExchangeGate" BOOLEAN NOT NULL DEFAULT false,
    "isPostExchange" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MilestoneDefinition_code_key" ON "MilestoneDefinition"("code");

CREATE TABLE "MilestoneCompletion" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "milestoneDefinitionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventDate" TIMESTAMP(3),
    "isNotRequired" BOOLEAN NOT NULL DEFAULT false,
    "notRequiredReason" TEXT,
    "completedById" TEXT,
    "statusReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilestoneCompletion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MilestoneCompletion_transactionId_milestoneDefinitionId_idx"
    ON "MilestoneCompletion"("transactionId", "milestoneDefinitionId");

ALTER TABLE "MilestoneCompletion"
    ADD CONSTRAINT "MilestoneCompletion_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MilestoneCompletion"
    ADD CONSTRAINT "MilestoneCompletion_milestoneDefinitionId_fkey"
    FOREIGN KEY ("milestoneDefinitionId") REFERENCES "MilestoneDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MilestoneCompletion"
    ADD CONSTRAINT "MilestoneCompletion_completedById_fkey"
    FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
