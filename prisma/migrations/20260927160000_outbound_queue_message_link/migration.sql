-- Link a queued CLIENT_CHASE send to its Command Centre Messages mirror
-- (OutboundMessage), so the SendGrid delivery webhook can mirror deliveredAt /
-- openedAt onto that row and the Messages lifecycle populates. Additive,
-- nullable, capture-only: no send path reads it, nothing client-facing changes.
ALTER TABLE "OutboundEmailQueue" ADD COLUMN "outboundMessageId" TEXT;
