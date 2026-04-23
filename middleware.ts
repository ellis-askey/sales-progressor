import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    const isAgentUser = role === "negotiator" || role === "director";

    // Redirect agent users from internal SP transaction pages into the agent shell
    if (isAgentUser && pathname.match(/^\/transactions\/[^/]+/)) {
      const id = pathname.split("/")[2];
      return NextResponse.redirect(new URL(`/agent/transactions/${id}`, req.url));
    }

    // Agent users can only access the agent area, APIs, and portal — nowhere else
    const agentAllowed = ["/agent", "/api", "/portal"];
    if (isAgentUser && !agentAllowed.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/agent/dashboard", req.url));
    }

    // Non-agent, non-admin users trying to access the agent area → send to SP dashboard
    if (!isAgentUser && role !== "admin" && pathname.startsWith("/agent")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/((?!login|register|portal|preview-hero|preview-hero-light|preview-phase1c|api/auth|api/portal|api/register|_next/static|_next/image|favicon\\.ico|.*\\.(?:jpg|jpeg|png|svg|webp|gif|ico)).*)",
  ],
};
