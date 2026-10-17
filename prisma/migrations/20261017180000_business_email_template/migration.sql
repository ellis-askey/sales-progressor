-- Piece 1 (automated emails for progression businesses): a business's own Tier-2
-- email overrides, the counterpart to AgencyEmailTemplate. Resolution at send time
-- mirrors the milestone layer: business override -> platform default -> code default.
CREATE TABLE "BusinessEmailTemplate" (
    "id" TEXT NOT NULL,
    "progressionBusinessId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'default',
    "content" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessEmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessEmailTemplate_progressionBusinessId_templateKey_vari_key" ON "BusinessEmailTemplate"("progressionBusinessId", "templateKey", "variant");

CREATE INDEX "BusinessEmailTemplate_progressionBusinessId_idx" ON "BusinessEmailTemplate"("progressionBusinessId");
