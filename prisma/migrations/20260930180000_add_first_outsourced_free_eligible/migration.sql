-- First-outsourced-free eligibility flag on Agency.
--
-- Additive + a targeted backfill. The column controls two things that key off
-- the same rule (lib/services/billing-trigger.ts + the first_outsourced_free
-- email): whether an agency's first outsourced sale to exchange is free, and
-- whether the celebration email fires.
--
-- Default true = every genuinely new agency is eligible. We then set it false
-- for the 5 agencies that were ALREADY outsourcing to us before this giveaway
-- existed. They must never get a wrongly-free file nor the email. The UPDATE is
-- by prod agency id, so it is a harmless no-op on staging (those ids do not
-- exist there) and idempotent on re-run.

-- AlterTable
ALTER TABLE "Agency" ADD COLUMN "firstOutsourcedFreeEligible" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: exclude the pre-existing outsourcing agencies (prod ids).
--   Oplah Ltd                                   cmoslmvbz00007qjfi7xl7el6  (feeTier standard)
--   Akeman Residential                          cmou19l8j0000n4djh2enonr7  (feeTier legacy)
--   Danny Bailey - A Bespoke & Personal Agent   cmokcvjz80002g9efnl2ony2n  (feeTier legacy)
--   Meldone Estates                             cmpmillv60001148nami391md  (feeTier legacy)
--   VIA Properties                              cmp6s72xa0001pxaxlbuqhq5k  (feeTier legacy)
UPDATE "Agency"
SET "firstOutsourcedFreeEligible" = false
WHERE "id" IN (
  'cmoslmvbz00007qjfi7xl7el6',
  'cmou19l8j0000n4djh2enonr7',
  'cmokcvjz80002g9efnl2ony2n',
  'cmpmillv60001148nami391md',
  'cmp6s72xa0001pxaxlbuqhq5k'
);
