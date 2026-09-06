-- "Promises" feature: auto-create internal to-dos from the progressor's own
-- WhatsApp commitments. Two additive, nullable columns:
--   OutboundMessage.promiseScannedAt — scan-once stamp so each outbound
--     WhatsApp message is read for a self-commitment at most once.
--   ManualTask.sourceMessageId — provenance link back to the WhatsApp message
--     a task was extracted from (null for hand-made tasks).
ALTER TABLE "OutboundMessage" ADD COLUMN "promiseScannedAt" TIMESTAMP(3);
ALTER TABLE "ManualTask" ADD COLUMN "sourceMessageId" TEXT;
