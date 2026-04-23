import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { to, domain, records } = await req.json();

  if (!to || !domain || !records) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  await sendEmail({
    to,
    subject: `DNS setup required for ${domain} — Sales Progressor`,
    text: [
      `Hi,`,
      ``,
      `${session.user.name} needs the following DNS records added to ${domain} so that Sales Progressor can send emails on their behalf.`,
      ``,
      `Please add these CNAME records in your DNS settings:`,
      ``,
      records,
      ``,
      `Once added, the records typically propagate within 30 minutes (up to 48 hours in some cases).`,
      ``,
      `If you have any questions, please reply to this email.`,
    ].join("\n"),
  });

  return NextResponse.json({ ok: true });
}
