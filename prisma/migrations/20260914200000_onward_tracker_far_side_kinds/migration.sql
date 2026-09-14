-- Chain far-side tracker kinds: the onward property's seller (VM) and the related
-- sale's buyer (PM), agent-only. Enum-value additions only; no data change.
ALTER TYPE "OnwardTrackerKind" ADD VALUE IF NOT EXISTS 'onward_purchase_seller';
ALTER TYPE "OnwardTrackerKind" ADD VALUE IF NOT EXISTS 'related_sale_buyer';
