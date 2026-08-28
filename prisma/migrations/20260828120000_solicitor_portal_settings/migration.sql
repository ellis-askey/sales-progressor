-- Solicitor portal settings: handler profile photo + timed reminder pause.
ALTER TABLE "SolicitorContact" ADD COLUMN "image" TEXT;
ALTER TABLE "PropertyTransaction" ADD COLUMN "vendorSolicitorEmailsPausedUntil" TIMESTAMP(3);
ALTER TABLE "PropertyTransaction" ADD COLUMN "purchaserSolicitorEmailsPausedUntil" TIMESTAMP(3);
