import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Records that a client opened a follow-up to their conveyancer (tapped "Open in
// email"). Powers the Command Centre opened-vs-sent usage view. Not proof of a
// send — the CC'd copy filed via the inbox sync is that.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = (await req.json().catch(() => ({}))) as { stepCode?: string; state?: string };
    if (!body.stepCode || !body.state) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const contact = await prisma.contact.findUnique({
      where: { portalToken: token },
      select: { id: true, propertyTransactionId: true, roleType: true },
    });
    if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.followupTap.create({
      data: {
        transactionId: contact.propertyTransactionId,
        contactId: contact.id,
        side: contact.roleType === "vendor" ? "vendor" : "purchaser",
        stepCode: body.stepCode,
        state: body.state,
      },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
