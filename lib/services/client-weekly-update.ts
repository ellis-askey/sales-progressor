import { prisma } from "@/lib/prisma";
import { preheader } from "@/lib/email/preheader";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { buildGreeting } from "@/lib/portal-copy";

export async function sendClientWeeklyUpdates(agencyId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // Agency-level opt-out: a director can switch the whole weekly update off.
  const agencyPref = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { weeklyClientUpdatesEnabled: true },
  });
  if (agencyPref && agencyPref.weeklyClientUpdatesEnabled === false) return 0;

  // Active transactions for this agency
  const transactions = await prisma.propertyTransaction.findMany({
    where: { agencyId, status: "active" },
    select: {
      id: true,
      propertyAddress: true,
      serviceType: true,
      agentUser: { select: { name: true } },
      assignedUser: { select: { name: true } },
      agency: { select: { name: true } },
      communications: {
        where: { type: "outbound", createdAt: { gte: sevenDaysAgo } },
        select: { id: true },
        take: 1,
      },
      contacts: {
        // Never email a client who has unsubscribed (compliance).
        where: { email: { not: null }, unsubscribedAt: null, roleType: { in: ["purchaser", "vendor"] } },
        select: { id: true, name: true, email: true, portalToken: true, roleType: true },
      },
    },
  });

  let sent = 0;
  const base = process.env.NEXTAUTH_URL ?? "";

  for (const tx of transactions) {
    // Skip if there was recent outbound communication — they've already heard from us
    if (tx.communications.length > 0) continue;
    // Skip if no eligible contacts with email
    if (tx.contacts.length === 0) continue;

    for (const contact of tx.contacts) {
      if (!contact.email) continue;

      const roleLabel = contact.roleType === "purchaser" ? "purchase" : "sale";
      const subject = `Your ${roleLabel} at ${tx.propertyAddress} — all on track`;

      const portalLink = contact.portalToken
        ? `\n\nYou can view your progress at any time here:\n${base}/portal/${contact.portalToken}`
        : "";

      const text = [
        buildGreeting(contact.name),
        ``,
        `Quick check-in on your ${roleLabel} at ${tx.propertyAddress} — everything's progressing as it should.`,
        ``,
        `No news at this stage is genuinely good news. It means nothing unexpected is holding things up. Behind the scenes we're chasing solicitors, watching the process, and keeping everything moving.`,
        ``,
        `If anything needs your attention we'll be in touch right away. Otherwise, just reply to this email if you have questions.${portalLink}`,
      ].join("\n");

      const { from: fromAddr, replyTo } = await resolveAgencySenderForTransaction(tx.id);

      const portalSection = contact.portalToken
        ? `<p style="margin:0 0 20px"><a href="${base}/portal/${contact.portalToken}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View your progress →</a></p>`
        : "";

      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">${preheader("Nothing needed from you, just a quick note that things are moving.")}
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${buildGreeting(contact.name)}</h1>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">Quick check-in on your <strong>${roleLabel}</strong> at <strong>${tx.propertyAddress}</strong> — everything's progressing as it should.</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">No news at this stage is genuinely good news. It means nothing unexpected is holding things up. Behind the scenes we're chasing solicitors, watching the process, and keeping everything moving.</p>
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">If anything needs your attention we'll be in touch right away. Otherwise, just reply to this email if you have questions.</p>
${portalSection}
<p style="margin:0;font-size:12px;color:#8b91a3">${tx.agency.name}</p>
</body></html>`;

      await sendEmail({ to: contact.email, subject, text, html, from: fromAddr, replyTo }).catch(() => {});
      sent++;
    }
  }

  return sent;
}
