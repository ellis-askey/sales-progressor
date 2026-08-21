-- Exchange-day client authority: stamped when the client confirms via their
-- portal that they've given their solicitor authority to exchange. Valid for the
-- current exchange day only (>= exchangeDayStartedAt), so re-activation re-asks.
ALTER TABLE "Contact" ADD COLUMN "exchangeAuthorityGivenAt" TIMESTAMP(3);
