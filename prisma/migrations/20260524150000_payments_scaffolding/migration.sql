-- Payments scaffolding — PR 1 of the build plan at
-- docs/active/payments-build-plan.md.
--
-- Adds the schema substrate for the locked payments model:
--   • Agency: frozen-trial anchor (firstSubmissionAt), VAT scaffolding
--     (vatRegisteredAt + vatRateBps), Stripe + payment-lifecycle fields.
--   • PropertyTransaction: freeOnExchange flag (stamped at create, frozen),
--     exchangedAt (did it exchange?), billedAtExchange (did it bill?),
--     priceAtExchange (snapshot taken at exchange — immune to later edits).
--   • New tables: Invoice, InvoiceLine, TermsVersion, PricingAcknowledgement,
--     CreditNote. Two new enums: InvoiceStatus, InvoiceLineKind.
--
-- NO BEHAVIOUR CHANGE in this PR. The fields/tables exist; nothing reads or
-- writes them yet. Subsequent PRs wire the trial stamp (PR 2), exchange
-- snapshot (PR 3), reversal handling (PR 4), accrual + director view (PR 5),
-- Stripe Elements + acknowledgement gate (PR 6), real charging + failed-
-- payment block (PR 7), VAT flip rehearsal (PR 8).
--
-- Backfill (inline, at the bottom): existing Agency rows that already have at
-- least one PropertyTransaction get firstSubmissionAt set to the earliest
-- createdAt of their transactions, so already-running agencies aren't
-- accidentally treated as "in trial today" when PR 2 starts reading the field.
-- Agencies with zero transactions stay null — semantically correct, they
-- haven't submitted yet.
--
-- TermsVersion ships EMPTY. Its first row is inserted only when the actual
-- pricing disclosure copy is designed (separate task before PR 6 lands).
-- Do not seed with placeholder text.

-- ─── Agency: new columns ──────────────────────────────────────────────────
ALTER TABLE "Agency"
  ADD COLUMN "firstSubmissionAt"        TIMESTAMP(3),
  ADD COLUMN "vatRegisteredAt"          TIMESTAMP(3),
  ADD COLUMN "vatRateBps"               INTEGER,
  ADD COLUMN "stripeCustomerId"         TEXT,
  ADD COLUMN "paymentFailedAt"          TIMESTAMP(3),
  ADD COLUMN "newFileCreationBlockedAt" TIMESTAMP(3);

-- ─── PropertyTransaction: new columns ─────────────────────────────────────
ALTER TABLE "PropertyTransaction"
  ADD COLUMN "freeOnExchange"   BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "exchangedAt"      TIMESTAMP(3),
  ADD COLUMN "billedAtExchange" TIMESTAMP(3),
  ADD COLUMN "priceAtExchange"  INTEGER;

-- ─── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "InvoiceStatus" AS ENUM ('building', 'issued', 'paid', 'failed', 'void');

CREATE TYPE "InvoiceLineKind" AS ENUM ('in_house_fee', 'outsourced_fee', 'credit_applied');

-- ─── Invoice ──────────────────────────────────────────────────────────────
CREATE TABLE "Invoice" (
    "id"              TEXT            NOT NULL,
    "agencyId"        TEXT            NOT NULL,
    "monthStart"      TIMESTAMP(3)    NOT NULL,
    "status"          "InvoiceStatus" NOT NULL DEFAULT 'building',
    "issuedAt"        TIMESTAMP(3),
    "paidAt"          TIMESTAMP(3),
    "stripeInvoiceId" TEXT,
    "createdAt"       TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_agencyId_monthStart_key" ON "Invoice"("agencyId", "monthStart");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── InvoiceLine ──────────────────────────────────────────────────────────
CREATE TABLE "InvoiceLine" (
    "id"            TEXT              NOT NULL,
    "invoiceId"     TEXT              NOT NULL,
    "transactionId" TEXT,
    "kind"          "InvoiceLineKind" NOT NULL,
    "description"   TEXT              NOT NULL,
    "amountPence"   INTEGER           NOT NULL,
    "vatPence"      INTEGER           NOT NULL DEFAULT 0,
    "totalPence"    INTEGER           NOT NULL,
    "createdAt"     TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
CREATE INDEX "InvoiceLine_transactionId_idx" ON "InvoiceLine"("transactionId");

ALTER TABLE "InvoiceLine"
  ADD CONSTRAINT "InvoiceLine_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InvoiceLine"
  ADD CONSTRAINT "InvoiceLine_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── TermsVersion ─────────────────────────────────────────────────────────
-- Ships empty. First row inserted when real disclosure copy is designed.
CREATE TABLE "TermsVersion" (
    "id"            TEXT         NOT NULL,
    "versionTag"    TEXT         NOT NULL,
    "body"          TEXT         NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TermsVersion_versionTag_key" ON "TermsVersion"("versionTag");

-- ─── PricingAcknowledgement ───────────────────────────────────────────────
-- acknowledgedByName + acknowledgedByEmail are the durable audit record.
-- The FK to User is a convenience link that nulls on user delete (GDPR-safe).
CREATE TABLE "PricingAcknowledgement" (
    "id"                   TEXT         NOT NULL,
    "agencyId"             TEXT         NOT NULL,
    "acknowledgedByUserId" TEXT,
    "acknowledgedByName"   TEXT         NOT NULL,
    "acknowledgedByEmail"  TEXT         NOT NULL,
    "termsVersionId"       TEXT         NOT NULL,
    "acknowledgedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PricingAcknowledgement_agencyId_idx" ON "PricingAcknowledgement"("agencyId");

ALTER TABLE "PricingAcknowledgement"
  ADD CONSTRAINT "PricingAcknowledgement_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PricingAcknowledgement"
  ADD CONSTRAINT "PricingAcknowledgement_acknowledgedByUserId_fkey"
  FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PricingAcknowledgement"
  ADD CONSTRAINT "PricingAcknowledgement_termsVersionId_fkey"
  FOREIGN KEY ("termsVersionId") REFERENCES "TermsVersion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CreditNote ───────────────────────────────────────────────────────────
CREATE TABLE "CreditNote" (
    "id"                 TEXT         NOT NULL,
    "agencyId"           TEXT         NOT NULL,
    "transactionId"      TEXT,
    "amountPence"        INTEGER      NOT NULL,
    "reason"             TEXT         NOT NULL,
    "appliedToInvoiceId" TEXT,
    "appliedAt"          TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CreditNote_agencyId_idx" ON "CreditNote"("agencyId");
CREATE INDEX "CreditNote_appliedToInvoiceId_idx" ON "CreditNote"("appliedToInvoiceId");

ALTER TABLE "CreditNote"
  ADD CONSTRAINT "CreditNote_agencyId_fkey"
  FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreditNote"
  ADD CONSTRAINT "CreditNote_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreditNote"
  ADD CONSTRAINT "CreditNote_appliedToInvoiceId_fkey"
  FOREIGN KEY ("appliedToInvoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill: Agency.firstSubmissionAt ───────────────────────────────────
-- For every agency that already has at least one PropertyTransaction, set
-- firstSubmissionAt to the earliest transaction's createdAt. Agencies with
-- zero transactions stay null — they haven't submitted yet, so the trial
-- window evaluator (PR 2) will correctly stamp firstSubmissionAt and
-- freeOnExchange = true on their first-ever submission.
UPDATE "Agency"
SET "firstSubmissionAt" = sub."earliest"
FROM (
  SELECT "agencyId", MIN("createdAt") AS "earliest"
  FROM "PropertyTransaction"
  GROUP BY "agencyId"
) AS sub
WHERE "Agency"."id" = sub."agencyId"
  AND "Agency"."firstSubmissionAt" IS NULL;
