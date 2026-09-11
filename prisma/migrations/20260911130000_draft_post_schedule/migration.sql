-- Content & Personal Brand, Phase 5.1: content pipeline / calendar fields.
-- docs/active/content-brand/SPEC.md

-- AlterTable
ALTER TABLE "DraftPost" ADD COLUMN "scheduleStatus" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "DraftPost" ADD COLUMN "scheduledFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "DraftPost_scheduleStatus_scheduledFor_idx" ON "DraftPost"("scheduleStatus", "scheduledFor");
