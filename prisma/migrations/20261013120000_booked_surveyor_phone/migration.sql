-- Point-of-contact phone for the booked surveyor (PM9 confirm), alongside bookedSurveyorEmail.
ALTER TABLE "PropertyTransaction" ADD COLUMN "bookedSurveyorPhone" TEXT;
