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

  return invalid();
}
