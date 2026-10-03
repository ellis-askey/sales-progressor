-- Business->TSP billing (dark until PROGRESSION_BILLING_COLLECT): Stripe
-- customer/subscription + payment-lifecycle fields on the business (mirrors
-- Agency), and a per-sale "pushed to Stripe" marker on the transaction. All
-- additive + nullable.
ALTER TABLE "ProgressionBusiness" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "paymentFailedAt" TIMESTAMP(3);
ALTER TABLE "ProgressionBusiness" ADD COLUMN "newFileCreationBlockedAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "businessPerSaleInvoicedAt" TIMESTAMP(3);
