-- CreateEnum
CREATE TYPE "FeeVatTreatment" AS ENUM ('plus', 'inc', 'none');

-- AlterTable: per-file VAT snapshot for each referral income.
-- NOT NULL DEFAULT backfills every existing file. Solicitor referrals default to
-- 'plus' (usually a VATable introduction fee); broker referrals to 'none'. Both
-- 'plus' and 'none' keep the stored figure as ex-VAT income, so no existing
-- file's gross/net moves (only 'inc' would restate, and nothing backfills to it).
ALTER TABLE "PropertyTransaction" ADD COLUMN "referralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'plus';
ALTER TABLE "PropertyTransaction" ADD COLUMN "brokerReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'none';
ALTER TABLE "PropertyTransaction" ADD COLUMN "onwardBrokerReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'none';

-- AlterTable: default VAT treatment on the Partners config, snapshotted onto
-- files at apply time.
ALTER TABLE "AgencyRecommendedSolicitor" ADD COLUMN "defaultReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'plus';
ALTER TABLE "AgencyPreferredBroker" ADD COLUMN "defaultReferralFeeVat" "FeeVatTreatment" NOT NULL DEFAULT 'none';
