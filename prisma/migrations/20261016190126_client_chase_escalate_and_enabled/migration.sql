-- Per-rule client-chase escalation count + per-step on/off, plus a per-scope
-- global default. All additive and backwards-compatible: existing rows get
-- escalateAfterChases = NULL (inherit the global) and enabled = true, and the
-- global defaults to 2 (the legacy hard-coded CLIENT_CHASE_COUNT_CAP), so live
-- chase behaviour is unchanged until an agency/business edits it.

ALTER TABLE "Agency" ADD COLUMN "clientChaseEscalateAfter" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "ProgressionBusiness" ADD COLUMN "clientChaseEscalateAfter" INTEGER NOT NULL DEFAULT 2;

ALTER TABLE "AgencyChaseRuleOverride" ADD COLUMN "escalateAfterChases" INTEGER;
ALTER TABLE "AgencyChaseRuleOverride" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "BusinessChaseRuleOverride" ADD COLUMN "escalateAfterChases" INTEGER;
ALTER TABLE "BusinessChaseRuleOverride" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
