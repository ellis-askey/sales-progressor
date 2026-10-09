// GET /api/pause-chases?t=<signed token>
//
// The "pause for a week" link in chase emails (audit #11). We do NOT pause on
// this GET — email security scanners / link prefetchers open links in the
// background and would silently pause a client's chases. We verify the signed
// token (subject "pause:{contactId}") and send them to a confirmation page with
// a button that POSTs; the pause only happens on that button press.

import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";

const portalBase = () =>
  process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const invalid = () => NextResponse.redirect(`${portalBase()}/chases-paused?status=invalid`);
  if (!t) return invalid();

  const subject = verifyUnsubscribeToken(decodeURIComponent(t));
  if (!subject || !subject.startsWith("pause:")) return invalid();

  return NextResponse.redirect(`${portalBase()}/chases-paused?t=${encodeURIComponent(t)}`);
}
