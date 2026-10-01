-- CreateTable
CREATE TABLE "AreaSalesCount" (
    "id" TEXT NOT NULL,
    "outcode" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AreaSalesCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AreaSalesCount_outcode_months_key" ON "AreaSalesCount"("outcode", "months");

-- CreateIndex
CREATE INDEX "AreaSalesCount_fetchedAt_idx" ON "AreaSalesCount"("fetchedAt");
