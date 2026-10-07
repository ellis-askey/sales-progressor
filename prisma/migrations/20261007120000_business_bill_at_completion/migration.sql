-- Per-business billing point for the client invoice (D1): bill a sale in the
-- month it completed rather than the month it exchanged. Default false keeps
-- today's exchange-based behaviour. Idempotent for shared-repo safety.
ALTER TABLE "ProgressionBusiness" ADD COLUMN IF NOT EXISTS "billAtCompletion" BOOLEAN NOT NULL DEFAULT false;
