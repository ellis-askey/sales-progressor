-- Adds welcomeEmailSentAt to User.
--
-- Stamped by sendWelcomeEmailIfNotSent (lib/emails/send-welcome.ts) the
-- moment a user becomes a real customer:
--   - Password signups: end of /api/register POST
--   - OAuth signups: end of completeOAuthSignup action
--
-- The day-1 retention cron (activation_day_1 priority in lib/services/
-- retention.ts) skips users where this column is non-null, preventing the
-- duplicate-send window where someone signs up + doesn't add a sale by
-- 09:00 UTC the next day.
--
-- Nullable, no default. Existing rows fall through as "never received the
-- instant welcome" — the cron will catch them on the next 09:00 UTC pass
-- exactly as it did before this column existed.

ALTER TABLE "User"
  ADD COLUMN "welcomeEmailSentAt" TIMESTAMP(3);
