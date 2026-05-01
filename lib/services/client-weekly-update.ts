import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildGreeting } from "@/lib/portal-copy";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export async function sendClientWeeklyUpdates(agencyId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // Active transactions for this agency
  const transactions = await prisma.propertyTransaction.findMany({
    where: { agencyId, status: "active" },
    select: {
      id: true,
      propertyAddress: true,
      expectedExchangeDate: true,
      communications: {
        where: { type: "outbound", createdAt: { gte: sevenDaysAgo } },
        select: { id: true },
        take: 1,
      },
      contacts: {
        where: { email: { not: null }, roleType: { in: ["purchaser", "vendor"] } },
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

    const exchangeStr = tx.expectedExchangeDate
      ? `\n\nYour current exchange target is ${fmtDate(tx.expectedExchangeDate)}.`
      : "";

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
        `We wanted to check in and let you know that your ${roleLabel} at ${tx.propertyAddress} is actively being progressed.`,
        ``,
        `No news at this stage is genuinely good news — it means there are no unexpected problems holding things up. Our team is working in the background, chasing solicitors, monitoring the process, and making sure everything keeps moving.${exchangeStr}`,
        ``,
        `If anything needs your attention, we will be in touch straight away. If you have any questions in the meantime, just reply to this email.${portalLink}`,
        ``,
        `All the best,`,
        `The Sales Progressor Team`,
      ].join("\n");

      const portalSection = contact.portalToken
        ? `<p style="margin:0 0 20px"><a href="${base}/portal/${contact.portalToken}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View your progress →</a></p>`
        : "";

      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${buildGreeting(contact.name)}</h1>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">We wanted to check in and let you know that your <strong>${roleLabel}</strong> at <strong>${tx.propertyAddress}</strong> is actively being progressed.</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">No news at this stage is genuinely good news — it means there are no unexpected problems holding things up. Our team is working in the background, chasing solicitors, monitoring the process, and making sure everything keeps moving.${exchangeStr ? `</p><p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6"><strong>Exchange target:</strong> ${fmtDate(tx.expectedExchangeDate!)}` : ""}</p>
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">If anything needs your attention, we will be in touch straight away. If you have any questions in the meantime, just reply to this email.</p>
${portalSection}
<p style="margin:0;font-size:12px;color:#8b91a3">You're receiving this update because you are a party to the transaction at ${tx.propertyAddress}.</p>
</body></html>`;

      await sendEmail({ to: contact.email, subject, text, html }).catch(() => {});
      sent++;
    }
  }

  return sent;
}
