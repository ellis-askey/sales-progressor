-- Content & Personal Brand, Phase 3.3: learned voice profile.
-- docs/active/content-brand/SPEC.md

-- CreateTable
CREATE TABLE "VoiceProfile" (
    "id" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "characteristics" JSONB,
    "dismissed" JSONB,
    "generatedAt" TIMESTAMP(3),
    "sampleCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VoiceProfile_pkey" PRIMARY KEY ("id")
);
