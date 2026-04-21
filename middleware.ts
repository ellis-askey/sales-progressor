import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    // Redirect negotiators from internal transaction pages into the agent shell
    if (role === "negotiator" && pathname.match(/^\/transactions\/[^/]+/)) {
      const id = pathname.split("/")[2];
      return NextResponse.redirect(new URL(`/agent/transactions/${id}`, req.url));
    }

    // Negotiators can only access agent area, their own transaction shell, APIs, and portal
    const agentAllowed = ["/agent", "/api", "/portal"];
    if (role === "negotiator" && !agentAllowed.some((p) => pathname.startsWith(p))) {
      return NextResponse.redirect(new URL("/agent/dashboard", req.url));
    }

    // Internal users (non-admin) trying to access agent portal → send to main dashboard
    if (role !== "negotiator" && role !== "admin" && pathname.startsWith("/agent")) {
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
    "/((?!login|register|portal|api/auth|api/portal|api/register|_next/static|_next/image|favicon.ico).*)",
  ],
};
