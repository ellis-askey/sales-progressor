-- Chain completeness (internal). Three nullable columns on PropertyChain that
-- record which spine link was confirmed as the top when an agent marked the
-- chain "complete". The Complete / Not-complete state is DERIVED on read
-- (getChainV2): complete = topConfirmedLinkId is still the top-most spine link
-- AND no sale in the chain has withdrawn. Additive and nullable — safe.

-- AlterTable
ALTER TABLE "PropertyChain"
  ADD COLUMN "topConfirmedLinkId" TEXT,
  ADD COLUMN "topConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "topConfirmedById" TEXT;
