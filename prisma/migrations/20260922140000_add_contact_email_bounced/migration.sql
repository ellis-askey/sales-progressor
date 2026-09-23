-- AddColumn: mark a contact whose email HARD-BOUNCED (dead/invalid address), so
-- automated chasing stops re-sending to a dead inbox and the reminder is handed
-- back to the agent as a "fix the email" task. Nullable; existing rows stay NULL
-- (reachable), so no behaviour changes for anyone until a real bounce lands.
ALTER TABLE "Contact" ADD COLUMN "emailBouncedAt" TIMESTAMP(3);
