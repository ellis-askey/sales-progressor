-- Per-agency fee tier override.
--
-- feeTier defaults to "standard" for every existing agency — no behaviour
-- change until an admin explicitly flips one to "legacy" with a fixed amount.
-- legacyOutsourcedFeePence is nullable; calculateOurFee only honours it when
-- feeTier = 'legacy'. Self-managed (£59 hardcoded) is unaffected.

ALTER TABLE "Agency"
  ADD COLUMN "feeTier" "ClientType" NOT NULL DEFAULT 'standard',
  ADD COLUMN "legacyOutsourcedFeePence" INTEGER;
