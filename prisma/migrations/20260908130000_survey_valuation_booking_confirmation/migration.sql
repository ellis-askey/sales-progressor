-- Survey / lender-valuation booking access + provisional-confirmation fields.
-- keyCollectionRequired: null for every existing row (unset) — the internal
-- confirmer sets it going forward. awaitingBookingConfirmation defaults false
-- so no historical booking is treated as provisional.
-- Staging is synced via `prisma db push`; production applies this file via
-- `prisma migrate deploy`. See docs/active/booking-reminders/00-plan.md.
ALTER TABLE "MilestoneCompletion" ADD COLUMN "keyCollectionRequired" BOOLEAN;
ALTER TABLE "MilestoneCompletion" ADD COLUMN "awaitingBookingConfirmation" BOOLEAN NOT NULL DEFAULT false;
