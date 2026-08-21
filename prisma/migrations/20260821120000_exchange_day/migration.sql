-- Exchange-day overlay: the agent flags "we're aiming to exchange today".
-- Single-day, self-clearing (active state is derived from these timestamps +
-- the current date, not a stored flag). See docs/active/exchange-day-SPEC.md.
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeDayStartedAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "exchangeDayCancelledAt" TIMESTAMP(3);
