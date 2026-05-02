-- CreateEnum
CREATE TYPE "DraftChannel" AS ENUM ('linkedin', 'tiktok_script', 'instagram_caption');

-- CreateTable
CREATE TABLE "DraftPost" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "DraftChannel" NOT NULL,
    "tone" TEXT,
    "topicSeed" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "aiModel" TEXT NOT NULL,
    "aiPromptVersion" TEXT NOT NULL,
    "variant1" TEXT NOT NULL,
    "variant2" TEXT NOT NULL,
    "editedText" TEXT,
    "chosenVariant" INTEGER,
    "posted" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "regenerationCount" INTEGER NOT NULL DEFAULT 0,
    "aiTokensInput" INTEGER,
    "aiTokensOutput" INTEGER,

    CONSTRAINT "DraftPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceSample" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleType" TEXT NOT NULL,
    "questionKey" TEXT,
    "channel" "DraftChannel",
    "content" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "VoiceSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftPost_createdAt_idx" ON "DraftPost"("createdAt");

-- CreateIndex
CREATE INDEX "DraftPost_channel_createdAt_idx" ON "DraftPost"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "DraftPost_posted_idx" ON "DraftPost"("posted");

-- CreateIndex
CREATE INDEX "VoiceSample_sampleType_createdAt_idx" ON "VoiceSample"("sampleType", "createdAt");

-- CreateIndex
CREATE INDEX "VoiceSample_channel_createdAt_idx" ON "VoiceSample"("channel", "createdAt");
