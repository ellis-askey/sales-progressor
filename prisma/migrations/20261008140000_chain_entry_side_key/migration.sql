-- Canonical, non-null "side" tag for chain-node chase-log entries (#chain-checkins).
-- authorAgencyId/authorBusinessId were both null for internal TSP staff (agencyId
-- AND businessId null), so the side-aware filter collapsed to "show nothing" and
-- every note vanished from the Check-ins tab. authorSideKey is non-null for
-- everyone: agency:<id>, business:<id>, or tsp-internal for the shared internal team.
ALTER TABLE "ChainLinkEntry" ADD COLUMN IF NOT EXISTS "authorSideKey" TEXT;

-- Backfill existing entries from their author's identity so notes already logged
-- keep showing to the side that wrote them.
UPDATE "ChainLinkEntry" e
SET "authorSideKey" = CASE
  WHEN u."agencyId" IS NOT NULL THEN 'agency:' || u."agencyId"
  WHEN u."progressionBusinessId" IS NOT NULL THEN 'business:' || u."progressionBusinessId"
  ELSE 'tsp-internal'
END
FROM "User" u
WHERE e."authorId" = u."id" AND e."authorSideKey" IS NULL;
