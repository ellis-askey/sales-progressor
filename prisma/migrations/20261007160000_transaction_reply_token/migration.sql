-- Reply-capture token for per-file emails sent via a connected mailbox (eXp etc.).
-- Lazily minted; unique so a reply address maps to exactly one file.
ALTER TABLE "PropertyTransaction" ADD COLUMN "replyToken" TEXT;

CREATE UNIQUE INDEX "PropertyTransaction_replyToken_key" ON "PropertyTransaction"("replyToken");
