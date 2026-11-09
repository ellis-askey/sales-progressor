import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// Records STAFF PWA adoption — the agent-app mirror of /api/portal/[token]/pwa.
// The client pings this on load when the app is running in standalone display-
// mode (added to home screen), and on the browser "appinstalled" event. iOS
// fires no install event, so a standalone open is the only signal there — hence
// the first standalone open also stamps installed. Session-scoped: it only ever
// touches the signed-in user's own row.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = (await req.json().catch(() => ({}))) as { standalone?: boolean; installed?: boolean };

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, pwaInstalledAt: true },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const now = new Date();
    const data: { pwaLastOpenedAt?: Date; pwaInstalledAt?: Date } = {};
    if (body.standalone) {
      data.pwaLastOpenedAt = now;
      if (!user.pwaInstalledAt) data.pwaInstalledAt = now;
    }
    if (body.installed) data.pwaInstalledAt = now;

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
