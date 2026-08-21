-- Optional assistant/secretary email CC'd on solicitor comms.
ALTER TABLE "SolicitorContact" ADD COLUMN IF NOT EXISTS "secondaryEmail" TEXT;
