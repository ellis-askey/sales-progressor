-- Provider quotes v1 (recommended surveyors, expandable to electricians etc).
--
-- Adds a small directory of third-party service firms (kind = surveyor for
-- now) plus the client-submitted QuoteRequest capturing which firm they want
-- a quote from, how to reach them, and the fee outcome.
--
-- Client entry point: public no-auth page at /quote/[token] (Contact.portalToken).
-- Admin surface: /command/providers in the Command Centre.
--
-- Generic-from-day-one: ProviderKind enum + ProviderServiceType table means
-- electricians / gas / EPC etc. slot in later with seed rows only. No new
-- tables required to add another profession.

CREATE TYPE "ProviderKind" AS ENUM ('surveyor');
CREATE TYPE "QuoteRequestStatus" AS ENUM ('pending', 'won', 'lost', 'expired');
CREATE TYPE "QuoteContactMethod" AS ENUM ('phone', 'email', 'either');
CREATE TYPE "QuoteContactWindow" AS ENUM ('anytime', 'morning', 'afternoon', 'evening');
CREATE TYPE "QuoteUrgency" AS ENUM ('asap', 'within_week', 'flexible');

CREATE TABLE "ProviderFirm" (
    "id" TEXT NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "logoPath" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderFirm_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderFirm_kind_active_idx" ON "ProviderFirm"("kind", "active");

CREATE TABLE "ProviderCoverage" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "outwardCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderCoverage_providerId_outwardCode_key"
    ON "ProviderCoverage"("providerId", "outwardCode");
CREATE INDEX "ProviderCoverage_outwardCode_idx" ON "ProviderCoverage"("outwardCode");

CREATE TABLE "ProviderServiceType" (
    "id" TEXT NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderServiceType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderServiceType_kind_active_sortOrder_idx"
    ON "ProviderServiceType"("kind", "active", "sortOrder");

CREATE TABLE "ProviderFirmServiceType" (
    "providerId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderFirmServiceType_pkey" PRIMARY KEY ("providerId", "serviceTypeId")
);

CREATE TABLE "QuoteRequest" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceTypeId" TEXT NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "contactMethod" "QuoteContactMethod" NOT NULL,
    "contactWindow" "QuoteContactWindow" NOT NULL,
    "urgency" "QuoteUrgency" NOT NULL,
    "notes" TEXT,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT,
    "propertyAddress" TEXT NOT NULL,
    "propertyPostcode" TEXT NOT NULL,
    "propertyOutwardCode" TEXT NOT NULL,
    "status" "QuoteRequestStatus" NOT NULL DEFAULT 'pending',
    "statusReason" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "statusChangedById" TEXT,
    "saleFeePence" INTEGER,
    "referralFeePence" INTEGER,
    "referralFeeCollected" BOOLEAN NOT NULL DEFAULT false,
    "referralFeeCollectedAt" TIMESTAMP(3),
    "emailMessageId" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "anonymisedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuoteRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuoteRequest_transactionId_idx" ON "QuoteRequest"("transactionId");
CREATE INDEX "QuoteRequest_contactId_idx" ON "QuoteRequest"("contactId");
CREATE INDEX "QuoteRequest_providerId_status_idx" ON "QuoteRequest"("providerId", "status");
CREATE INDEX "QuoteRequest_status_submittedAt_idx" ON "QuoteRequest"("status", "submittedAt");

ALTER TABLE "ProviderCoverage"
    ADD CONSTRAINT "ProviderCoverage_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderFirm"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderFirmServiceType"
    ADD CONSTRAINT "ProviderFirmServiceType_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderFirm"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderFirmServiceType"
    ADD CONSTRAINT "ProviderFirmServiceType_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "ProviderServiceType"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "PropertyTransaction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderFirm"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "ProviderServiceType"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "QuoteRequest"
    ADD CONSTRAINT "QuoteRequest_statusChangedById_fkey"
    FOREIGN KEY ("statusChangedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the four baseline surveyor service types. Editable in the Command
-- Centre master list once shipped.
INSERT INTO "ProviderServiceType" ("id", "kind", "label", "description", "sortOrder", "active", "updatedAt")
VALUES
  ('pst_level2',    'surveyor', 'Level 2 HomeBuyer report',    'The standard survey for most homes in reasonable condition. Covers major defects visible without dismantling.', 10, true, CURRENT_TIMESTAMP),
  ('pst_level3',    'surveyor', 'Level 3 Building survey',     'The most thorough survey. Suited to older properties, listed buildings, or homes needing significant work.',    20, true, CURRENT_TIMESTAMP),
  ('pst_valuation', 'surveyor', 'RICS Valuation',              'A market-value assessment. Not a condition survey, usually for tax, probate, or a specific lender ask.',        30, true, CURRENT_TIMESTAMP),
  ('pst_snagging',  'surveyor', 'New-build snagging survey',   'For new-build properties before or shortly after moving in. Lists defects for the developer to fix.',           40, true, CURRENT_TIMESTAMP);
