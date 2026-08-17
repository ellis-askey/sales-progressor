import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Records portal PWA adoption (Command Centre → App adoption). The client pings
// this on load when it's running in standalone display-mode, and on the browser
// "appinstalled" event. iOS fires no install event, so a standalone open is the
// only signal there — hence the first standalone open also stamps installed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = (await req.json().catch(() => ({}))) as { standalone?: boolean; installed?: boolean };

    const contact = await prisma.contact.findUnique({
      where: { portalToken: token },
      select: { id: true, pwaInstalledAt: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    const data: { pwaLastOpenedAt?: Date; pwaInstalledAt?: Date } = {};
    if (body.standalone) {
      data.pwaLastOpenedAt = now;
      if (!contact.pwaInstalledAt) data.pwaInstalledAt = now;
    }
    if (body.installed) data.pwaInstalledAt = now;

    if (Object.keys(data).length > 0) {
      await prisma.contact.update({ where: { id: contact.id }, data });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
