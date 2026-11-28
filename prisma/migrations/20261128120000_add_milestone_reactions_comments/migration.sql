-- Reactions + threaded comments on milestone rows in the Activity feed.
-- Milestones are MilestoneCompletion rows (not OutboundMessage), so reactions
-- get their own column here, and a comment is an internal_note OutboundMessage
-- anchored to the milestone via parentMilestoneId. Additive + nullable — safe,
-- no backfill. Applied to staging via db push; prod via migrate deploy.

ALTER TABLE "MilestoneCompletion" ADD COLUMN "reactions" JSONB;

ALTER TABLE "OutboundMessage" ADD COLUMN "parentMilestoneId" TEXT;

CREATE INDEX "OutboundMessage_parentMilestoneId_idx" ON "OutboundMessage"("parentMilestoneId");

ALTER TABLE "OutboundMessage"
  ADD CONSTRAINT "OutboundMessage_parentMilestoneId_fkey"
  FOREIGN KEY ("parentMilestoneId") REFERENCES "MilestoneCompletion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
