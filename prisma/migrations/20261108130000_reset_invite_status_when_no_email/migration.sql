-- Fix stale invite state: a stub whose email was later cleared kept inviteStatus
-- 'SENT', so its card showed "Invited" + "Resend invite" with no address to send to.
-- Reset those to NOT_SENT so they correctly read "Add email to invite".
-- (Going forward, updateChainLinkStub resets this whenever the email is cleared.)

UPDATE "ChainLink"
  SET "inviteStatus" = 'NOT_SENT', "inviteSentAt" = NULL
  WHERE "transactionId" IS NULL
    AND ("stubAgentEmail" IS NULL OR "stubAgentEmail" = '')
    AND "inviteStatus" = 'SENT';
