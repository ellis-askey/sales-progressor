-- WhatsApp Cloud Phase 3 (REBUILD_PLAN §G P3): ledger wiring. Thread link on
-- the message spine + the DB-level dedup the Baileys era never got. The
-- partial unique index is scoped to channel='whatsapp' so decades of email
-- rows (null/duplicated providerMessageId) are untouched, and legacy Baileys
-- rows (channel='other') can't block creation.
-- NOTE: prisma cannot express a partial unique index, so staging (db push)
-- relies on the application-level dedup only; prod (migrate deploy) gets both.
ALTER TABLE "OutboundMessage" ADD COLUMN "threadId" TEXT;

CREATE INDEX "OutboundMessage_threadId_idx" ON "OutboundMessage"("threadId");

ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "WhatsAppThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OutboundMessage_providerMessageId_whatsapp_key" ON "OutboundMessage"("providerMessageId") WHERE "channel" = 'whatsapp';
