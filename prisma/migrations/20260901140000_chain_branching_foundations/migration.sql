-- Chain branching foundations (docs/active/chain-branching/00-spec.md, step 1).
-- Additive + backward compatible: every existing link becomes branchKey '' (the
-- main spine) with forkFromLinkId NULL, so behaviour is unchanged. Positions
-- become unique per (chain, branch) instead of per chain, so each onward branch
-- keeps its own 0..n ladder.
ALTER TABLE "ChainLink" ADD COLUMN "branchKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ChainLink" ADD COLUMN "forkFromLinkId" TEXT;

-- The old per-chain uniqueness is a UNIQUE INDEX (Prisma @@unique), not a table
-- constraint, so drop the index and recreate it per (chain, branch).
DROP INDEX "ChainLink_chainId_position_key";
CREATE UNIQUE INDEX "ChainLink_chainId_branchKey_position_key" ON "ChainLink"("chainId", "branchKey", "position");

CREATE INDEX "ChainLink_forkFromLinkId_idx" ON "ChainLink"("forkFromLinkId");
