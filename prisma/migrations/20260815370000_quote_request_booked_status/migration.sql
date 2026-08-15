-- Survey booking loop: link the "survey booked" step to the quote requests.
--
-- New statuses:
--   booked      — the buyer chose this firm; referral in play, fee not settled.
--   not_chosen  — this firm quoted but the buyer booked a DIFFERENT firm of ours.
--                 Neutral, NOT a loss (we still placed the business).
-- (lost is now reserved for booking OUTSIDE our network.)
ALTER TYPE "QuoteRequestStatus" ADD VALUE IF NOT EXISTS 'booked' AFTER 'pending';
ALTER TYPE "QuoteRequestStatus" ADD VALUE IF NOT EXISTS 'not_chosen' AFTER 'won';

-- When this firm was marked booked (kept separate from statusChangedAt so a
-- later "won" doesn't overwrite the booking date).
ALTER TABLE "QuoteRequest" ADD COLUMN "bookedAt" TIMESTAMP(3);
