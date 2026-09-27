import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { prisma } from "@/lib/prisma";
import { haltActiveFlows } from "@/lib/prospects/flow-ops";

const portalBase = () =>
  process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";

// Apply the suppression a verified unsubscribe token asks for. Shared by the
// GET (link click) and POST (RFC 8058 one-click) handlers. Idempotent: the null
// guards make a repeat click a no-op. Returns whether the subject was known and
// an optional `type` for the confirmation page copy.
async function processUnsubscribe(subject: string): Promise<{ ok: boolean; type?: string }> {
  if (subject.startsWith("user:")) {
    await prisma.user.updateMany({
      where: { id: subject.slice(5), emailUnsubscribedAt: null },
      data: { emailUnsubscribedAt: new Date() },
    });
    return { ok: true };
  }

  if (subject.startsWith("invite:")) {
    await prisma.chainLink.updateMany({
      where: { id: subject.slice(7), inviteUnsubscribedAt: null },
      data: { inviteUnsubscribedAt: new Date() },
    });
    return { ok: true };
  }

  if (subject.startsWith("contact:")) {
    // type=contact lets the confirmation page render a buyer/seller-specific
    // body rather than the generic line. No contactId in the redirect URL by
    // design (no unauthenticated ID lookup); copy is generic.
    await prisma.contact.updateMany({
      where: { id: subject.slice(8), unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    return { ok: true, type: "contact" };
  }

  if (subject.startsWith("prospect:")) {
    // Cold-outreach prospect opts out: stamp optedOutAt (the send path already
    // suppresses on it), stop any running flow, and log it on the timeline.
    const prospectId = subject.slice("prospect:".length);
    await prisma.prospect.updateMany({
      where: { id: prospectId, optedOutAt: null },
      data: { optedOutAt: new Date() },
    });
    await haltActiveFlows(prospectId, "opted_out").catch(() => {});
    await prisma.prospectActivity
      .create({ data: { prospectId, type: "opted_out", summary: "Unsubscribed from outreach" } })
      .catch(() => {});
    return { ok: true };
  }

  return { ok: false };
}

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const invalid = () => NextResponse.redirect(`${portalBase()}/unsubscribed?status=invalid`);
  if (!t) return invalid();

  const subject = verifyUnsubscribeToken(decodeURIComponent(t));
  if (!subject) return invalid();

  const res = await processUnsubscribe(subject);
  if (!res.ok) return invalid();
  return NextResponse.redirect(`${portalBase()}/unsubscribed?status=ok${res.type ? `&type=${res.type}` : ""}`);
}

// RFC 8058 one-click unsubscribe. Mailbox providers (Gmail / Yahoo bulk-sender
// rules) POST here with body `List-Unsubscribe=One-Click` when the header is
// present; the token still travels in the ?t= query. No redirect, just a 2xx.
export async function POST(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  if (!t) return new NextResponse(null, { status: 400 });
  const subject = verifyUnsubscribeToken(decodeURIComponent(t));
  if (!subject) return new NextResponse(null, { status: 400 });
  await processUnsubscribe(subject);
  return new NextResponse(null, { status: 200 });
}
