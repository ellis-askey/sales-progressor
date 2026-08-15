// GET /api/integrations/outlook/connect
//
// Starts the Microsoft OAuth 2.0 authorization-code flow. Generates a signed,
// user-bound state, stores it in an httpOnly cookie, and redirects the user to
// Microsoft to sign in + consent. The callback route completes the exchange.

import { NextResponse } from "next/server";
import { requireSession, forbidViewer } from "@/lib/session";
import { isOutlookConfigured, buildAuthorizeUrl } from "@/lib/integrations/outlook/config";
import {
  createOutlookState,
  OUTLOOK_STATE_COOKIE,
  OUTLOOK_STATE_MAX_AGE_SECONDS,
} from "@/lib/integrations/outlook/state";

const SETTINGS_PATH = "/command/settings/connections";

export async function GET(req: Request) {
  const session = await requireSession();
  const viewerBlock = forbidViewer(session);
  if (viewerBlock) return viewerBlock;

  const reqUrl = new URL(req.url);
  const origin = reqUrl.origin;
  // Optional: pre-target a specific mailbox (from a roster row's Connect button).
  const loginHint = reqUrl.searchParams.get("email") ?? undefined;

  if (!isOutlookConfigured()) {
    const back = new URL(SETTINGS_PATH, origin);
    back.searchParams.set("outlook", "error");
    back.searchParams.set("reason", "not_configured");
    return NextResponse.redirect(back);
  }

  const { state, cookieValue } = createOutlookState(session.user.id);
  const res = NextResponse.redirect(buildAuthorizeUrl(state, loginHint));
  res.cookies.set(OUTLOOK_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OUTLOOK_STATE_MAX_AGE_SECONDS,
  });
  return res;
}
