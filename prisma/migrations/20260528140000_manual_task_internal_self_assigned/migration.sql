-- Internal-staff self-assigned to-dos.
--
-- Schema additions:
--   1. ManualTask.agencyId becomes nullable. Internal-staff tasks
--      created without a linked transaction have agencyId = null. Tasks
--      linked to a transaction continue to carry the transaction's
--      agencyId.
--   2. ManualTask.isInternalSelfAssigned (boolean) flags tasks created
--      by internal staff and visible to the whole internal team.
--   3. Index on (isInternalSelfAssigned, status) for the new bucket
--      read path.

ALTER TABLE "ManualTask"
  ALTER COLUMN "agencyId" DROP NOT NULL;

ALTER TABLE "ManualTask"
  ADD COLUMN "isInternalSelfAssigned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ManualTask_isInternalSelfAssigned_status_idx"
  ON "ManualTask" ("isInternalSelfAssigned", "status");
