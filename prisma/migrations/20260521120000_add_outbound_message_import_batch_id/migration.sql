-- Add importBatchId column to group rows inserted by the WhatsApp chat import
-- and support batched undo via deleteMany on this batch.
ALTER TABLE "OutboundMessage" ADD COLUMN "importBatchId" TEXT;

CREATE INDEX "OutboundMessage_importBatchId_idx" ON "OutboundMessage"("importBatchId");
