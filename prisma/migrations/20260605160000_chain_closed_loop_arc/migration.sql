-- Chain closed-loop arc (2026-06-05)
--
-- Adds the data model for direction-aware withdraw cascades, the
-- BUYER_FOUND relist cascade, the orphan-segment split + CHAIN_DETACHED
-- notification, the per-round chain snapshot for the archived-round
-- drawer, and the chainSetupPending flag for the relist modal's
-- "complete chain setup" hub prompt.
--
-- Migration order is safe to apply in any direction:
--   - New enums (BUYER_FOUND, CHAIN_DETACHED, WithdrawalReason): additive
--   - New nullable columns + default-false boolean: backwards-compatible
--   - No data backfill required; existing files default to NULL on
--     withdrawalReason / chainSnapshot / detachedAt, false on
--     chainSetupPending. The new cascade behaviour kicks in only when
--     the withdraw action sets withdrawalReason on future withdrawals.

ALTER TYPE "ChainNotificationType" ADD VALUE 'BUYER_FOUND';
ALTER TYPE "ChainNotificationType" ADD VALUE 'CHAIN_DETACHED';

CREATE TYPE "WithdrawalReason" AS ENUM (
  'BUYER_WITHDREW',
  'SELLER_WITHDREW',
  'CHAIN_COLLAPSE_ABOVE',
  'OTHER'
);

ALTER TABLE "PropertyTransaction"
  ADD COLUMN "withdrawalReason" "WithdrawalReason",
  ADD COLUMN "chainSetupPending" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "BuyerRound"
  ADD COLUMN "chainSnapshot" JSONB;

ALTER TABLE "ChainLink"
  ADD COLUMN "detachedAt" TIMESTAMP(3),
  ADD COLUMN "detachedFromChainId" TEXT;

-- Index supports the audit query "find every link that was detached
-- from chain X" (used by the archived-round drawer's split badge to
-- find the orphan segment's new chainId in one round-trip).
CREATE INDEX "ChainLink_detachedFromChainId_idx"
  ON "ChainLink"("detachedFromChainId");
