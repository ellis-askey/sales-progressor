-- CreateTable
CREATE TABLE "ProspectImportBatch" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "total" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectImportItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "inputAgency" TEXT NOT NULL,
    "inputLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prospectId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectImportBatch_status_idx" ON "ProspectImportBatch"("status");

-- CreateIndex
CREATE INDEX "ProspectImportItem_batchId_idx" ON "ProspectImportItem"("batchId");

-- CreateIndex
CREATE INDEX "ProspectImportItem_status_idx" ON "ProspectImportItem"("status");

-- AddForeignKey
ALTER TABLE "ProspectImportItem" ADD CONSTRAINT "ProspectImportItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProspectImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
