import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildGreeting } from "@/lib/portal-copy";
import { extractFirstName } from "@/lib/contacts/displayName";

export async function sendCompletionSurveys(transactionId: string): Promise<void> {
  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: transactionId },
    select: {
      propertyAddress: true,
      contacts: {
        where: { email: { not: null }, roleType: { in: ["purchaser", "vendor"] } },
        select: { id: true, name: true, email: true, portalToken: true, roleType: true },
      },
    },
  });

  if (!tx) return;

  const base = process.env.NEXTAUTH_URL ?? "";

  for (const contact of tx.contacts) {
    if (!contact.email || !contact.portalToken) continue;

    const roleLabel = contact.roleType === "purchaser" ? "purchase" : "sale";
    const subject = `Congratulations on your ${roleLabel} — how was your experience?`;
    const surveyUrl = `${base}/feedback/${contact.portalToken}/survey`;

    const text = [
      buildGreeting(contact.name),
      ``,
      `Congratulations on completing your ${roleLabel} at ${tx.propertyAddress}!`,
      ``,
      `We hope the experience was smooth. We would love to hear your thoughts — it only takes a minute:`,
      ``,
      `${surveyUrl}`,
      ``,
      `Your feedback helps us improve the service for everyone.`,
      ``,
      `Warm regards,`,
      `The Sales Progressor Team`,
    ].join("\n");

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">Congratulations, ${extractFirstName(contact.name)}!</h1>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Your ${roleLabel} at <strong>${tx.propertyAddress}</strong> is now complete. We hope the process was as smooth as possible.</p>
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">We'd love to hear about your experience — it only takes a minute and helps us improve for everyone.</p>
<p style="margin:0 0 24px"><a href="${surveyUrl}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">Rate your experience →</a></p>
<p style="margin:0;font-size:12px;color:#8b91a3">You're receiving this because you recently completed a property transaction managed by Sales Progressor.</p>
</body></html>`;

    await sendEmail({ to: contact.email, subject, text, html }).catch(() => {});
  }
}
