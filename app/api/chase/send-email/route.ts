import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/command/events/write";
import { sendEmail, parseEmailMessage, resolveSenderForTransaction } from "@/lib/email";
import { checkEmailLimit, rateLimitJson } from "@/lib/ratelimit";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { deriveChaseTargetSide } from "@/lib/services/comms";
import { resolveEmailSignature } from "@/lib/email/signature";
import { sanitizeSignatureHtml } from "@/lib/email/sanitize-signature";
import type { EmailAttachment } from "@/lib/email";

// SendGrid caps a message at ~30MB; keep the base64 total well under that.
const MAX_ATTACHMENT_CHARS = 28 * 1024 * 1024;

// Keep only well-formed attachments and enforce the total size ceiling.
function sanitizeAttachments(input: unknown): EmailAttachment[] {
  if (!Array.isArray(input)) return [];
  const out: EmailAttachment[] = [];
  let total = 0;
  for (const a of input) {
    if (!a || typeof a !== "object") continue;
    const { content, filename, type } = a as Record<string, unknown>;
    if (typeof content !== "string" || typeof filename !== "string" || typeof type !== "string") continue;
    total += content.length;
    if (total > MAX_ATTACHMENT_CHARS) break;
    out.push({ content, filename, type, disposition: "attachment" });
  }
  return out;
}

function escapeHtmlBody(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rateLimit = await checkEmailLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 50 }));
  if (!rateLimit.success) {
    return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });
  }

  const { chaseTaskId, transactionId, toEmail, toName, messageText, ccEmails, bodyHtml, attachments } = await req.json();
  if (!transactionId || !toEmail || !messageText) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const validCcEmails: string[] = Array.isArray(ccEmails) ? ccEmails.filter(Boolean) : [];
  const validAttachments = sanitizeAttachments(attachments);

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: {
      propertyAddress: true,
      activeBuyerRoundId: true,
      agency: { select: { name: true, logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true } },
    },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const { subject, body } = parseEmailMessage(messageText);
  const fullSubject = subject.includes(tx.propertyAddress)
    ? subject
    : `${subject} — ${tx.propertyAddress}`;

  const { from, replyTo } = await resolveSenderForTransaction(transactionId, session.user);

  // Signature — resolved once by the single resolver (BASIC / IMAGE / CUSTOM),
  // following the sending agent. Body stays the agent's text; the signature is
  // appended. The preview (/api/chase/signature-preview) uses the same resolver,
  // so what the agent sees is what goes out.
  const sig = await resolveEmailSignature({
    userId: session.user.id,
    agency: tx.agency,
    fallbackName: session.user.name,
  });
  // Rich-text body from the composer (sanitised) when provided; otherwise the
  // legacy plain-text-to-HTML path. The plain-text part is always the plain body.
  const renderedBody = typeof bodyHtml === "string" && bodyHtml.trim()
    ? sanitizeSignatureHtml(bodyHtml)
    : escapeHtmlBody(body).replace(/\r?\n/g, "<br>");
  const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;">${renderedBody}${sig.html}</div>`;

  try {
    await sendEmail({ to: toEmail, cc: validCcEmails, subject: fullSubject, text: body + sig.text, html, from, replyTo, ...(validAttachments.length ? { attachments: validAttachments } : {}) });

    const ccSuffix = validCcEmails.length ? ` · CC: ${validCcEmails.join(", ")}` : "";
    // Phase 1 commit 4d post-fix — buyerRoundId stamping at the send-
    // email write site (missed in the initial 4d sweep). The drawer
    // passes chaseTaskId; deriveChaseTargetSide maps it to vendor /
    // purchaser via the rule's targetMilestoneCode. contactIds is
    // always [] here (this is the email-mirror row, not the comm-log
    // row that /api/comms writes), so the contactIds fallback wouldn't
    // help — the side hint is the only correct signal.
    const targetSide = await deriveChaseTargetSide(chaseTaskId);
    const stampBuyerRoundId =
      targetSide === "purchaser" ? tx.activeBuyerRoundId : null;
    await prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "outbound",
        method: "email",
        contactIds: [],
        content: `Email to ${toName ? `${toName} (${toEmail})` : toEmail}${ccSuffix}: ${messageText}`,
        createdById: session.user.id,
        buyerRoundId: stampBuyerRoundId,
      },
    });

    // Command Centre event log — manual chase send from the agent surface.
    await recordEvent({
      type: "chase_sent",
      agencyId: session.user.agencyId || undefined,
      userId: session.user.id,
      entityType: "PropertyTransaction",
      entityId: transactionId,
      metadata: { via: "manual", toEmail, ccCount: validCcEmails.length, chaseTaskId: chaseTaskId ?? null },
    });

    return NextResponse.json({ ok: true, subject: fullSubject });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email send failed";
    console.error("[send-email]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
