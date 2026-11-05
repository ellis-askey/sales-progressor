-- Chain completeness, reworked to be PER SIDE and private (each agency/side keeps
-- its own "complete" mark; the other side never sees it). Replaces the three
-- chain-level columns from 20261105140000 with a per-(chain, sideKey) table.

-- Drop the previous chain-level columns.
ALTER TABLE "PropertyChain"
  DROP COLUMN "topConfirmedLinkId",
  DROP COLUMN "topConfirmedAt",
  DROP COLUMN "topConfirmedById";

-- CreateTable
CREATE TABLE "ChainCompletion" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "sideKey" TEXT NOT NULL,
    "topConfirmedLinkId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChainCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChainCompletion_chainId_sideKey_key" ON "ChainCompletion"("chainId", "sideKey");

-- CreateIndex
CREATE INDEX "ChainCompletion_chainId_idx" ON "ChainCompletion"("chainId");

-- AddForeignKey
ALTER TABLE "ChainCompletion" ADD CONSTRAINT "ChainCompletion_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "PropertyChain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
