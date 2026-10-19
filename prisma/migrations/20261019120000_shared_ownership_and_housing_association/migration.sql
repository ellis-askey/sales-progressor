-- Shared ownership (PR1) + Housing Association professional (PR2).
--
-- isSharedOwnership keeps the management-pack steps (VM8/VM9/PM12) live on ANY
-- tenure, the same way a managed freehold does — shared ownership is always a
-- lease with a housing-association pack. The housingAssociation* fields are a
-- lightweight contact for shared-ownership files (name + one contact + email +
-- phone), surfaced as a professional row.
--
-- Already applied to staging via raw ALTER (the IPv6-only direct connection
-- blocks `prisma migrate` from this environment). IF NOT EXISTS keeps this
-- idempotent so prod's `migrate deploy` applies it cleanly and a staging re-run
-- is a no-op.
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "isSharedOwnership" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "housingAssociationName" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "housingAssociationContactName" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "housingAssociationEmail" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN IF NOT EXISTS "housingAssociationPhone" TEXT;
