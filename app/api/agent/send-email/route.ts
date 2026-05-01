import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getVerifiedEmailForSending } from "@/lib/services/verified-emails";
import { sendFromVerifiedAddress } from "@/lib/services/sendgrid";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { fromEmail, to, subject, body, transactionId } = await req.json();

  if (!fromEmail || !to || !subject || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify the sender owns this address and it's verified
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

  // Check domain is still authenticated (skip for legacy_single_sender during grace period)
  if (record.status === "verified" && record.verifiedDomain?.status !== "verified") {
    return NextResponse.json(
      { error: "Your domain is no longer authenticated. Please check your DNS settings in Settings." },
      { status: 403 }
    );
  }

  await sendFromVerifiedAddress({
    from: `${session.user.name} <${fromEmail}>`,
    to,
    subject,
    text: body,
    replyTo: fromEmail,
  });

  // Update last_used_at
  await prisma.userVerifiedEmail.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  // Log as a communication record if transactionId provided
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
