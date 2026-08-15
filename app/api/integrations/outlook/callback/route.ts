// GET /api/integrations/outlook/callback
//
// Microsoft redirects here after the user signs in + consents. We validate the
// OAuth state, exchange the authorization code for tokens server-side, identify
// the mailbox via Graph /me, and persist an encrypted connection against the
// currently authenticated user. Then we redirect back to Settings with a
// success/error flag. Tokens are never logged and never leave the server.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/security/token-crypto";
import {
  exchangeCodeForTokens,
  fetchGraphMe,
  OUTLOOK_SCOPE_STRING,
} from "@/lib/integrations/outlook/config";
import { verifyOutlookState, OUTLOOK_STATE_COOKIE } from "@/lib/integrations/outlook/state";

const SETTINGS_PATH = "/command/settings/connections";

export async function GET(req: Request) {
  const session = await requireSession();
  const url = new URL(req.url);
  const back = new URL(SETTINGS_PATH, url.origin);

  // Always clear the one-shot state cookie on the way out.
  const finish = (params: Record<string, string>) => {
    for (const [k, v] of Object.entries(params)) back.searchParams.set(k, v);
    const res = NextResponse.redirect(back);
    res.cookies.delete(OUTLOOK_STATE_COOKIE);
    return res;
  };

  // Microsoft returned an error (e.g. user cancelled consent).
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return finish({ outlook: "error", reason: oauthError });
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("cookie");
  const cookieState = cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OUTLOOK_STATE_COOKIE}=`))
    ?.slice(OUTLOOK_STATE_COOKIE.length + 1);

  if (!code || !verifyOutlookState(cookieState, state ?? undefined, session.user.id)) {
    return finish({ outlook: "error", reason: "state" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // offline_access should guarantee this; treat its absence as a failure
      // rather than silently storing a connection we can't keep alive later.
      return finish({ outlook: "error", reason: "no_refresh_token" });
    }

    const me = await fetchGraphMe(tokens.access_token);
    if (!me.email) {
      return finish({ outlook: "error", reason: "no_identity" });
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const data = {
      email: me.email,
      displayName: me.displayName,
      accessToken: encryptSecret(tokens.access_token),
      refreshToken: encryptSecret(tokens.refresh_token),
      tokenExpiresAt,
      scope: tokens.scope || OUTLOOK_SCOPE_STRING,
    };

    // Add a new mailbox, or refresh this same mailbox if it's already connected.
    await prisma.outlookConnection.upsert({
      where: {
        userId_microsoftUserId: { userId: session.user.id, microsoftUserId: me.id },
      },
      create: { userId: session.user.id, microsoftUserId: me.id, ...data },
      update: data,
    });

    return finish({ outlook: "connected" });
  } catch (err) {
    // Log the message only (our helpers throw with codes, not token contents).
    console.error("[outlook] connect failed:", (err as Error).message);
    return finish({ outlook: "error", reason: "exchange" });
  }
}
