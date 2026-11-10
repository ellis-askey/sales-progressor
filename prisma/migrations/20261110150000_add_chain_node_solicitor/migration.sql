-- Per-viewer, info-only note of a chain neighbour's buyer/seller solicitors
-- (2026-11-10). Same privacy + gate model as ChainNodeStepMark: scoped by
-- sideKey, one row per (link, side), never touches real solicitor data.
CREATE TABLE IF NOT EXISTS "ChainNodeSolicitor" (
  "id"           TEXT NOT NULL,
  "chainLinkId"  TEXT NOT NULL,
  "sideKey"      TEXT NOT NULL,
  "side"         TEXT NOT NULL,
  "firmName"     TEXT NOT NULL,
  "handlerName"  TEXT,
  "handlerPhone" TEXT,
  "handlerEmail" TEXT,
  "markedById"   TEXT,
  "markedByName" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChainNodeSolicitor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChainNodeSolicitor_chainLinkId_sideKey_side_key"
  ON "ChainNodeSolicitor" ("chainLinkId", "sideKey", "side");
CREATE INDEX IF NOT EXISTS "ChainNodeSolicitor_chainLinkId_idx"
  ON "ChainNodeSolicitor" ("chainLinkId");

DO $$ BEGIN
  ALTER TABLE "ChainNodeSolicitor"
    ADD CONSTRAINT "ChainNodeSolicitor_chainLinkId_fkey"
    FOREIGN KEY ("chainLinkId") REFERENCES "ChainLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
