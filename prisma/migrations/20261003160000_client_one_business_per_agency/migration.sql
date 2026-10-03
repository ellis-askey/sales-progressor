-- V1 rule: an agency belongs to at most one progression business (deterministic
-- routing in getInvitingProgressor). Replaces the non-unique agencyId index with
-- a UNIQUE one. Deferred: allowing an agency to be a client of multiple businesses.
DROP INDEX IF EXISTS "ProgressionBusinessClient_agencyId_idx";
CREATE UNIQUE INDEX "ProgressionBusinessClient_agencyId_key" ON "ProgressionBusinessClient"("agencyId");
