-- Tier-2 per-agency email templates + a unified append-only edit audit.
-- Additive only; nothing reads these until the Tier-2 resolver + editor ship.

-- Per-agency override of a non-milestone automated email's editable prose.
CREATE TABLE "AgencyEmailTemplate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'default',
    "content" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyEmailTemplate_agencyId_templateKey_variant_key"
    ON "AgencyEmailTemplate" ("agencyId", "templateKey", "variant");
CREATE INDEX "AgencyEmailTemplate_agencyId_idx" ON "AgencyEmailTemplate" ("agencyId");

ALTER TABLE "AgencyEmailTemplate"
    ADD CONSTRAINT "AgencyEmailTemplate_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only audit of every agency email-copy edit (milestone + template).
CREATE TABLE "AgencyEmailEdit" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "editKey" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "contentSnapshot" JSONB,
    "editedById" TEXT,
    "editedByName" TEXT NOT NULL,
    "editedByEmail" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyEmailEdit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgencyEmailEdit_agencyId_editedAt_idx" ON "AgencyEmailEdit" ("agencyId", "editedAt");
CREATE INDEX "AgencyEmailEdit_kind_editKey_idx" ON "AgencyEmailEdit" ("kind", "editKey");

ALTER TABLE "AgencyEmailEdit"
    ADD CONSTRAINT "AgencyEmailEdit_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
