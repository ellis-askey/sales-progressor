-- WhatsApp V2: sender display label + stored media URL on OutboundMessage.
ALTER TABLE "OutboundMessage" ADD COLUMN "senderLabel" TEXT;
ALTER TABLE "OutboundMessage" ADD COLUMN "mediaUrl" TEXT;
