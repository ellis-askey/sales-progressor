-- Allow an agency to be a client of MULTIPLE progression businesses: a branch can
-- split its sales across several progressors. Reverses 20261003160000, which made
-- agencyId unique. Each sale's progressor is still carried per-file on
-- PropertyTransaction.progressionBusinessId (the access boundary), so this only
-- relaxes the client-management link. Swap the unique index back for a plain one.
DROP INDEX IF EXISTS "ProgressionBusinessClient_agencyId_key";
CREATE INDEX IF NOT EXISTS "ProgressionBusinessClient_agencyId_idx" ON "ProgressionBusinessClient"("agencyId");
