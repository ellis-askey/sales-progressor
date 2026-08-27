-- Made-up demo staff marker on User. See docs/active/demo-sale/SPEC.md.
ALTER TABLE "User" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
