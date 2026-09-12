-- CreateTable
CREATE TABLE "SolicitorContactAgencyOverride" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "solicitorContactId" TEXT NOT NULL,
    "secondaryEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitorContactAgencyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitorContactAgencyOverride_solicitorContactId_idx" ON "SolicitorContactAgencyOverride"("solicitorContactId");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitorContactAgencyOverride_agencyId_solicitorContactId_key" ON "SolicitorContactAgencyOverride"("agencyId", "solicitorContactId");

-- AddForeignKey
ALTER TABLE "SolicitorContactAgencyOverride" ADD CONSTRAINT "SolicitorContactAgencyOverride_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitorContactAgencyOverride" ADD CONSTRAINT "SolicitorContactAgencyOverride_solicitorContactId_fkey" FOREIGN KEY ("solicitorContactId") REFERENCES "SolicitorContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
