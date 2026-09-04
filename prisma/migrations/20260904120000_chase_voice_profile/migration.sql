-- Chase voice learning (2026-09-04). Additive: per-user distilled style profile
-- for AI chase generation, plus when it was built and how many edited samples it
-- was distilled from. All nullable / defaulted. No backfill.

ALTER TABLE "User" ADD COLUMN "chaseVoiceProfile" TEXT;
ALTER TABLE "User" ADD COLUMN "chaseVoiceProfileBuiltAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "chaseVoiceProfileSamples" INTEGER NOT NULL DEFAULT 0;
