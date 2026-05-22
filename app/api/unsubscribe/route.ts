import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { prisma } from "@/lib/prisma";

const portalBase = () =>
  process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");

  const invalid = () =>
    NextResponse.redirect(`${portalBase()}/unsubscribed?status=invalid`);

  if (!t) return invalid();

  const subject = verifyUnsubscribeToken(decodeURIComponent(t));
  if (!subject) return invalid();

  if (subject.startsWith("user:")) {
    const userId = subject.slice(5);
    await prisma.user.updateMany({
      where: { id: userId, emailUnsubscribedAt: null },
      data: { emailUnsubscribedAt: new Date() },
    });
    return NextResponse.redirect(`${portalBase()}/unsubscribed?status=ok`);
  }

  if (subject.startsWith("invite:")) {
    const chainLinkId = subject.slice(7);
    await prisma.chainLink.updateMany({
      where: { id: chainLinkId, inviteUnsubscribedAt: null },
      data: { inviteUnsubscribedAt: new Date() },
    });
    return NextResponse.redirect(`${portalBase()}/unsubscribed?status=ok`);
  }

  if (subject.startsWith("contact:")) {
    const contactId = subject.slice(8);
    // updateMany with the null guard means re-clicking the same link is a
    // no-op (matches the user/invite pattern). Always redirects to the same
    // confirmation page.
    //
    // type=contact lets the confirmation page render a buyer/seller-specific
    // body ("update reminders for your sale", "your agent will still be in
    // touch") rather than the generic "unsubscribed from this address" line
    // used by the user/invite branches. NOTE: no contactId in the redirect
    // URL — the page intentionally does NOT do an unauthenticated ID lookup
    // (would be IDOR pattern). Copy is generic-by-design.
    await prisma.contact.updateMany({
      where: { id: contactId, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    return NextResponse.redirect(`${portalBase()}/unsubscribed?status=ok&type=contact`);
  }

  return invalid();
}
