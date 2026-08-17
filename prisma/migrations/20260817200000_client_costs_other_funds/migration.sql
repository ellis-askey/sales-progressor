-- Funds the buyer has already sent beyond the exchange deposit (pence).
ALTER TABLE "PropertyTransaction" ADD COLUMN "clientOtherFundsSentGBP" INTEGER;
