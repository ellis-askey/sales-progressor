-- Dated chase-log entries on a chain node (b1ey9l). Replaces the single
-- chainNotes blob with a running per-node diary. Own-side only (privacy gated
-- in application code, same as chainNotes).
CREATE TABLE "ChainLinkEntry" (
    "id" TEXT NOT NULL,
    "chainLinkId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainLinkEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChainLinkEntry_chainLinkId_createdAt_idx" ON "ChainLinkEntry"("chainLinkId", "createdAt");

ALTER TABLE "ChainLinkEntry" ADD CONSTRAINT "ChainLinkEntry_chainLinkId_fkey" FOREIGN KEY ("chainLinkId") REFERENCES "ChainLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
