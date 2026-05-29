import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordEvent } from "@/lib/command/events/write";
import { sendEmail, parseEmailMessage, resolveSenderForTransaction } from "@/lib/email";
import { checkEmailLimit, rateLimitJson } from "@/lib/ratelimit";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const rateLimit = await checkEmailLimit(session.user.id).catch(() => ({ success: true, reset: 0, remaining: 50 }));
  if (!rateLimit.success) {
    return NextResponse.json(rateLimitJson(rateLimit), { status: 429 });
  }

  const { chaseTaskId, transactionId, toEmail, toName, messageText, ccEmails } = await req.json();
  if (!transactionId || !toEmail || !messageText) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const validCcEmails: string[] = Array.isArray(ccEmails) ? ccEmails.filter(Boolean) : [];

  const scope = getAccessScope(session);
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { propertyAddress: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const { subject, body } = parseEmailMessage(messageText);
  const fullSubject = subject.includes(tx.propertyAddress)
    ? subject
    : `${subject} — ${tx.propertyAddress}`;

  const { from, replyTo } = await resolveSenderForTransaction(transactionId, session.user);

  try {
    await sendEmail({ to: toEmail, cc: validCcEmails, subject: fullSubject, text: body, from, replyTo });

    const ccSuffix = validCcEmails.length ? ` · CC: ${validCcEmails.join(", ")}` : "";
    await prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "outbound",
        method: "email",
        contactIds: [],
        content: `Email to ${toName ? `${toName} (${toEmail})` : toEmail}${ccSuffix}: ${messageText}`,
        createdById: session.user.id,
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
