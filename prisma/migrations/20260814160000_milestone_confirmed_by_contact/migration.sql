-- Store which client Contact confirmed a milestone via their own portal link.
ALTER TABLE "MilestoneCompletion" ADD COLUMN "confirmedByContactId" TEXT;
