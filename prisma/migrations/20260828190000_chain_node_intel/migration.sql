-- Chain-node intel (2026-08-28). Additive: a new enum + five nullable columns on
-- ChainLink. Private own-side operational notes about each node in the chain,
-- surfaced only to internal staff + the owning agency (see lib/chain/intel.ts).
-- No backfill, no data change to existing rows.

-- CreateEnum
CREATE TYPE "BreakChainStance" AS ENUM ('PREPARED', 'IF_REQUIRED', 'UNWILLING');

-- AlterTable
ALTER TABLE "ChainLink" ADD COLUMN "breakChainStance" "BreakChainStance";
ALTER TABLE "ChainLink" ADD COLUMN "breakChainConditions" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "expectedTimescale" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "chainNotes" TEXT;
ALTER TABLE "ChainLink" ADD COLUMN "lastChainCheckAt" TIMESTAMP(3);
