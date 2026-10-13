-- Managed-freehold flag: a freehold that still has a management pack (estate
-- rentcharge / management company). Additive, defaulted false — safe.
-- When on, the management-pack steps stop auto-NR-ing and the enquiries tracker
-- gains the "waiting on management pack" hold.
ALTER TABLE "PropertyTransaction" ADD COLUMN "hasManagementPack" BOOLEAN NOT NULL DEFAULT false;
