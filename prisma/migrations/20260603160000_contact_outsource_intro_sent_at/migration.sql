-- Tracks whether the white-labelled "Getting your sale moving" intro
-- email has been sent to a given Contact for the sale they belong to.
-- Atomic check-and-stamp via `updateMany WHERE outsourceIntroSentAt IS NULL`
-- gives a race-safe one-send guard. NULL on every existing row — no
-- backfill needed; legacy sales never get the intro retrospectively.

ALTER TABLE "Contact"
ADD COLUMN "outsourceIntroSentAt" TIMESTAMP(3);
