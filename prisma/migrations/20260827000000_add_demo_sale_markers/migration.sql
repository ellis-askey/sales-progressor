-- Demo showcase file markers. See docs/active/demo-sale/SPEC.md.
-- Additive, non-destructive: two new columns on PropertyTransaction.
ALTER TABLE "PropertyTransaction" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PropertyTransaction" ADD COLUMN "demoExpiresAt" TIMESTAMP(3);
