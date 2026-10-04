-- Add a progression-business layer to milestone email-copy overrides. A non-null
-- progressionBusinessId row is an external business's own copy, applied to the
-- files they progress (resolved before the SP default, like the agency layer).
-- The existing compound unique is unchanged; the business layer's one-row-per-
-- scenario guarantee is enforced in the save route (find-then-upsert), exactly
-- like the SP-default (all-null) layer.
ALTER TABLE "MilestoneEmailOverride" ADD COLUMN "progressionBusinessId" TEXT;

ALTER TABLE "MilestoneEmailOverride"
  ADD CONSTRAINT "MilestoneEmailOverride_progressionBusinessId_fkey"
  FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MilestoneEmailOverride_progressionBusinessId_idx" ON "MilestoneEmailOverride"("progressionBusinessId");
