-- CreateTable
CREATE TABLE "ProspectGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "notes" TEXT,
    "ownerUserId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ProspectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectGroup_archivedAt_idx" ON "ProspectGroup"("archivedAt");

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "Prospect_groupId_idx" ON "Prospect"("groupId");

-- AlterTable
ALTER TABLE "ProspectContact" ALTER COLUMN "prospectId" DROP NOT NULL;
ALTER TABLE "ProspectContact" ADD COLUMN "groupId" TEXT;

-- CreateIndex
CREATE INDEX "ProspectContact_groupId_idx" ON "ProspectContact"("groupId");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProspectGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProspectGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
