-- CreateTable
CREATE TABLE "PostcodeRoute" (
    "id" TEXT NOT NULL,
    "originPostcode" TEXT NOT NULL,
    "destPostcode" TEXT NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "geometry" JSONB NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openroute',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostcodeRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostcodeRoute_originPostcode_destPostcode_key" ON "PostcodeRoute"("originPostcode", "destPostcode");
