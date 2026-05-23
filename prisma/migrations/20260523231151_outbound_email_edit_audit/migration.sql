-- Audit columns for OutboundEmailQueue payload edits.
--
-- When an agent edits a pending CLIENT_CHASE email via the email-preview
-- modal, we overwrite the `payload` JSON in place (so the drain reads the
-- edited content naturally) and stamp these audit fields so the UI can
-- show "Edited by X at Y" on subsequent views.
--
-- Both nullable, default NULL. Existing rows are treated as "never edited"
-- which is correct (no backfill needed).
--
-- FK to User uses ON DELETE SET NULL — if the editing user is later deleted
-- the audit reference clears but the email row stays valid.

ALTER TABLE "OutboundEmailQueue"
  ADD COLUMN "editedAt"   TIMESTAMP(3),
  ADD COLUMN "editedById" TEXT;

ALTER TABLE "OutboundEmailQueue"
  ADD CONSTRAINT "OutboundEmailQueue_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
