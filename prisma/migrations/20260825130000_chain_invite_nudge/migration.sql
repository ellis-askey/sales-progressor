-- Chain-invite nudge (Phase 3): one-time reminder to invites that were delivered
-- but never opened. inviteNudgedAt is set when the reminder is sent, so the cron
-- sends at most one nudge per invite.
ALTER TABLE "ChainLink" ADD COLUMN "inviteNudgedAt" TIMESTAMP(3);
