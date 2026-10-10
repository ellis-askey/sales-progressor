// Email Studio — send a test of the CURRENT (unsaved) design to the signed-in
// user's own email, so they can see exactly how a look renders in a real inbox.
// Renders through the same renderStudioEmail the live send path now uses, so the
// test is faithful. Always sends to the operator's own address (never a client),
// from the Sales Progressor default sender (bulletproof-sender policy). Any
// logged-in agent/owner can test their own design.

import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { sendEmail } from "@/lib/email";
import { sanitizeEmailThemeInput, type LogoMode } from "@/lib/email/brand-theme";
import { renderStudioSampleEmail, type SamplePreviewKey } from "@/lib/email/studio-render";

const PV = new Set<SamplePreviewKey>(["milestone", "invite", "completion"]);
const MODES = new Set<LogoMode>(["monogram", "wordmark", "logo"]);
const SUBJECT: Record<SamplePreviewKey, string> = {
  milestone: "Your email design (test): milestone update",
  invite: "Your email design (test): portal invite",
  completion: "Your email design (test): completion",
};

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const to = session.user.email;
  if (!to) return NextResponse.json({ error: "No email on your account to send to." }, { status: 400 });

  let body: { theme?: unknown; pv?: string; identityName?: string; logoUrl?: string; tileColor?: string; logoMode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const pv = (typeof body.pv === "string" && PV.has(body.pv as SamplePreviewKey) ? body.pv : "milestone") as SamplePreviewKey;
  const theme = sanitizeEmailThemeInput(body.theme);
  const identityName = (typeof body.identityName === "string" && body.identityName.trim()) ? body.identityName.trim().slice(0, 80) : "Your agency";
  const logoUrl = typeof body.logoUrl === "string" && /^https?:\/\//.test(body.logoUrl) ? body.logoUrl : null;
  const tileColor = typeof body.tileColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.tileColor) ? body.tileColor : null;
  const logoMode = typeof body.logoMode === "string" && MODES.has(body.logoMode as LogoMode) ? (body.logoMode as LogoMode) : undefined;

  const html = renderStudioSampleEmail(theme, pv, { identityName, logoUrl, tileColor, logoMode });
  const text = "This is a test of your client email design. Open in an email client that renders HTML to see the full look.";

  try {
    await sendEmail({ to, subject: SUBJECT[pv], text, html });
  } catch {
    return NextResponse.json({ error: "Couldn't send the test. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, to });
}
