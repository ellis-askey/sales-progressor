-- SP company auto-invite policy, split by who added the sale. Default true =
-- current behaviour (invite on every add).
ALTER TABLE "ProgressionBusiness" ADD COLUMN "autoInviteOnAgentAdd" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "autoInviteOnOwnAdd" BOOLEAN NOT NULL DEFAULT true;
