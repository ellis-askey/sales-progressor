import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getVerifiedEmailForSending } from "@/lib/services/verified-emails";
import { sendFromVerifiedAddress } from "@/lib/services/sendgrid";
import { resolveSenderForTransaction } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { fromEmail, to, subject, body, transactionId } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const isInternalStaff =
    session.user.role === "sales_progressor" || session.user.role === "admin";

  // ── Internal staff path (SP / admin) ─────────────────────────────────
  if (isInternalStaff) {
    if (!transactionId) {
      return NextResponse.json({ error: "transactionId required" }, { status: 400 });
    }

    const scope = getAccessScope(session);
    const tx = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, transactionId),
      select: { id: true },
    });
    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

    const { from: resolvedFrom, replyTo } = await resolveSenderForTransaction(transactionId, session.user);
    await sendFromVerifiedAddress({ from: resolvedFrom, to, subject, text: body, replyTo });

    await prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "outbound",
        method: "email",
        contactIds: [],
        content: `Email sent to ${to}\n\nSubject: ${subject}\n\n${body}`,
        createdById: session.user.id,
        visibleToClient: false,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // ── Agent path (director / negotiator) ───────────────────────────────
  // User explicitly picked fromEmail via the ComposeEmail picker — validate it.
  if (!fromEmail) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const record = await getVerifiedEmailForSending(session.user.id, fromEmail);
  if (!record) {
    return NextResponse.json({ error: "Sending address not found" }, { status: 403 });
  }
  if (record.status !== "verified" && record.status !== "legacy_single_sender") {
    return NextResponse.json(
      { error: `This address can't send right now — it's ${record.status.replace(/_/g, " ")}. Verify it in Settings first.` },
      { status: 403 }
    );
  }
  if (record.status === "verified" && record.verifiedDomain?.status !== "verified") {
    return NextResponse.json(
      { error: "Your domain is no longer authenticated. Please check your DNS settings in Settings." },
      { status: 403 }
    );
  }

  if (transactionId) {
    const scope = getAccessScope(session);
    const txExists = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, transactionId),
      select: { id: true },
    });
    if (!txExists) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  await sendFromVerifiedAddress({
    from: `${session.user.name} <${fromEmail}>`,
    to,
    subject,
    text: body,
    replyTo: fromEmail,
  });

  await prisma.userVerifiedEmail.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  if (transactionId) {
    await prisma.outboundMessage.create({
      data: {
        transactionId,
        type: "outbound",
        method: "email",
        contactIds: [],
        content: `Email sent to ${to}\n\nSubject: ${subject}\n\n${body}`,
        createdById: session.user.id,
        visibleToClient: false,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
