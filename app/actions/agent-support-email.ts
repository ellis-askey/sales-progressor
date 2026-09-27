"use server";

import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { buildAgentSupportEmail, AGENT_SUPPORT_FROM, AGENT_SUPPORT_REPLY_TO } from "@/lib/emails/agent-support";

// Founder-only: send the "need any help getting set up?" email to a single agent
// from Customer Support. Command Centre action, so superadmin-only. The email is
// resolved server-side from the userId (never trusted from the client).
export async function sendAgentSupportEmailAction(
  userId: string,
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const session = await requireSession();
  if (session.user.role !== "superadmin") return { ok: false, error: "Forbidden" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user?.email) return { ok: false, error: "That agent has no email on file." };

  const { subject, html, text } = buildAgentSupportEmail(user.name ?? "");

  try {
    await sendEmail({
      to: user.email,
      from: AGENT_SUPPORT_FROM,
      replyTo: AGENT_SUPPORT_REPLY_TO,
      subject,
      html,
      text,
      emailType: "agent_support_checkin",
    });
  } catch (err) {
    console.error("[agent-support-email] send failed", err);
    return { ok: false, error: "Could not send. Try again." };
  }
  return { ok: true, to: user.email };
}
