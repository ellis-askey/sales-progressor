-- NR attribution split from complete attribution. Pre-fix the "who + when"
-- of a not-required flip lived in completedById/completedAt — indistinguishable
-- from a real completion in downstream reads (timeline, activity feed, event
-- log). Splitting them lets the UI render "Marked not required by Sam · 3 Jul"
-- without lying about a milestone having been "completed".
--
-- Both nullable; no backfill. Existing NR rows keep their reason string and
-- read as anonymous NR ("Marked not required" without attribution) until the
-- next NR toggle. Timeline / activity feed handles the null gracefully.

ALTER TABLE "MilestoneCompletion"
  ADD COLUMN "notRequiredById" TEXT,
  ADD COLUMN "notRequiredAt"   TIMESTAMP(3);

ALTER TABLE "MilestoneCompletion"
  ADD CONSTRAINT "MilestoneCompletion_notRequiredById_fkey"
  FOREIGN KEY ("notRequiredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
