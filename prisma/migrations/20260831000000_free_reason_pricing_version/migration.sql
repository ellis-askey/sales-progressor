-- Pricing migration (2026-08): freeReason + pricingVersion + firstOutsourcedFree.
-- Additive + labelling only. Billing behaviour is unchanged by this migration
-- (self-progress already stops billing at the exchange trigger, increment 1);
-- these columns let revenue reporting separate the free product from the
-- giveaway, and stamp the price rules each sale was created under.

-- CreateEnum
CREATE TYPE "FreeReason" AS ENUM ('permanent_free_self', 'first_outsourced_free', 'legacy_trial');

-- AlterEnum
ALTER TYPE "InvoiceLineKind" ADD VALUE 'intro_credit';

-- AlterTable
ALTER TABLE "PropertyTransaction" ADD COLUMN "freeReason" "FreeReason";
ALTER TABLE "PropertyTransaction" ADD COLUMN "pricingVersion" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN "firstOutsourcedFree" BOOLEAN NOT NULL DEFAULT false;

-- Backfill pricingVersion: every existing sale was created under the old
-- £59-self / 14-day-trial rules.
UPDATE "PropertyTransaction" SET "pricingVersion" = 'legacy_2026_paid_self' WHERE "pricingVersion" IS NULL;

-- Backfill freeReason (reporting label only; does not change what bills).
--   Self-managed sales not yet billed are free under the new model.
UPDATE "PropertyTransaction"
  SET "freeReason" = 'permanent_free_self'
  WHERE "serviceType" = 'self_managed' AND "billedAtExchange" IS NULL;
--   Outsourced sales that were free under the old 14-day trial (not yet billed)
--   keep that promise, labelled as legacy trial.
UPDATE "PropertyTransaction"
  SET "freeReason" = 'legacy_trial'
  WHERE "serviceType" = 'outsourced' AND "freeOnExchange" = true AND "billedAtExchange" IS NULL;
