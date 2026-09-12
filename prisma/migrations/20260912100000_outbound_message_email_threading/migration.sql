-- Email threading / reply-linkage metadata on OutboundMessage (Data Optionality
-- capture-now, PR1 inbound + PR2 outbound). Additive + capture-only: no product
-- surface reads these columns yet. No uniqueness (conversationId repeats across a
-- thread; internetMessageId is shared across folder-copies of one logical message).
--
-- Authored with IF NOT EXISTS so it is safe to re-run: applied to staging via the
-- pooled connection at authoring time (the direct migrate endpoint is unreachable
-- from the dev machine), then Vercel's `migrate deploy` records + no-ops it on
-- staging and applies it cleanly on production.

ALTER TABLE "OutboundMessage" ADD COLUMN IF NOT EXISTS "conversationId" TEXT;
ALTER TABLE "OutboundMessage" ADD COLUMN IF NOT EXISTS "internetMessageId" TEXT;
ALTER TABLE "OutboundMessage" ADD COLUMN IF NOT EXISTS "inReplyTo" TEXT;
ALTER TABLE "OutboundMessage" ADD COLUMN IF NOT EXISTS "emailReferences" TEXT;

CREATE INDEX IF NOT EXISTS "OutboundMessage_transactionId_conversationId_idx"
  ON "OutboundMessage"("transactionId", "conversationId");
CREATE INDEX IF NOT EXISTS "OutboundMessage_internetMessageId_idx"
  ON "OutboundMessage"("internetMessageId");
CREATE INDEX IF NOT EXISTS "OutboundMessage_inReplyTo_idx"
  ON "OutboundMessage"("inReplyTo");
