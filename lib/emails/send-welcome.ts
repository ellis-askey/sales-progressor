// Instant welcome email — the synchronous counterpart to the activation_day_1
// retention cron. Fired the moment a user becomes a real customer:
//   - Password signups: end of /api/register POST (in app/api/register/route.ts)
//   - OAuth signups: end of completeOAuthSignup (in app/actions/complete-oauth-signup.ts)
//
// Dedup is the column itself, not a separate "first time" detection mechanism.
// The atomic check-and-stamp pattern below guarantees AT MOST one welcome per
// user, no matter how many code paths call this helper concurrently — Postgres
// serialises the UPDATE on the row, so only one writer transitions
// welcomeEmailSentAt from NULL to a timestamp. The day-1 retention cron skips
// any user where this column is non-null (lib/services/retention.ts), so the
// cron acts as a fallback backstop without ever duplicating a send.
//
// Fire-and-forget: callers should NOT await this. SendGrid hiccups must not
// fail the signup response. All errors are logged here and swallowed.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildActivationDay1 } from "@/lib/emails/retention";
import { extractFirstName } from "@/lib/contacts/displayName";

export async function sendWelcomeEmailIfNotSent(userId: string): Promise<void> {
  try {
    // Atomic check-and-stamp. updateMany returns count=1 only if the WHERE
    // clause matched a row — i.e. only if welcomeEmailSentAt was NULL at the
    // moment of the UPDATE. Two concurrent callers can't both win this.
    const result = await prisma.user.updateMany({
      where: { id: userId, welcomeEmailSentAt: null },
      data: { welcomeEmailSentAt: new Date() },
    });
    if (result.count === 0) {
      // Already stamped — either a previous call won the race, or a manual
      // stamp was applied. Either way, no email needs to fire.
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user?.email) {
      console.error(`[sendWelcomeEmail] user ${userId} stamped but has no email — welcome NOT sent`);
      return;
    }

    const firstName = user.name?.trim() ? extractFirstName(user.name) : "there";
    const ctaUrl = `${process.env.NEXTAUTH_URL ?? ""}/agent/transactions/new-v2`;

    const built = buildActivationDay1({ firstName, ctaUrl });

    await sendEmail({
      to: user.email,
      subject: built.subject,
      text: built.text,
      html: built.html,
    });
    console.log(`[sendWelcomeEmail] sent to userId=${userId}`);
  } catch (err) {
    console.error(`[sendWelcomeEmail] failed for userId=${userId}:`, err);
  }
}
