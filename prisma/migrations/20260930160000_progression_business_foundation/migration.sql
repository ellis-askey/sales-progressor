-- Progression-business foundation (docs/active/progression-businesses/), Phase 1.
-- Purely additive: one enum, two tables, two nullable columns (User,
-- PropertyTransaction), indexes + FKs, and an idempotent seed of progression
-- business #1 (The Sales Progressor, the platform operator). No existing rows
-- are modified. A null PropertyTransaction.progressionBusinessId means TSP —
-- there is NO backfill of existing/legacy files.

-- CreateEnum
CREATE TYPE "ProgressionBusinessRole" AS ENUM ('owner', 'progressor');

-- CreateTable
CREATE TABLE "ProgressionBusiness" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isTsp" BOOLEAN NOT NULL DEFAULT false,
    "contactWhatsapp" TEXT,
    "senderEmail" TEXT,
    "senderDomain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionBusiness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressionBusinessClient" (
    "id" TEXT NOT NULL,
    "progressionBusinessId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressionBusinessClient_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "progressionBusinessId" TEXT,
    ADD COLUMN "progressionBusinessRole" "ProgressionBusinessRole";

-- AlterTable
ALTER TABLE "PropertyTransaction"
    ADD COLUMN "progressionBusinessId" TEXT;

-- CreateIndex
CREATE INDEX "ProgressionBusiness_isTsp_idx" ON "ProgressionBusiness"("isTsp");

-- CreateIndex
CREATE INDEX "ProgressionBusinessClient_agencyId_idx" ON "ProgressionBusinessClient"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionBusinessClient_progressionBusinessId_agencyId_key" ON "ProgressionBusinessClient"("progressionBusinessId", "agencyId");

-- CreateIndex
CREATE INDEX "PropertyTransaction_progressionBusinessId_status_idx" ON "PropertyTransaction"("progressionBusinessId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTransaction" ADD CONSTRAINT "PropertyTransaction_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionBusinessClient" ADD CONSTRAINT "ProgressionBusinessClient_progressionBusinessId_fkey" FOREIGN KEY ("progressionBusinessId") REFERENCES "ProgressionBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionBusinessClient" ADD CONSTRAINT "ProgressionBusinessClient_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed progression business #1 (The Sales Progressor), idempotent. Staging/local
-- sync the schema via `prisma db push`, which SKIPS this migration — run
-- scripts/seed-progression-tsp.ts (or `npm run db:seed`) there instead.
INSERT INTO "ProgressionBusiness" ("id", "name", "isTsp", "contactWhatsapp", "senderEmail", "senderDomain", "createdAt", "updatedAt")
SELECT 'progression_business_tsp', 'The Sales Progressor', true, '+447508862929', 'ellis@thesalesprogressor.co.uk', 'thesalesprogressor.co.uk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ProgressionBusiness" WHERE "isTsp" = true);
