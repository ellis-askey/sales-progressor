-- Free-text valuer / lender's-surveyor firm captured inline on the lender
-- valuation step (PM6), mirroring bookedSurveyorName for the survey step.
ALTER TABLE "PropertyTransaction" ADD COLUMN "bookedValuerName" TEXT;
