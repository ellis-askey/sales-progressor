-- PWA adoption tracking for the Command Centre "App adoption" page.
ALTER TABLE "Contact" ADD COLUMN "pwaInstalledAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "pwaLastOpenedAt" TIMESTAMP(3);
