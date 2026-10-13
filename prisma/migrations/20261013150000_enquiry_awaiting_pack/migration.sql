-- "Waiting on the management pack" hold on the enquiries tracker. Open-ended
-- (no date): pauses the chase clock + drops the loop out of the needs-you count,
-- auto-cleared when the pack is logged received. Additive, nullable - safe.
ALTER TABLE "EnquiryTracker" ADD COLUMN "awaitingPackAt" TIMESTAMP(3);
