-- Platform on/off switches for the five email audience buckets. A row exists
-- only when a bucket has been switched OFF; absence means ON (the safe default).
CREATE TABLE "EmailBucketToggle" (
    "bucket" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "EmailBucketToggle_pkey" PRIMARY KEY ("bucket")
);
