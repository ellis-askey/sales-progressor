-- Add ext_expires_in to Account for Azure AD OAuth compatibility
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "ext_expires_in" INTEGER;

-- NegotiatorInvitation table
-- Director invites a negotiator to join their agency via token-based email flow.
-- Mirrors DirectorInvitation from feature/invite-director; cancelledAt is unique to this model.
-- Run in Supabase SQL editor — do NOT run prisma migrate dev against production.

CREATE TABLE "NegotiatorInvitation" (
    "id"                TEXT         NOT NULL,
    "agencyId"          TEXT         NOT NULL,
    "invitedByUserId"   TEXT         NOT NULL,
    "negotiatorName"    TEXT         NOT NULL,
    "negotiatorEmail"   TEXT         NOT NULL,
    "token"             TEXT         NOT NULL,
    "expiresAt"         TIMESTAMP(3) NOT NULL,
    "acceptedAt"        TIMESTAMP(3),
    "acceptedByUserId"  TEXT,
    "cancelledAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiatorInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NegotiatorInvitation_token_key"
    ON "NegotiatorInvitation"("token");

CREATE INDEX "NegotiatorInvitation_agencyId_idx"
    ON "NegotiatorInvitation"("agencyId");

CREATE INDEX "NegotiatorInvitation_token_idx"
    ON "NegotiatorInvitation"("token");

CREATE INDEX "NegotiatorInvitation_negotiatorEmail_idx"
    ON "NegotiatorInvitation"("negotiatorEmail");

ALTER TABLE "NegotiatorInvitation"
    ADD CONSTRAINT "NegotiatorInvitation_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NegotiatorInvitation"
    ADD CONSTRAINT "NegotiatorInvitation_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NegotiatorInvitation"
    ADD CONSTRAINT "NegotiatorInvitation_acceptedByUserId_fkey"
    FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
