-- Per-contact chase-email pause (2026-08-11 email-settings drawer).
-- Null = chase emails send for this contact; set = paused by an agent.
ALTER TABLE "Contact" ADD COLUMN "emailsPausedAt" TIMESTAMP(3);

-- Backfill: contacts inherit their side's transaction-level pause flag so
-- no existing pause silently un-pauses when the client-chase cron switches
-- from per-side reads (vendorEmailsPaused / purchaserEmailsPaused) to
-- per-contact reads.
UPDATE "Contact" c
SET "emailsPausedAt" = NOW()
FROM "PropertyTransaction" t
WHERE c."propertyTransactionId" = t.id
  AND (
    (c."roleType" = 'vendor'    AND t."vendorEmailsPaused" = true)
 OR (c."roleType" = 'purchaser' AND t."purchaserEmailsPaused" = true)
  );
