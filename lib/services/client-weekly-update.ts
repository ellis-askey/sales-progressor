import { prisma } from "@/lib/prisma";
import { preheader } from "@/lib/email/preheader";
import { sendEmail } from "@/lib/email";
import { resolveAgencySenderForTransaction } from "@/lib/email/agency-sender";
import { buildGreeting } from "@/lib/portal-copy";
import { buildClientNarrative } from "@/lib/services/client-narrative";
import { resolveWeeklyUpdateContent } from "@/lib/agency-email/templates";

function escWeekly(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Fills the agency-editable weekly-update slots (subject / intro / closing).
function interpWeekly(t: string, vars: { firstName: string; address: string; roleLabel: string }): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => {
    switch (k) {
      case "firstName": return vars.firstName;
      case "address": return vars.address;
      case "roleLabel": return vars.roleLabel;
      default: return `{${k}}`;
    }
  });
}

export async function sendClientWeeklyUpdates(agencyId: string): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // Agency-level opt-out: a director can switch the whole weekly update off.
  const agencyPref = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { weeklyClientUpdatesEnabled: true },
  });
  if (agencyPref && agencyPref.weeklyClientUpdatesEnabled === false) return 0;

  // Agency personalisation (subject / intro / AI tone steer / closing). Resolved
  // once for the whole agency; empty everywhere = unchanged default behaviour.
  const wu = await resolveWeeklyUpdateContent(agencyId);

  // Active transactions for this agency
  const transactions = await prisma.propertyTransaction.findMany({
    where: { agencyId, status: "active" },
    select: {
      id: true,
      propertyAddress: true,
      serviceType: true,
      expectedExchangeDate: true,
      overridePredictedDate: true,
      completionDate: true,
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
        where: { email: { not: null }, unsubscribedAt: null, roleType: { in: ["purchaser", "vendor"] }, portalEligible: true },
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
      const firstName = contact.name.trim().split(/\s+/)[0] || contact.name;
      const interpVars = { firstName, address: tx.propertyAddress, roleLabel };
      const subject = wu.subject ? interpWeekly(wu.subject, interpVars) : `An update on your ${roleLabel} at ${tx.propertyAddress}`;

      const portalLink = contact.portalToken
        ? `\n\nYou can view your progress at any time here:\n${base}/portal/${contact.portalToken}`
        : "";

      const { from: fromAddr, replyTo, canReply } = await resolveAgencySenderForTransaction(tx.id);

      // Piece 1: a real per-file narrative drafted from the file's actual state.
      // Falls back to the safe generic reassurance if the draft can't be built.
      const narrative = await buildClientNarrative({
        transactionId: tx.id,
        agencyId,
        side: contact.roleType === "purchaser" ? "purchaser" : "vendor",
        address: tx.propertyAddress,
        clientFirstName: firstName,
        expectedExchangeDate: tx.expectedExchangeDate ?? null,
        overridePredictedDate: tx.overridePredictedDate ?? null,
        completionDate: tx.completionDate ?? null,
        toneGuidance: wu.toneGuidance || null,
      }).catch(() => null);

      const bodyParas = narrative
        ? narrative.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : [
            `Quick check-in on your ${roleLabel} at ${tx.propertyAddress}. Everything is progressing as it should.`,
            `No news at this stage is genuinely good news. It means nothing unexpected is holding things up. Behind the scenes we're chasing solicitors, watching the process, and keeping everything moving.`,
          ];

      const closing = wu.closing
        ? interpWeekly(wu.closing, interpVars)
        : `If anything needs your attention we'll be in touch right away.${canReply !== false ? " Otherwise, just reply to this email if you have questions." : ""}`;
      const introText = wu.intro ? interpWeekly(wu.intro, interpVars) : "";

      const text = [buildGreeting(contact.name), ``, ...(introText ? [introText, ``] : []), ...bodyParas.flatMap((p) => [p, ``]), closing + portalLink].join("\n");

      const portalSection = contact.portalToken
        ? `<p style="margin:0 0 20px"><a href="${base}/portal/${contact.portalToken}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View your progress →</a></p>`
        : "";

      const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1d29;background:#fff">${preheader("A quick update on where your move is up to.")}
<p style="margin:0 0 4px;color:#6b7280;font-size:13px">${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
<h1 style="margin:0 0 16px;font-size:20px;font-weight:700">${buildGreeting(contact.name)}</h1>
${introText ? `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">${escWeekly(introText)}</p>\n` : ""}${bodyParas.map((p) => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6">${p}</p>`).join("\n")}
<p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6">${escWeekly(closing)}</p>
${portalSection}
<p style="margin:0;font-size:12px;color:#8b91a3">${tx.agency.name}</p>
</body></html>`;

      await sendEmail({ to: contact.email, subject, text, html, from: fromAddr, replyTo }).catch(() => {});

      // Log the send so it shows in the Command Centre Outbound list and on the
      // file's activity feed — a client should never be emailed without a record.
      await prisma.outboundMessage.create({
        data: {
          transactionId: tx.id,
          agencyId,
          type: "outbound",
          method: "email",
          channel: "email",
          purpose: "notification",
          status: "sent",
          subject,
          content: text,
          contactIds: [contact.id],
          recipientEmail: contact.email,
          isAutomated: true,
          visibleToClient: true,
          sentAt: new Date(),
        },
      }).catch(() => {});
      sent++;
    }
  }

  return sent;
}
