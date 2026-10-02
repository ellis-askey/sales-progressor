-- Exchange-push: our manual "ready to exchange" confirmation per chain link.
ALTER TABLE "ChainLink" ADD COLUMN "exchangeReadyConfirmedAt" TIMESTAMP(3);
ALTER TABLE "ChainLink" ADD COLUMN "exchangeReadyConfirmedById" TEXT;
