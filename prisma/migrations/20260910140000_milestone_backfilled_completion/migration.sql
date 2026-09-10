-- Bulk retrospective completions (e.g. cash→mortgage with "offer already
-- received") have no real elapsed timeline. Flag them so the timeframes
-- analytics can exclude the ~0-day gaps they create.
ALTER TABLE "MilestoneCompletion"
  ADD COLUMN "backfilledCompletion" BOOLEAN NOT NULL DEFAULT false;
