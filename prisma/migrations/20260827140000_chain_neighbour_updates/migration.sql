-- Note A: onward-neighbour update queue + per-agency opt-in.
-- See docs/active/three-notes-distilled-2026-08-27.md.

ALTER TABLE "Agency" ADD COLUMN "chainNeighbourUpdatesEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ChainNeighbourUpdate" (
    "id" TEXT NOT NULL,
    "chainLinkId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "milestoneCode" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChainNeighbourUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChainNeighbourUpdate_chainLinkId_milestoneCode_key" ON "ChainNeighbourUpdate"("chainLinkId", "milestoneCode");
CREATE INDEX "ChainNeighbourUpdate_sentAt_scheduledFor_idx" ON "ChainNeighbourUpdate"("sentAt", "scheduledFor");

ALTER TABLE "ChainNeighbourUpdate" ADD CONSTRAINT "ChainNeighbourUpdate_chainLinkId_fkey" FOREIGN KEY ("chainLinkId") REFERENCES "ChainLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
