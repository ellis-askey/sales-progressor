-- Review state for the Command Centre Email Catalogue (/command/emails).
CREATE TABLE "EmailCatalogueReview" (
    "id" TEXT NOT NULL,
    "specimenId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedByEmail" TEXT,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "EmailCatalogueReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailCatalogueReview_specimenId_key" ON "EmailCatalogueReview"("specimenId");
