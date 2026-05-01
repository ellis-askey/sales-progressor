import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default withAuth(
  function middleware(req) {
    const { pathname, searchParams } = req.nextUrl;
    const role = req.nextauth.token?.role;

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
      // Portal routes are token-authenticated (no admin session needed)
      authorized: ({ req, token }) => {
        if (req.nextUrl.pathname.startsWith("/portal")) return true;
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
