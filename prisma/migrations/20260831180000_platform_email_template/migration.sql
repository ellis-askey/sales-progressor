-- Sales Progressor's own editable defaults for Tier-2 automated emails, edited
-- from the Command Centre. Additive; no row = the built-in code default, so
-- nothing changes until a default is edited.

CREATE TABLE "PlatformEmailTemplate" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'default',
    "content" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformEmailTemplate_templateKey_variant_key"
    ON "PlatformEmailTemplate" ("templateKey", "variant");
