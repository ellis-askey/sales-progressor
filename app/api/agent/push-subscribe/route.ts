import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { subscription } = await req.json() as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Capture the user agent so the devices list in /agent/settings can show
    // a meaningful label ("Chrome on Mac") instead of a generic placeholder.
    // Nullable column — old subscriptions remain valid without a UA.
    const userAgent = req.headers.get("user-agent") ?? null;

    await prisma.agentPushSubscription.upsert({
      where:  { endpoint: subscription.endpoint },
      create: {
        userId:   session.user.id,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
        userAgent,
      },
      update: {
        userId: session.user.id,
        p256dh: subscription.keys.p256dh,
        auth:   subscription.keys.auth,
        // Refresh on re-subscribe — same endpoint may come back from a
        // different browser version, worth keeping the latest UA.
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json() as { endpoint: string };
    if (endpoint) {
      await prisma.agentPushSubscription.deleteMany({ where: { endpoint } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
