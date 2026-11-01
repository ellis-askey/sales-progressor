-- Boardwalk self-service Migrate Sale: import-time anchor + idempotency.
-- Additive only (nullable columns + one unique index). No drops, no backfill.
-- IF NOT EXISTS throughout so it is safe to apply via the pooler (prisma db
-- execute, this repo's staging path — the direct host is IPv6-only) AND later
-- via `migrate deploy` without double-apply errors.
--
--   migratedAt              import instant; the floor forward-automation respects
--                           for migrated files (chase anchors never precede it)
--   migrationIdempotencyKey client-minted key; retry resolves to the same file
--   migrationFinalizedAt    stamped only after a complete import succeeds

ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "migratedAt" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "migrationIdempotencyKey" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "migrationFinalizedAt" TIMESTAMP(3);

-- Unique index (nullable column => many NULLs allowed in Postgres, one row per key).
CREATE UNIQUE INDEX IF NOT EXISTS "PropertyTransaction_migrationIdempotencyKey_key"
  ON "PropertyTransaction"("migrationIdempotencyKey");
