-- The external-progression-business equivalent of billedAtExchange. Records the
-- £5 per-sale charge owed by a progression business to TSP at exchange (the
-- agency's billedAtExchange stays null — it's ring-fenced). Additive, nullable.
ALTER TABLE "PropertyTransaction" ADD COLUMN "businessBilledAtExchange" TIMESTAMP(3);
