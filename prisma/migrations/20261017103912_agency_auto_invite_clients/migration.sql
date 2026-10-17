-- Agency-level toggle: auto-send the client portal invite when an outsourced
-- sale is added. Default true preserves current behaviour.
ALTER TABLE "Agency" ADD COLUMN "autoInviteClientsOnAdd" BOOLEAN NOT NULL DEFAULT true;
