-- TSP's £5 per-sale charge to an external progression business. Billed when the
-- sale is ADDED (createTransaction), NOT at exchange — exchange is only the
-- business's own rate-card fee to the agency. The client agency is never charged
-- for these files. Additive + nullable.
ALTER TABLE "PropertyTransaction" ADD COLUMN "businessPerSaleChargedAt" TIMESTAMP(3);
