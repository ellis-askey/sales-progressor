-- CreateTable
CREATE TABLE "GeneratedImage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imageType" TEXT NOT NULL,
    "variant" TEXT,
    "prompt" TEXT,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 1200,
    "height" INTEGER NOT NULL DEFAULT 628,
    "aiModel" TEXT,
    "aiCostCents" INTEGER NOT NULL DEFAULT 0,
    "draftPostId" TEXT,

    CONSTRAINT "GeneratedImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GeneratedImage_createdAt_idx" ON "GeneratedImage"("createdAt");
CREATE INDEX "GeneratedImage_imageType_createdAt_idx" ON "GeneratedImage"("imageType", "createdAt");
