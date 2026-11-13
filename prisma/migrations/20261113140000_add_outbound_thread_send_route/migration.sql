-- Email-threading diagnostic (test period): record which route a threaded send
-- took, so the Outlook native-reply can be verified live from the Command Centre.
-- Additive + idempotent; null on all existing + non-threaded rows. Safe to drop
-- once threading is signed off.
ALTER TABLE "OutboundMessage"
  ADD COLUMN IF NOT EXISTS "threadSendRoute" TEXT;
