-- Buyer-confirmed stamp-duty circumstances + completion-funds-sent flag for the
-- portal "Your costs" card.
ALTER TABLE "PropertyTransaction" ADD COLUMN "clientFirstTimeBuyer" BOOLEAN;
ALTER TABLE "PropertyTransaction" ADD COLUMN "clientAdditionalProperty" BOOLEAN;
ALTER TABLE "PropertyTransaction" ADD COLUMN "clientCompletionFundsSent" BOOLEAN;
