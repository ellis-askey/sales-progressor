-- CreateEnum
CREATE TYPE "CheckpointAudience" AS ENUM ('none', 'vendor', 'purchaser', 'both');

-- CreateEnum
CREATE TYPE "CheckpointParty" AS ENUM ('vendor', 'purchaser', 'agent');

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "showTo" "CheckpointAudience" NOT NULL DEFAULT 'none',
    "targetDate" TIMESTAMP(3),
    "blocksExchange" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "lastNudgedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckpointConfirmation" (
    "id" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "party" "CheckpointParty" NOT NULL,
    "confirmedByUserId" TEXT,
    "confirmedByContactId" TEXT,
    "confirmedByName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckpointConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Checkpoint_transactionId_idx" ON "Checkpoint"("transactionId");

-- CreateIndex
CREATE INDEX "CheckpointConfirmation_checkpointId_idx" ON "CheckpointConfirmation"("checkpointId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckpointConfirmation_checkpointId_party_key" ON "CheckpointConfirmation"("checkpointId", "party");

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointConfirmation" ADD CONSTRAINT "CheckpointConfirmation_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "Checkpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointConfirmation" ADD CONSTRAINT "CheckpointConfirmation_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointConfirmation" ADD CONSTRAINT "CheckpointConfirmation_confirmedByContactId_fkey" FOREIGN KEY ("confirmedByContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

