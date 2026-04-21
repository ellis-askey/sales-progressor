-- Sprint 6: Purchase price, tenure, purchase type, fees, weights, exchange prediction

CREATE TYPE "Tenure" AS ENUM ('freehold', 'leasehold');
CREATE TYPE "PurchaseType" AS ENUM ('mortgage', 'cash', 'cash_from_proceeds');
CREATE TYPE "ClientType" AS ENUM ('legacy', 'standard');

-- User: fee structure
ALTER TABLE "User" ADD COLUMN "clientType" "ClientType" NOT NULL DEFAULT 'standard';
ALTER TABLE "User" ADD COLUMN "legacyFee" INTEGER;

-- PropertyTransaction: new fields
ALTER TABLE "PropertyTransaction" ADD COLUMN "purchasePrice" INTEGER;
ALTER TABLE "PropertyTransaction" ADD COLUMN "tenure" "Tenure";
ALTER TABLE "PropertyTransaction" ADD COLUMN "purchaseType" "PurchaseType";
ALTER TABLE "PropertyTransaction" ADD COLUMN "twelveWeekTarget" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "predictedExchangeDate" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "overridePredictedDate" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "agentFeeAmount" INTEGER;
ALTER TABLE "PropertyTransaction" ADD COLUMN "agentFeePercent" DECIMAL(5,2);
ALTER TABLE "PropertyTransaction" ADD COLUMN "agentFeeIsVatInclusive" BOOLEAN;

-- MilestoneDefinition: weight
ALTER TABLE "MilestoneDefinition" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 2;

-- PriceHistory table
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "oldPrice" INTEGER,
    "newPrice" INTEGER NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PriceHistory"
    ADD CONSTRAINT "PriceHistory_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed weights onto existing milestone definitions
UPDATE "MilestoneDefinition" SET "weight" = 5 WHERE "code" IN ('VM5','VM11','VM20','PM3','PM6','PM25','PM14b','PM27');
UPDATE "MilestoneDefinition" SET "weight" = 4 WHERE "code" IN ('VM4','VM7','VM8','VM9','VM10','VM16','VM17','VM18','VM19','PM9','PM10','PM11','PM21','PM22','PM12','PM23','PM24','PM13','PM15b');
UPDATE "MilestoneDefinition" SET "weight" = 3 WHERE "code" IN ('VM1','VM3','VM14','VM15','PM1','PM14a','PM15a','PM20','PM26','PM8');
UPDATE "MilestoneDefinition" SET "weight" = 2 WHERE "code" IN ('VM2','VM6','VM12','VM13','PM2','PM4','PM5','PM7','PM16','PM17');
