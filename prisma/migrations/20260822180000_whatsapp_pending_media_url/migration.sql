-- WhatsApp V2 (WS4 media): stored media path on pending messages, so media
-- carries through when a pending message is later flushed onto a file.
ALTER TABLE "WhatsAppPendingMessage" ADD COLUMN "mediaUrl" TEXT;
