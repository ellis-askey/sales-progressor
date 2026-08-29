-- Client's own mortgage broker (2026-08-29). Captured when no in-house/TSP broker
-- resolves on the file. Additive + nullable, nothing changes for existing rows.
-- IF NOT EXISTS so a manual staging apply and the later migrate deploy don't clash.
ALTER TABLE "ClientMoveInfo" ADD COLUMN IF NOT EXISTS "ownBrokerName" TEXT;
ALTER TABLE "ClientMoveInfo" ADD COLUMN IF NOT EXISTS "ownBrokerContactName" TEXT;
ALTER TABLE "ClientMoveInfo" ADD COLUMN IF NOT EXISTS "ownBrokerContact" TEXT;
ALTER TABLE "ClientMoveInfo" ADD COLUMN IF NOT EXISTS "ownBrokerAddedByName" TEXT;
