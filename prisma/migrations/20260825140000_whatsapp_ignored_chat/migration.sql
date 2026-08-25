-- CreateTable
CREATE TABLE "WhatsAppIgnoredChat" (
    "id" TEXT NOT NULL,
    "waChatId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppIgnoredChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppIgnoredChat_waChatId_key" ON "WhatsAppIgnoredChat"("waChatId");
