-- Related-sale tracker (2026-08-29). Make the onward tracker direction-aware so
-- one system holds both a seller's onward purchase (above, PM steps) and a
-- buyer's related sale (below, VM steps). Additive + safe: every existing row
-- becomes kind = onward_purchase, so the seller flow is unchanged.

-- New direction discriminator.
CREATE TYPE "OnwardTrackerKind" AS ENUM ('onward_purchase', 'related_sale');
ALTER TABLE "OnwardTracker" ADD COLUMN "kind" "OnwardTrackerKind" NOT NULL DEFAULT 'onward_purchase';

-- One tracker per (transaction, kind) — was one per transaction. Every existing
-- row is onward_purchase, so (transactionId, 'onward_purchase') is already unique.
DROP INDEX "OnwardTracker_transactionId_key";
CREATE UNIQUE INDEX "OnwardTracker_transactionId_kind_key" ON "OnwardTracker"("transactionId", "kind");

-- The buyer is the reporting client on a related sale.
ALTER TYPE "OnwardConfirmSource" ADD VALUE 'buyer';
