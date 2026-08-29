-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('new', 'contacted', 'replied', 'interested', 'trial', 'active', 'lost');

-- CreateEnum
CREATE TYPE "ProspectSource" AS ENUM ('cold', 'google', 'linkedin', 'referral', 'chain', 'solicitor', 'existing_contact', 'inbound', 'other');

-- CreateEnum
CREATE TYPE "ProspectLostReason" AS ENUM ('not_interested', 'existing_solution', 'price', 'no_response', 'timing', 'corporate_decision', 'doesnt_outsource', 'other');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "agencyName" TEXT NOT NULL,
    "branch" TEXT,
    "website" TEXT,
    "location" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "generalEmail" TEXT,
    "branchCount" INTEGER,
    "sizeNote" TEXT,
    "source" "ProspectSource" NOT NULL DEFAULT 'other',
    "status" "ProspectStatus" NOT NULL DEFAULT 'new',
    "ownerUserId" TEXT,
    "notes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "convertedAt" TIMESTAMP(3),
    "convertedAgencyId" TEXT,
    "lostAt" TIMESTAMP(3),
    "lostReason" "ProspectLostReason",
    "revisitAt" TIMESTAMP(3),
    "sourceChainLinkId" TEXT,
    "optedOutAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectContact" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "isDecisionMaker" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "preferredContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectActivity" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ProspectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_convertedAgencyId_key" ON "Prospect"("convertedAgencyId");

-- CreateIndex
CREATE INDEX "Prospect_status_nextFollowUpAt_idx" ON "Prospect"("status", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Prospect_nextFollowUpAt_idx" ON "Prospect"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "Prospect_source_idx" ON "Prospect"("source");

-- CreateIndex
CREATE INDEX "Prospect_convertedAgencyId_idx" ON "Prospect"("convertedAgencyId");

-- CreateIndex
CREATE INDEX "Prospect_archivedAt_idx" ON "Prospect"("archivedAt");

-- CreateIndex
CREATE INDEX "ProspectContact_prospectId_idx" ON "ProspectContact"("prospectId");

-- CreateIndex
CREATE INDEX "ProspectContact_email_idx" ON "ProspectContact"("email");

-- CreateIndex
CREATE INDEX "ProspectActivity_prospectId_occurredAt_idx" ON "ProspectActivity"("prospectId", "occurredAt");

-- CreateIndex
CREATE INDEX "ProspectActivity_type_occurredAt_idx" ON "ProspectActivity"("type", "occurredAt");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_convertedAgencyId_fkey" FOREIGN KEY ("convertedAgencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_sourceChainLinkId_fkey" FOREIGN KEY ("sourceChainLinkId") REFERENCES "ChainLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectActivity" ADD CONSTRAINT "ProspectActivity_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
