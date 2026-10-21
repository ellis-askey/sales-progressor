-- Progression sender ladder tier 3a: inbound subdomain delegation state. Additive.
ALTER TABLE "VerifiedDomain" ADD COLUMN "inboundHost" TEXT;
ALTER TABLE "VerifiedDomain" ADD COLUMN "inboundMxValid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VerifiedDomain" ADD COLUMN "inboundCheckedAt" TIMESTAMP(3);
