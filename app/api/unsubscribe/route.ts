import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { applyUnsubscribe } from "@/lib/email/apply-unsubscribe";

const portalBase = () =>
  process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

// Clicking the "unsubscribe" link in an email lands here. We do NOT change
// anything on this GET: email security scanners and link prefetchers open every
// link in the background, so a state-changing GET would silently unsubscribe the
// recipient. Instead we verify the token and send them to a confirmation page
// with a button that POSTs (the solicitor "stop" link already works this way).
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const invalid = () => NextResponse.redirect(`${portalBase()}/unsubscribed?status=invalid`);
  if (!t) return invalid();

  const subject = verifyUnsubscribeToken(decodeURIComponent(t));
  if (!subject) return invalid();

  const type = subject.startsWith("contact:") ? "contact" : "";
  return NextResponse.redirect(
    `${portalBase()}/unsubscribed?t=${encodeURIComponent(t)}${type ? `&type=${type}` : ""}`,
  );
}

// RFC 8058 one-click unsubscribe. Mailbox providers (Gmail / Yahoo bulk-sender
// rules) POST here with body `List-Unsubscribe=One-Click` when the header is
// present — this is a deliberate action from the mail client's native
// Unsubscribe button, not a prefetch, so it applies the change immediately.
export async function POST(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  if (!t) return new NextResponse(null, { status: 400 });
  const subject = verifyUnsubscribeToken(decodeURIComponent(t));
  if (!subject) return new NextResponse(null, { status: 400 });
  await applyUnsubscribe(subject);
  return new NextResponse(null, { status: 200 });
}
