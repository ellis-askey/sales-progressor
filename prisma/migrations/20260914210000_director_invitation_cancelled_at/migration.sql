-- DirectorInvitation.cancelledAt has been in schema.prisma but was never migrated
-- (the table was originally created via db push, so it has no CREATE TABLE migration
-- and cancelledAt drifted out of prod). The Command Centre agency setup-readiness
-- board is the first code to filter directorInvitation on cancelledAt, which crashed
-- /command/agencies in prod (P2022: column does not exist). Additive, nullable,
-- idempotent. NegotiatorInvitation already has this column.
ALTER TABLE "DirectorInvitation" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
