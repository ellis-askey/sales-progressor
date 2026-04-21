import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail, parseEmailMessage } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { chaseTaskId, transactionId, toEmail, toName, messageText } = await req.json();
  if (!transactionId || !toEmail || !messageText) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { propertyAddress: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const { subject, body } = parseEmailMessage(messageText);
  const fullSubject = subject.includes(tx.propertyAddress)
    ? subject
    : `${subject} — ${tx.propertyAddress}`;

  try {
    await sendEmail({ to: toEmail, subject: fullSubject, text: body });
    return NextResponse.json({ ok: true, subject: fullSubject });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email send failed";
    console.error("[send-email]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
