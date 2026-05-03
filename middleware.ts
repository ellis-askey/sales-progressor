import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Command centre timing constants (ms) — kept inline to avoid Node.js module
// imports that are unavailable in the Edge Runtime.
const STEP_UP_MAX_AGE_MS  = 30 * 60 * 1000;
const IDLE_MAX_AGE_MS     =  8 * 60 * 60 * 1000;
const SESSION_HARD_MAX_MS = 24 * 60 * 60 * 1000;
const COMMAND_COOKIE      = "command_session";

/** Verifies HMAC-SHA256 signature using the Web Crypto API (Edge-compatible). */
async function verifyCommandHmac(encoded: string, sig: string, keyHex: string): Promise<boolean> {
  try {
    const keyBytes = Uint8Array.from(keyHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(sig.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const data = new TextEncoder().encode(encoded);
    return crypto.subtle.verify("HMAC", key, sigBytes, data);
  } catch {
    return false;
  }
}

export default withAuth(
  async function middleware(req) {
    const { pathname, searchParams } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // ── Command centre gate ───────────────────────────────────────────────────
    if (pathname.startsWith("/command")) {
      // 1. Superadmin role required
      if (role !== "superadmin") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      // 2. IP allowlist (skipped when env var is empty)
      const allowlistRaw = process.env.ADMIN_IP_ALLOWLIST ?? "";
      if (allowlistRaw.trim()) {
        const allowed = allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean);
        const ip =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          req.headers.get("x-real-ip") ??
          "";
        if (!allowed.includes(ip)) {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }

      // Step-up / enrollment pages are exempt from the step-up cookie check.
      // Server action POSTs (Next-Action header) are also exempt — they carry
      // their own assertSuperadmin() guard and the middleware's 307 redirect
      // would be forwarded as a POST by the browser, breaking the action.
      const isStepUpPath =
        pathname.startsWith("/command/auth/step-up") ||
        pathname.startsWith("/command/setup-2fa") ||
        pathname.startsWith("/api/command/auth/step-up") ||
        pathname.startsWith("/api/command/setup-2fa");
      const isServerAction = req.headers.has("next-action");

      if (!isStepUpPath && !isServerAction) {
        // 3. Cookie presence
        const cookie = req.cookies.get(COMMAND_COOKIE)?.value ?? "";
        const dot = cookie.lastIndexOf(".");
        if (!cookie || dot === -1) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }

        const encoded = cookie.slice(0, dot);
        const sig = cookie.slice(dot + 1);

        // 4. HMAC signature
        const keyHex = process.env.ADMIN_AUDIT_HMAC_KEY ?? "";
        const valid = await verifyCommandHmac(encoded, sig, keyHex);
        if (!valid) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }

        // 5. Timestamp checks
        let payload: { issuedAt: number; lastSeenAt: number; stepUpAt: number };
        try {
          payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
        } catch {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }

        const now = Date.now();
        if (now - payload.issuedAt > SESSION_HARD_MAX_MS) {
          return NextResponse.redirect(new URL("/login", req.url));
        }
        if (now - payload.lastSeenAt > IDLE_MAX_AGE_MS) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }
        if (now - payload.stepUpAt > STEP_UP_MAX_AGE_MS) {
          return NextResponse.redirect(new URL("/command/auth/step-up", req.url));
        }
      }
    }
    // ── End command centre gate ───────────────────────────────────────────────

    // Pass-through response (may carry UTM attribution cookie)
    const res = NextResponse.next();

    // Capture UTM params in a 30-day cookie for signup attribution.
    // Read at agency creation time to populate Agency.signup* fields.
    const utmSource   = searchParams.get("utm_source");
    const utmMedium   = searchParams.get("utm_medium");
    const utmCampaign = searchParams.get("utm_campaign");
    if (utmSource || utmMedium || utmCampaign) {
      res.cookies.set("utm_attr", JSON.stringify({
        source:      utmSource   ?? undefined,
        medium:      utmMedium   ?? undefined,
        campaign:    utmCampaign ?? undefined,
        referrer:    req.headers.get("referer") ?? undefined,
        landingPage: pathname,
        capturedAt:  new Date().toISOString(),
      }), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
    }

    // Viewers are read-only — block all mutation API calls
    if (
      role === "viewer" &&
      pathname.startsWith("/api/") &&
      MUTATION_METHODS.has(req.method)
    ) {
      return new NextResponse(
        JSON.stringify({ error: "Viewers cannot make changes" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const isAgentUser = role === "negotiator" || role === "director";

    // Redirect agent users from internal SP transaction pages into the agent shell
    if (isAgentUser && pathname.match(/^\/transactions\/[^/]+/)) {
      const id = pathname.split("/")[2];
      return NextResponse.redirect(new URL(`/agent/transactions/${id}`, req.url));
    }

    // Agent users can only access the agent area, APIs, and portal — nowhere else
    const agentAllowed = ["/agent", "/api", "/portal"];
    if (isAgentUser && !agentAllowed.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/agent/hub", req.url));
    }

    // Non-agent, non-admin users trying to access the agent area → send to SP dashboard
    if (!isAgentUser && role !== "admin" && pathname.startsWith("/agent")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return res;
  },
  {
    callbacks: {
      // Machine-to-machine routes authenticate via Bearer token inside the handler —
      // they must bypass the NextAuth session gate so Vercel Crons can reach them.
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith("/portal")) return true;
        if (pathname.startsWith("/api/cron/")) return true;
        if (pathname.startsWith("/api/reminders/")) return true;
        if (pathname.startsWith("/api/webhooks/")) return true;
        return !!token;
      },
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!login|register|forgot-password|reset-password|terms|privacy|portal|bg-test|login-preview|api/auth|api/portal|api/register|api/seed-demo|_next/static|_next/image|favicon\\.ico|.*\\.(?:jpg|jpeg|png|svg|webp|gif|ico)).*)",
  ],
};
