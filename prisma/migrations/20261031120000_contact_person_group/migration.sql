-- Onward portal mirror: tie the SAME PERSON across chain-linked files so they
-- can confirm their neighbour file's steps from their sale link even when
-- email/name don't auto-match. Contacts sharing a personGroupId are one person.
-- See docs/active/onward-portal-mirror.md.
--
-- Additive only (ADD COLUMN + index); touches nothing else. Prod applies via
-- `prisma migrate deploy`, so the raw-SQL bodySearch tsvector column on
-- OutboundMessage is never affected.

ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "personGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "Contact_personGroupId_idx" ON "Contact"("personGroupId");
