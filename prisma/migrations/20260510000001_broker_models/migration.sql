-- CreateTable
CREATE TABLE "BrokerFirm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerFirm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerContact" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyPreferredBroker" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "brokerFirmId" TEXT NOT NULL,
    "defaultReferralFeePence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyPreferredBroker_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "PropertyTransaction"
    ADD COLUMN "brokerFirmId" TEXT,
    ADD COLUMN "brokerContactId" TEXT,
    ADD COLUMN "brokerReferralFee" INTEGER,
    ADD COLUMN "brokerReferralFeeReceived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "BrokerFirm_name_key" ON "BrokerFirm"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyPreferredBroker_agencyId_key" ON "AgencyPreferredBroker"("agencyId");

-- AddForeignKey
ALTER TABLE "BrokerContact" ADD CONSTRAINT "BrokerContact_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "BrokerFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPreferredBroker" ADD CONSTRAINT "AgencyPreferredBroker_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyPreferredBroker" ADD CONSTRAINT "AgencyPreferredBroker_brokerFirmId_fkey" FOREIGN KEY ("brokerFirmId") REFERENCES "BrokerFirm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_brokerFirmId_fkey" FOREIGN KEY ("brokerFirmId") REFERENCES "BrokerFirm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_brokerContactId_fkey" FOREIGN KEY ("brokerContactId") REFERENCES "BrokerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
