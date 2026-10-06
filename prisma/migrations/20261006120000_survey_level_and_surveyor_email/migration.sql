-- Survey level + surveyor point-of-contact email on the survey-booked step
-- (critiques #211 / #212). Idempotent for shared-repo safety.

DO $$ BEGIN
  CREATE TYPE "SurveyLevel" AS ENUM ('level_2', 'level_3');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "surveyLevel" "SurveyLevel";
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "bookedSurveyorEmail" TEXT;
