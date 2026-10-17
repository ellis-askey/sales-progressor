-- Portal-preview + demo solicitor isolation. See docs/active/portal-preview/SPEC.md.
-- Additive, non-destructive.
ALTER TABLE "PropertyTransaction" ADD COLUMN "demoKind" TEXT;
ALTER TABLE "SolicitorFirm" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SolicitorContact" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- One-off cleanup of the EXISTING leak: the demo-sale showcase find-or-created
-- these fake firms into the shared, global-by-name firm table, so they already
-- show in every agent's firm directory. Tag them (and their handlers) as demo so
-- the new isDemo:false filters hide them. Names are the invented demo solicitors
-- (DEMO_SOLICITORS in lib/services/demo-sale.ts); real firms are never named these.
-- NOTE: `prisma db push` (staging) does NOT run this data step — run these two
-- UPDATEs manually on staging when applying. `migrate deploy` (prod) runs them.
UPDATE "SolicitorFirm" SET "isDemo" = true WHERE "name" IN ('Harpenden & Ellwood LLP', 'Verulam Legal');
UPDATE "SolicitorContact" SET "isDemo" = true WHERE "firmId" IN (SELECT "id" FROM "SolicitorFirm" WHERE "isDemo" = true);
