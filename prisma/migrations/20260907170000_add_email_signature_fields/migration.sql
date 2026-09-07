-- Email signature (per-agent). BASIC is the default for every existing user.
-- Staging is synced via `prisma db push`; production applies this file via
-- `prisma migrate deploy`. See docs/active/email-signature/00-audit-and-plan.md.
CREATE TYPE "EmailSignatureMode" AS ENUM ('BASIC', 'IMAGE', 'CUSTOM');

ALTER TABLE "User" ADD COLUMN "emailSignatureMode" "EmailSignatureMode" NOT NULL DEFAULT 'BASIC';
ALTER TABLE "User" ADD COLUMN "emailSignatureImagePath" TEXT;
ALTER TABLE "User" ADD COLUMN "emailSignatureHtml" TEXT;
