-- The address a user's per-file emails send from, chosen self-serve and
-- decoupled from their login address. Null = send from the login address (today's
-- behaviour), so existing users are unchanged.
ALTER TABLE "User" ADD COLUMN "preferredSenderEmail" TEXT;
