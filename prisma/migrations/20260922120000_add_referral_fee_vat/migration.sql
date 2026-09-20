-- CreateEnum
-- How a referral fee is quoted for VAT: `plus` = figure is ex VAT (VAT added on
-- top); `inc` = figure already includes VAT. Referral income for a VAT-registered
-- agency is always VATable, so there is no "no VAT" case.
CREATE TYPE "FeeVatTreatment" AS ENUM ('plus', 'inc');

-- AlterTable: per-file VAT snapshot for each referral income. NOT NULL DEFAULT
-- 'plus' backfills every existing file as ex VAT, so no existing file's gross or
-- net moves (only 'inc' would restate, and nothing backfills to it).
ALTER TABLE "PropertyTransaction" ADD COLUMN "referralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'plus';
ALTER TABLE "PropertyTransaction" ADD COLUMN "brokerReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'plus';
ALTER TABLE "PropertyTransaction" ADD COLUMN "onwardBrokerReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'plus';

-- AlterTable: default VAT treatment on the Partners config, snapshotted onto
-- files at apply time.
ALTER TABLE "AgencyRecommendedSolicitor" ADD COLUMN "defaultReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'plus';
ALTER TABLE "AgencyPreferredBroker" ADD COLUMN "defaultReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'plus';
