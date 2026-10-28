// POST /api/consent
//
// Records a cookie-consent decision server-side so we hold an auditable record
// (localStorage on the user's device alone can't be produced on request). Fired
// fire-and-forget by the consent banner via lib/analytics/consent.ts. It is
// unauthenticated because the banner can appear before sign-in; when a session
// exists we attach the user id. Writes are best-effort and never block the UI.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let analytics: boolean;
  try {
    const body = await req.json();
    analytics = Boolean(body?.analytics);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await getServerSession(authOptions).catch(() => null);
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;

  await prisma.consentRecord
    .create({
      data: {
        analytics,
        userId: session?.user?.id ?? null,
        ipAddress,
        userAgent,
      },
    })
    .catch(() => {
      // Best-effort: a failed audit write must never break the user's choice,
      // which is already persisted on their device by the banner.
    });

  return new NextResponse(null, { status: 204 });
}
