-- Survey quote improvements.
--
-- 1. Two new ways a client can ask a surveyor to reach them: text and WhatsApp.
--    Postgres 12+ allows ADD VALUE inside a migration; the new values are not
--    used elsewhere in this file, so no in-transaction-use conflict.
ALTER TYPE "QuoteContactMethod" ADD VALUE IF NOT EXISTS 'text';
ALTER TYPE "QuoteContactMethod" ADD VALUE IF NOT EXISTS 'whatsapp';

-- 2. Snapshot the property facts a surveyor needs to price the job (purchase
--    price + freehold/leasehold) onto the QuoteRequest at submit time. Both
--    nullable — a file may not have them recorded yet.
ALTER TABLE "QuoteRequest" ADD COLUMN "pricePence" INTEGER;
ALTER TABLE "QuoteRequest" ADD COLUMN "tenure" "Tenure";
