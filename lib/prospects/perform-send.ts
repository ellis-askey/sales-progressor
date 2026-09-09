// The single prospect-email send path, shared by the manual composer
// (sendProspectEmailAction) and the flow approve step (approveFlowStepAction).
// Enforces the opt-out / bounce guards, creates the tracked ProspectEmail,
// sends via the outreach transport, logs the timeline activity, and advances the
// prospect. Callers own auth (requireSuperAdmin) and revalidation.

import { randomUUID } from "crypto";
import { commandDb } from "@/lib/command/prisma";
import { sendProspectOutreach } from "./send";
import type { ProspectStatus } from "@prisma/client";

export type PerformSendResult =
  | { ok: true; prospectEmailId: string }
  | { ok: false; error: string };

export async function performProspectSend(params: {
  prospectId: string;
  actorUserId: string | null;
  contactId?: string | null;
  to: string;
  subject: string;
  body: string;
  aiGenerated?: boolean;
  // Pre-built branded HTML (e.g. the invitation). When omitted the outreach
  // transport wraps the plain text in the standard signature template.
  html?: string;
}): Promise<PerformSendResult> {
  const to = params.to.trim();
  const subject = params.subject.trim();
  const body = params.body.trim();
  if (!to || !subject || !body) return { ok: false, error: "To, subject and body are all required." };

  const p = await commandDb.prospect.findUnique({
    where: { id: params.prospectId },
    select: { optedOutAt: true, bouncedAt: true, status: true },
  });
  if (!p) return { ok: false, error: "Prospect not found." };
  if (p.optedOutAt) return { ok: false, error: "This prospect has opted out of email." };
  if (p.bouncedAt) return { ok: false, error: "A previous email to this prospect bounced." };

  const replyToken = randomUUID().replace(/-/g, "");
  const pe = await commandDb.prospectEmail.create({
    data: {
      prospectId: params.prospectId,
      contactId: params.contactId ?? null,
      toEmail: to,
      subject,
      body,
      html: params.html ?? null,
      replyToken,
      aiGenerated: !!params.aiGenerated,
      createdById: params.actorUserId,
    },
  });

  try {
    const { sgMessageId } = await sendProspectOutreach({
      to, subject, text: body, replyToken, prospectEmailId: pe.id, html: params.html,
    });
    await commandDb.prospectEmail.update({ where: { id: pe.id }, data: { sgMessageId } });
  } catch (err) {
    await commandDb.prospectEmail.delete({ where: { id: pe.id } }).catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 140) : "The email failed to send." };
  }

  await commandDb.prospectActivity.create({
    data: {
      prospectId: params.prospectId,
      actorUserId: params.actorUserId,
      type: "email_sent",
      summary: `Email: ${subject}`,
      body,
      metadata: { prospectEmailId: pe.id },
    },
  });
  await commandDb.prospect.update({
    where: { id: params.prospectId },
    data: {
      lastContactedAt: new Date(),
      followUpCount: { increment: 1 },
      nextFollowUpAt: null,
      ...(p.status === "new" ? { status: "contacted" as ProspectStatus } : {}),
    },
  });

  return { ok: true, prospectEmailId: pe.id };
}
