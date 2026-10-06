-- Business/company client (critique 2026-10-05). `name` stays the contact person
-- we address; `companyName` holds the company (shown as the party / on legal
-- surfaces). Both additive and safe: existing rows default to isBusiness=false,
-- companyName=NULL — no behaviour change.
ALTER TABLE "Contact" ADD COLUMN "isBusiness" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN "companyName" TEXT;
