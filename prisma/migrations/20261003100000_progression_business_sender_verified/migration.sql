-- Bulletproof-sender gate for an external progression business. Its own
-- senderEmail/senderDomain are used for client-facing sends ONLY once verified
-- (SendGrid domain authentication or verified single sender), stamped nightly by
-- the check-domains cron. Mirrors Agency.quoteSenderVerified / quoteSenderVerifiedAt.
-- Defaults false so every existing/new business falls back to the neutral platform
-- address until it proves it owns its sending domain. The TSP row short-circuits
-- before this gate, so TSP is unaffected.
ALTER TABLE "ProgressionBusiness" ADD COLUMN "senderVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "senderVerifiedAt" TIMESTAMP(3);
