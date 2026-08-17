// Claim-cycle welcome email — sent in place of activation_day_1 when an agent
// creates their account through the chain claim flow (invited via a chain
// link → claims their sale → signs up). Self-serve signups continue to use
// sendWelcomeEmailIfNotSent (which fires activation_day_1).
//
// Dedup is shared with the generic welcome via User.welcomeEmailSentAt — the
// atomic check-and-stamp below means a user cannot receive both the generic
// activation_day_1 AND this claim_welcome. Whichever helper wins the UPDATE
// first sends; the other short-circuits.
//
// Fire-and-forget: callers should NOT await this. SendGrid hiccups must not
// fail the signup or claim response. All errors are logged here and swallowed.
//
// Not wired into the signup/claim pipeline yet — kept dormant pending review.
// See /test/claim-welcome for a rendered preview with sample data.

import { prisma } from "@/lib/prisma";
import { sendAgentEmail } from "@/lib/email/agent-log";
import { buildClaimWelcome } from "@/lib/emails/retention";
import { extractFirstName } from "@/lib/contacts/displayName";

type ClaimWelcomeArgs = {
  userId: string;
  transactionId: string;
  propertyAddress: string;
};

export async function sendClaimWelcomeIfNotSent(args: ClaimWelcomeArgs): Promise<void> {
  const { userId, transactionId, propertyAddress } = args;
  try {
    // Same atomic check-and-stamp as sendWelcomeEmailIfNotSent. Either helper
    // can be the winner; the other will see count=0 and skip.
    const result = await prisma.user.updateMany({
      where: { id: userId, welcomeEmailSentAt: null },
      data: { welcomeEmailSentAt: new Date() },
    });
    if (result.count === 0) {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user?.email) {
      console.error(`[sendClaimWelcome] user ${userId} stamped but has no email — welcome NOT sent`);
      return;
    }

    const firstName = user.name?.trim() ? extractFirstName(user.name) : "there";
    const ctaUrl = `${process.env.NEXTAUTH_URL ?? ""}/agent/transactions/${transactionId}`;

    const built = buildClaimWelcome({
      firstName,
      address: propertyAddress,
      ctaUrl,
    });

    await sendAgentEmail({
      to: user.email,
      subject: built.subject,
      text: built.text,
      html: built.html,
      kind: "claim_welcome",
      userId,
      transactionId,
    });
    console.log(`[sendClaimWelcome] sent to userId=${userId} txId=${transactionId}`);
  } catch (err) {
    console.error(`[sendClaimWelcome] failed for userId=${userId}:`, err);
  }
}
