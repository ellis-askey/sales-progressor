-- Mortgage broker card (2026-08-21): a mortgage broker as a provider kind, a
-- TSP-default flag on ProviderFirm (the fallback broker shown on outsourced
-- files), and the buyer's call-back request stamp on Contact. Applied to
-- staging via db push; this file is for production's `prisma migrate deploy`.

-- AlterEnum
ALTER TYPE "ProviderKind" ADD VALUE 'mortgage_broker';

-- AlterTable
ALTER TABLE "ProviderFirm" ADD COLUMN "tspDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "brokerCallbackRequestedAt" TIMESTAMP(3);
