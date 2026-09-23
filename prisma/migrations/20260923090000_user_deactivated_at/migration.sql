-- Team removal ends access (2026-09-23). Additive only: removed members gain a
-- deactivatedAt stamp; sign-in refuses it and reinstating clears it. Existing
-- rows are unaffected (NULL = active).

ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
