-- Confirm-progress step marks on chain check-in rows (critique #235).
-- One row per (link, side, step); unmarking deletes the row. Side-private,
-- same model as ChainLinkEntry.authorSideKey.
CREATE TABLE "ChainNodeStepMark" (
    "id" TEXT NOT NULL,
    "chainLinkId" TEXT NOT NULL,
    "sideKey" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "markedById" TEXT,
    "markedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainNodeStepMark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChainNodeStepMark_chainLinkId_sideKey_stepKey_key" ON "ChainNodeStepMark"("chainLinkId", "sideKey", "stepKey");

CREATE INDEX "ChainNodeStepMark_chainLinkId_idx" ON "ChainNodeStepMark"("chainLinkId");

ALTER TABLE "ChainNodeStepMark" ADD CONSTRAINT "ChainNodeStepMark_chainLinkId_fkey" FOREIGN KEY ("chainLinkId") REFERENCES "ChainLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
