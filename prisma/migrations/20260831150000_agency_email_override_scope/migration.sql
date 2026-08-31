-- Per-agency scoping for milestone email copy overrides.
--
-- agencyId NULL  = the Sales Progressor default (every existing row stays NULL).
-- agencyId <set> = that agency's own override, which wins over the SP default at
--                  send time (the agency layer is resolved before the default).
--
-- Behaviour is unchanged by this migration: no agency rows exist yet, so every
-- send still resolves to the NULL-agency default exactly as before.

ALTER TABLE "MilestoneEmailOverride" ADD COLUMN "agencyId" TEXT;

-- An agency's overrides are dropped if the agency is deleted.
ALTER TABLE "MilestoneEmailOverride"
  ADD CONSTRAINT "MilestoneEmailOverride_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace the old scenario-unique so an agency row and the SP-default row can
-- coexist for the same (code, side, tenure, purchaseType).
DROP INDEX "MilestoneEmailOverride_code_side_tenure_purchaseType_key";

CREATE UNIQUE INDEX "MilestoneEmailOverride_code_side_tenure_purchaseType_agencyId_key"
  ON "MilestoneEmailOverride" ("code", "side", "tenure", "purchaseType", "agencyId");

-- NULLs are distinct in a normal unique index, so the composite above does NOT
-- prevent two SP-default rows for one scenario. This partial unique index keeps
-- the one-default-per-scenario guarantee for the agencyId IS NULL rows.
CREATE UNIQUE INDEX "MilestoneEmailOverride_sp_default_scenario_key"
  ON "MilestoneEmailOverride" ("code", "side", "tenure", "purchaseType")
  WHERE "agencyId" IS NULL;

CREATE INDEX "MilestoneEmailOverride_agencyId_idx" ON "MilestoneEmailOverride" ("agencyId");
