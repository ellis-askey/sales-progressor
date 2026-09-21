-- CreateTable: founder "Critique" notes. Private, screenshotted notes-to-self
-- reviewed in the Command Centre (superadmin-only). Deliberately its own table,
-- never mixed with real user feedback (FeedbackSubmission) — no shared rows, no
-- per-query type filter to forget.
CREATE TABLE "CritiqueNote" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "body" TEXT NOT NULL,
    "screenshotPath" TEXT,
    "screenshotFilename" TEXT,
    "pageUrl" TEXT,
    "viewportSize" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "adminNotes" TEXT,

    CONSTRAINT "CritiqueNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: open/done split (resolvedAt NULL = open) newest-first.
CREATE INDEX "CritiqueNote_resolvedAt_createdAt_idx" ON "CritiqueNote"("resolvedAt", "createdAt");
