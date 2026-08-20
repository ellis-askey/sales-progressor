import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Stamps welcomeSeenAt on the client's Contact when they dismiss the first-visit
// welcome sheet ("Got it"). Gates the sheet server-side so it shows once per
// person, forever, across every device. Idempotent: only the first call sets
// the timestamp (updateMany where welcomeSeenAt IS NULL), so a re-post is a
// no-op. No body needed — the token identifies the contact.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    await prisma.contact.updateMany({
      where: { portalToken: token, welcomeSeenAt: null },
      data: { welcomeSeenAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
