-- Add the solicitor milestone-confirmation chase to the ChaseSend effectiveness log.
ALTER TYPE "ChaseSendKind" ADD VALUE IF NOT EXISTS 'milestone';
