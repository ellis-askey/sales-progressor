import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { revokeVerifiedEmail } from "@/lib/services/verified-emails";
import { sendEmail } from "@/lib/email";
import { getVerifiedEmailForSending } from "@/lib/services/verified-emails";

// DELETE — revoke a verified email
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;
  await revokeVerifiedEmail(session.user.id, id);
  return NextResponse.json({ ok: true });
}

// POST — send a test email from a verified address
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  const { id } = await params;

  const record = await getVerifiedEmailForSending(session.user.id, id);
  if (!record || record.status !== "verified") {
    return NextResponse.json({ error: "Address not verified" }, { status: 400 });
  }

  await sendEmail({
    from: `${session.user.name} <${record.email}>`,
    to: record.email,
    subject: "Test email from Sales Progressor",
    text: `This is a test email confirming that ${record.email} is working correctly as a sending address in Sales Progressor.`,
  });

  return NextResponse.json({ ok: true });
}
