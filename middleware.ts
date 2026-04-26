import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

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
      return NextResponse.redirect(new URL("/agent/hub-preview", req.url));
    }

    // Non-agent, non-admin users trying to access the agent area → send to SP dashboard
    if (!isAgentUser && role !== "admin" && pathname.startsWith("/agent")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
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
