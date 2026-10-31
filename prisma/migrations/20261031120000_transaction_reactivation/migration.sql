-- Reactivation of a withdrawn file (withdrawn -> active): resume where it left off.
-- withdrawnAt: stamped on withdraw, cleared on reactivate; the gap (now - withdrawnAt)
-- shifts every paused reminder/chase/enquiry clock so nothing reads as overdue.
-- chainReconnectPending: set on reactivation when the file was in a chain at
-- withdrawal (the cascade detached + notified neighbours, so a one-tap human
-- reconnect is surfaced rather than an unsafe auto-reversal).
ALTER TABLE "PropertyTransaction" ADD COLUMN "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "chainReconnectPending" BOOLEAN NOT NULL DEFAULT false;
