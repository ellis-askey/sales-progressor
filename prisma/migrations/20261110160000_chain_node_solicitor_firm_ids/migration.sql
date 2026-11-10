-- The chain-node solicitor note is now set via the solicitor-firm picker (same UI
-- as add-a-sale). Store the resolved firm / contact ids alongside the snapshot so
-- re-opening the note pre-selects them. Nullable; no FK (pure annotation).
ALTER TABLE "ChainNodeSolicitor" ADD COLUMN IF NOT EXISTS "firmId" TEXT;
ALTER TABLE "ChainNodeSolicitor" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
