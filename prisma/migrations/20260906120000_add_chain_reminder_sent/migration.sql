-- Day-14 "still moving" chain reminder: one-time stamp on a ChainLink so a
-- not-yet-joined neighbour receives at most one reminder after the 3-day nudge.
ALTER TABLE "ChainLink" ADD COLUMN "inviteChainReminderSentAt" TIMESTAMP(3);
