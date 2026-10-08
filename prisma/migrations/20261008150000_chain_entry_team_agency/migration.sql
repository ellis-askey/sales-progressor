-- Re-tag existing chain chase-log notes to the owning-agency TEAM model
-- (shared-on-outsourced, 2026-10-08). A note's side becomes the owning agency of
-- the file its author's team works in that chain, so the owning agency and whoever
-- progresses it (TSP or an external business) share one log. Priority: the
-- author's own agency; else the chain file tagged to the author's progression
-- business; else a chain file assigned to the author; else (internal/TSP) the
-- chain's single outsourced file. Resolved to the file's owning agency each time.
-- Where a chain legitimately has two outsourced files from different agencies the
-- pick is arbitrary, accepted for the small pre-launch note set.

-- 1) Agency-staff author -> their own agency.
UPDATE "ChainLinkEntry" e
SET "authorSideKey" = 'agency:' || u."agencyId"
FROM "User" u
WHERE e."authorId" = u."id" AND u."agencyId" IS NOT NULL;

-- 2) External-business author -> the chain file tagged to that business.
UPDATE "ChainLinkEntry" e
SET "authorSideKey" = 'agency:' || t."agencyId"
FROM "User" u, "ChainLink" cl, "ChainLink" cl2, "PropertyTransaction" t
WHERE e."authorId" = u."id"
  AND u."agencyId" IS NULL
  AND u."progressionBusinessId" IS NOT NULL
  AND e."chainLinkId" = cl."id"
  AND cl2."chainId" = cl."chainId"
  AND cl2."transactionId" = t."id"
  AND t."progressionBusinessId" = u."progressionBusinessId";

-- 3) Internal/TSP author -> a chain file assigned to them.
UPDATE "ChainLinkEntry" e
SET "authorSideKey" = 'agency:' || t."agencyId"
FROM "User" u, "ChainLink" cl, "ChainLink" cl2, "PropertyTransaction" t
WHERE e."authorId" = u."id"
  AND u."agencyId" IS NULL
  AND u."progressionBusinessId" IS NULL
  AND e."chainLinkId" = cl."id"
  AND cl2."chainId" = cl."chainId"
  AND cl2."transactionId" = t."id"
  AND t."assignedUserId" = u."id";

-- 4) Anything still 'tsp-internal' -> the chain's single outsourced TSP file.
UPDATE "ChainLinkEntry" e
SET "authorSideKey" = 'agency:' || t."agencyId"
FROM "ChainLink" cl, "ChainLink" cl2, "PropertyTransaction" t
WHERE e."authorSideKey" = 'tsp-internal'
  AND e."chainLinkId" = cl."id"
  AND cl2."chainId" = cl."chainId"
  AND cl2."transactionId" = t."id"
  AND t."progressionBusinessId" IS NULL
  AND t."serviceType"::text = 'outsourced';
