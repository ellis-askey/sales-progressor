import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { token, subscription } = await req.json() as {
      token: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };

    if (!token || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({
      where: { portalToken: token },
      select: { id: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.portalPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        contactId: contact.id,
        endpoint:  subscription.endpoint,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
      },
      update: {
        contactId: contact.id,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
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
      await prisma.portalPushSubscription.deleteMany({ where: { endpoint } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
