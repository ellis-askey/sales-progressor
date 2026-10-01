-- Progression-business per-client rate card: how a progressor charges for the
-- sales they progress for a given client agency. JSON validated in app code
-- (lib/progression/client-fees.ts). Null = no fee model set yet.
-- AlterTable
ALTER TABLE "ProgressionBusinessClient" ADD COLUMN "feeModel" JSONB;
