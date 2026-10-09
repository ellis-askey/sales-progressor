-- Record which version of the Sales Progression Business Terms a progression
-- business agreed to at sign-up, and when. Both nullable: existing rows (incl.
-- the TSP row) stay null.
ALTER TABLE "ProgressionBusiness" ADD COLUMN "termsAcceptedVersion" TEXT;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
