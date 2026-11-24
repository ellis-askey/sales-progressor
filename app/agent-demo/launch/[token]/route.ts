// Public agent-demo launcher. The per-business link an agent opens. No login:
// it provisions (or resumes) an isolated sandbox, mints the scoped demo guest
// session, and drops the agent into the REAL file. Bypassed from the NextAuth
// gate in middleware.ts; the sandbox + session are hard-scoped so the visitor can
// only ever touch their own demo. See docs/active/agent-demo/SPEC.md.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDemoLaunchToken } from "@/lib/security/demo-launch-token";
import { createAgentDemoSandbox, touchAgentDemoSandbox } from "@/lib/services/demo-sale";
import {
  encodeDemoSessionToken,
  decodeDemoSessionToken,
  demoSessionCookieName,
  demoSessionCookieOptions,
} from "@/lib/security/demo-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileUrl(req: NextRequest, txId: string): URL {
  return new URL(`/agent/transactions/${txId}`, req.url);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
  const { token } = await params;
  const businessId = verifyDemoLaunchToken(token);
  if (!businessId) return NextResponse.redirect(new URL("/", req.url));

  const business = await prisma.progressionBusiness.findUnique({
    where: { id: businessId },
    select: { id: true, name: true },
  });
  if (!business) return NextResponse.redirect(new URL("/", req.url));

  // Resume an existing, still-live sandbox for THIS business in this browser.
  const raw = req.cookies.get(demoSessionCookieName())?.value;
  const existing = raw ? await decodeDemoSessionToken(raw) : null;
  if (existing?.businessId === businessId && existing.starTransactionId) {
    const starTx = await prisma.propertyTransaction.findFirst({
      where: { id: existing.starTransactionId, isDemo: true, demoKind: "agent_demo" },
      select: { id: true },
    });
    if (starTx) {
      await touchAgentDemoSandbox(existing.sandboxTransactionIds);
      return NextResponse.redirect(fileUrl(req, starTx.id));
    }
  }

  // Otherwise stand up a fresh, isolated sandbox and mint its session.
  const sandbox = await createAgentDemoSandbox({ businessId, businessName: business.name });
  const value = await encodeDemoSessionToken({
    agentUserId: sandbox.agentUserId,
    agentEmail: sandbox.agentEmail,
    agencyId: sandbox.agencyId,
    businessId,
    sandboxTransactionIds: sandbox.transactionIds,
    starTransactionId: sandbox.starTxId,
  });

  const res = NextResponse.redirect(fileUrl(req, sandbox.starTxId));
  res.cookies.set(demoSessionCookieName(), value, demoSessionCookieOptions());
  return res;
  } catch (e) {
    // Provisioning does a lot of DB work; if it fails (e.g. connection pressure),
    // show a friendly retry rather than a bare 500, and log for diagnosis.
    console.error("[agent-demo] launch failed", e);
    return new NextResponse("The demo is warming up. Please try again in a moment.", { status: 503 });
  }
}
