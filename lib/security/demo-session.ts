// Agent-demo guest session.
//
// The public demo visitor needs a real session so the REAL agent file renders
// byte-for-byte. We mint a bona-fide NextAuth JWT whose principal IS the
// sandbox's per-visitor demo agent (a real isDemo User), carrying the sandbox's
// transaction ids. getAccessScope reads those ids FIRST and returns the hard
// "demo" scope, so the session can only ever touch its own sandbox — proven in
// __tests__/multi-tenant/access-scope-demo.test.ts.
//
// This is a normal NextAuth session everywhere (middleware, getServerSession,
// requireSession), so no other auth path needs to learn about the demo. The only
// bespoke bits are the demoSandbox* fields, read by getAccessScope + middleware.
//
// The encode/decode primitives are exposed (rather than a cookies()-based setter)
// so the launcher route can set the cookie ON its redirect response — cookies set
// via next/headers do not ride a NextResponse.redirect.
//
// See docs/active/agent-demo/SPEC.md.

import { encode, decode } from "next-auth/jwt";

// Matches the sandbox idle TTL (lib/services/demo-sale.ts AGENT_DEMO_TTL_MS).
export const AGENT_DEMO_SESSION_MAX_AGE_S = 60 * 60 * 3;

// NextAuth prefixes the cookie with __Secure- when it uses secure cookies, which
// it does on https (production / preview). Mirror that so getToken/getServerSession
// find the cookie we set.
function useSecureCookies(): boolean {
  return process.env.NODE_ENV === "production" || (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}
export function demoSessionCookieName(): string {
  return useSecureCookies() ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}
export function demoSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: useSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: AGENT_DEMO_SESSION_MAX_AGE_S,
  };
}

export type DemoSessionSeed = {
  agentUserId: string;
  agentEmail: string;
  agencyId: string;
  businessId: string;
  sandboxTransactionIds: string[];
  starTransactionId: string;
};

/** Encode the demo guest session as a NextAuth JWT (cookie value). */
export async function encodeDemoSessionToken(seed: DemoSessionSeed): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set — cannot mint a demo session");
  return encode({
    secret,
    maxAge: AGENT_DEMO_SESSION_MAX_AGE_S,
    token: {
      id: seed.agentUserId,
      sub: seed.agentUserId,
      name: "Demo visitor",
      email: seed.agentEmail,
      role: "negotiator",
      agencyId: seed.agencyId,
      firmName: null,
      needsSignupCompletion: false,
      // Fresh demo agents are created with the default sessionVersion (0); the jwt
      // callback's version check then passes on every request.
      sessionVersion: 0,
      progressionBusinessId: null,
      progressionBusinessRole: null,
      canViewAllFiles: false,
      demoSandboxTransactionIds: seed.sandboxTransactionIds,
      demoStarTransactionId: seed.starTransactionId,
      demoBusinessId: seed.businessId,
    },
  });
}

/** Decode a cookie value into its demo-sandbox fields, or null if it isn't a demo session. */
export async function decodeDemoSessionToken(
  raw: string,
): Promise<{
  sandboxTransactionIds: string[];
  starTransactionId: string | null;
  agencyId: string | null;
  businessId: string | null;
} | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = await decode({ token: raw, secret }).catch(() => null);
  const ids = token?.demoSandboxTransactionIds;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  return {
    sandboxTransactionIds: ids,
    starTransactionId: token?.demoStarTransactionId ?? null,
    agencyId: token?.agencyId ?? null,
    businessId: token?.demoBusinessId ?? null,
  };
}
