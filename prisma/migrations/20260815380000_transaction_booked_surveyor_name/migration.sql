-- Free-text surveyor name for the survey-booked step when the buyer booked a
-- firm outside our network (title-cased on save; null when they booked one of
-- our quoted firms or no surveyor is recorded).
ALTER TABLE "PropertyTransaction" ADD COLUMN "bookedSurveyorName" TEXT;
