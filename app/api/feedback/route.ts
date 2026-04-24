import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const { type, message } = await req.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const typeLabelMap: Record<string, string> = {
    bug: "Bug report",
    idea: "Feature idea",
    general: "General feedback",
  };
  const typeLabel = typeLabelMap[type] ?? "Feedback";
  const to = process.env.FEEDBACK_EMAIL ?? "ellisaskey@googlemail.com";

  await sendEmail({
    to,
    subject: `[Sales Progressor] ${typeLabel} from ${session.user.name}`,
    text: `From: ${session.user.name} (${session.user.email})\nType: ${typeLabel}\n\n${message.trim()}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1A1D29;">
        <p style="font-size: 12px; color: #8B91A3; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.08em;">${typeLabel}</p>
        <p style="font-size: 15px; color: #1A1D29; white-space: pre-line; margin: 0 0 24px;">${message.trim()}</p>
        <p style="font-size: 12px; color: #8B91A3; margin: 0;">From ${session.user.name} · ${session.user.email}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
