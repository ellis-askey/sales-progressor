-- Optional shortened display label for a progression business, used in tight UI
-- such as the agent file's "Managed by …" badge. Null falls back to `name`.
ALTER TABLE "ProgressionBusiness" ADD COLUMN "shortName" TEXT;
