-- AlterTable: add ext_expires_in to Account for Azure AD OAuth compatibility
-- Azure AD token responses include ext_expires_in; PrismaAdapter passes all
-- token fields to account.create(), which fails if the column is missing.
ALTER TABLE "Account" ADD COLUMN "ext_expires_in" INTEGER;
