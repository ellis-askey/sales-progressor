-- Snooze/dismiss store for the hub "Gone quiet" + "Mortgage offers expiring"
-- cards, so a handled row can be cleared instead of nagging forever.
CREATE TABLE "HubCardDismissal" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "cardKind" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "dismissedUntil" TIMESTAMP(3) NOT NULL,
    "dismissedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HubCardDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HubCardDismissal_transactionId_cardKind_signature_key" ON "HubCardDismissal"("transactionId", "cardKind", "signature");
CREATE INDEX "HubCardDismissal_cardKind_dismissedUntil_idx" ON "HubCardDismissal"("cardKind", "dismissedUntil");

ALTER TABLE "HubCardDismissal" ADD CONSTRAINT "HubCardDismissal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
