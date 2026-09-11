-- Partial-replies signal for the enquiries tracker: set when the seller's
-- solicitor sends some (not all) replies across. The ball stays their court;
-- cleared on a full handover or on close. Durable so a later chase can't erase it.
ALTER TABLE "EnquiryTracker" ADD COLUMN "partialRepliesAt" TIMESTAMP(3);

-- New movement kind for a partial-replies event on the loop history.
ALTER TYPE "EnquiryMovementKind" ADD VALUE 'partial_replies';
