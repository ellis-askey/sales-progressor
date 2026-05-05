// lib/chain/invite.ts
// Chain invite email logic. Implemented in Chunk 7.

import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type LinkForInvite = {
  id: string;
  stubAgentEmail: string | null;
  stubAgentName: string | null;
  stubPropertyAddress: string | null;
  stubAgencyName: string | null;
  inviteStatus: string;
  chain: {
    createdByUserId: string | null;
    links: Array<{
      position: number;
      transactionId: string | null;
      transaction: { propertyAddress: string } | null;
      stubPropertyAddress: string | null;
    }>;
  };
};

export type SendChainInviteInput = {
  link: LinkForInvite;
  sentByUserId: string;
  sentByName: string;
};

// Generates a fresh invite token, updates the link, and sends the email.
// Actual email template is built in Chunk 7; this function is the contract.
export async function sendChainInvite(input: SendChainInviteInput): Promise<void> {
  const { link, sentByUserId } = input;
  if (!link.stubAgentEmail) throw new Error("No email on stub — cannot send invite");

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.chainLink.update({
    where: { id: link.id },
    data: {
      inviteToken: token,
      inviteStatus: "SENT",
      inviteSentAt: new Date(),
      lastInviteSentByUserId: sentByUserId,
      inviteResendCount: { increment: 1 },
    },
  });

  // Email sending implemented in Chunk 7
  await sendInviteEmail({ link, token, sentByName: input.sentByName });
}

// Placeholder — replaced with real implementation in Chunk 7
async function sendInviteEmail(_input: {
  link: LinkForInvite;
  token: string;
  sentByName: string;
}): Promise<void> {
  // Chunk 7: build and send HTML email via lib/email.ts
}
