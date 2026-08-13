// GET /api/pause-chases?t=<signed token>
//
// The "pause for a week" one-click link in chase emails (audit #11). Verifies
// the signed token (subject "pause:{contactId}"), pauses that contact's chases
// for 7 days, and redirects to a friendly confirmation with the resume date.
// Unauthenticated by design — the signed token is the auth, same as unsubscribe.

import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { pauseContactChases } from "@/lib/services/chase-pause";

const portalBase = () =>
  process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

const PAUSE_DAYS = 7;

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const invalid = () => NextResponse.redirect(`${portalBase()}/chases-paused?status=invalid`);
  if (!t) return invalid();

  const subject = verifyUnsubscribeToken(decodeURIComponent(t));
  if (!subject || !subject.startsWith("pause:")) return invalid();

  const contactId = subject.slice("pause:".length);
  const until = new Date(Date.now() + PAUSE_DAYS * 24 * 60 * 60 * 1000);
  const result = await pauseContactChases(contactId, until, "email").catch(() => null);
  if (!result) return invalid();

  const untilParam = until.toISOString().slice(0, 10);
  return NextResponse.redirect(`${portalBase()}/chases-paused?status=ok&until=${untilParam}`);
}
