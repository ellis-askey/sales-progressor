-- CreateEnum
CREATE TYPE "EmailTemplateScope" AS ENUM ('personal', 'company');

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "scope" "EmailTemplateScope" NOT NULL,
    "agencyId" TEXT,
    "progressionBusinessId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailTemplate_agencyId_idx" ON "EmailTemplate"("agencyId");

-- CreateIndex
CREATE INDEX "EmailTemplate_progressionBusinessId_idx" ON "EmailTemplate"("progressionBusinessId");

-- CreateIndex
CREATE INDEX "EmailTemplate_createdByUserId_idx" ON "EmailTemplate"("createdByUserId");
