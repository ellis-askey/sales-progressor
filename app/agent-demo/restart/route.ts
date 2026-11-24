// "Start over" for the agent demo: tears down the current sandbox and re-enters
// the launcher for the same business, so the agent gets a pristine file. Bypassed
// from the NextAuth gate in middleware.ts. See docs/active/agent-demo/SPEC.md.

import { NextRequest, NextResponse } from "next/server";
import { removeAgentDemoSandbox } from "@/lib/services/demo-sale";
import { decodeDemoSessionToken, demoSessionCookieName } from "@/lib/security/demo-session";
import { signDemoLaunchToken } from "@/lib/security/demo-launch-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.cookies.get(demoSessionCookieName())?.value;
  const existing = raw ? await decodeDemoSessionToken(raw) : null;

  if (!existing?.businessId) {
    // No demo session to restart — send home.
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Tear down this visitor's sandbox (files, demo agent, ephemeral agency).
  if (existing.agencyId) {
    await removeAgentDemoSandbox(existing.agencyId).catch(() => {});
  }

  // Re-enter the launcher for the same business. The stale cookie no longer
  // resolves (its sandbox is gone), so the launcher provisions a fresh one.
  const res = NextResponse.redirect(new URL(`/agent-demo/launch/${signDemoLaunchToken(existing.businessId)}`, req.url));
  res.cookies.delete(demoSessionCookieName());
  return res;
}
