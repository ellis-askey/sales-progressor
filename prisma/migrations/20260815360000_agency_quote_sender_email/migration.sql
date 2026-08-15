-- Per-agency verified sender address for outbound surveyor quote requests.
-- Null → send from the Sales Progressor fallback (ellis@thesalesprogressor.co.uk).
ALTER TABLE "Agency" ADD COLUMN "quoteSenderEmail" TEXT;

-- Seed the known agency senders (matched by name; safe no-op where the agency
-- doesn't exist in this environment). EXP - DB deliberately left null so it
-- falls back to the Sales Progressor address.
UPDATE "Agency" SET "quoteSenderEmail" = 'ellis@akeman-residential.co.uk' WHERE "name" = 'Akeman Residential';
UPDATE "Agency" SET "quoteSenderEmail" = 'salesprogression@oplah.co.uk'   WHERE "name" = 'Oplah Ltd';
UPDATE "Agency" SET "quoteSenderEmail" = 'ellis@viavia.co.uk'             WHERE "name" = 'Via Properties';
UPDATE "Agency" SET "quoteSenderEmail" = 'ellis@meldoneestates.co.uk'     WHERE "name" = 'Meldone Estates';
