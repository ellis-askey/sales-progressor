-- Free-form professionals on a file (Professionals tab "Add professional").
-- Contact-card only: no automation reads this table. Additive.
CREATE TABLE "TransactionProfessional" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firmName" TEXT,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionProfessional_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransactionProfessional_transactionId_idx" ON "TransactionProfessional"("transactionId");

ALTER TABLE "TransactionProfessional" ADD CONSTRAINT "TransactionProfessional_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
