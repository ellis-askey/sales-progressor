import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isExchangeDayActive } from "@/lib/services/exchange-day";

// Records that the client has given their solicitor authority to exchange, from
// the exchange-day card on their portal. Only accepted while the file is
// actively in exchange day. Stamps Contact.exchangeAuthorityGivenAt (valid for
// the current activation) and logs an internal activity note so the team can see
// who's ready. See docs/active/exchange-day-SPEC.md.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const contact = await prisma.contact.findFirst({
      where: { portalToken: token },
      select: {
        id: true,
        name: true,
        propertyTransactionId: true,
        transaction: { select: { exchangeDayStartedAt: true, exchangeDayCancelledAt: true, exchangedAt: true } },
      },
    });
    if (!contact?.transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isExchangeDayActive(contact.transaction)) {
      return NextResponse.json({ error: "Not in exchange day" }, { status: 409 });
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: { exchangeAuthorityGivenAt: new Date() },
    });
    await prisma.outboundMessage.create({
      data: {
        transactionId: contact.propertyTransactionId,
        type: "internal_note",
        contactIds: [contact.id],
        content: `${contact.name} confirmed via their portal that they've given their solicitor authority to exchange.`,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
