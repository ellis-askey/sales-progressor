import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditLink } from "@/lib/chain/permissions";
import crypto from "crypto";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

const SELECT = {
  id: true,
  chainId: true,
  createdByUserId: true,
  claimedByUserId: true,
  transactionId: true,
  stubAgentEmail: true,
  inviteStatus: true,
  shareToken: true,
} as const;

function claimBase(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

// POST /api/chains/[id]/links/[linkId]/share — create (or return) the manual
// share link for this slot. Idempotent: if a token already exists it's reused, so
// "Copy link" always returns the same URL until it's revoked. Separate from the
// email inviteToken (see ChainLink.shareToken) so email resends never rotate it.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: chainId, linkId } = await params;

  const link = await prisma.chainLink.findUnique({ where: { id: linkId }, select: SELECT });
  if (!link || link.chainId !== chainId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditLink(link, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let token = link.shareToken;
  if (!token) {
    token = crypto.randomBytes(32).toString("hex");
    await prisma.chainLink.update({
      where: { id: link.id },
      data: { shareToken: token, shareTokenCreatedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, url: `${claimBase()}/claim?token=${token}` });
}

// DELETE /api/chains/[id]/links/[linkId]/share — revoke the share link. Anyone
// still holding the old URL then lands on the "already used / not found" page.
// The email inviteToken is untouched.
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: chainId, linkId } = await params;

  const link = await prisma.chainLink.findUnique({ where: { id: linkId }, select: SELECT });
  if (!link || link.chainId !== chainId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canEditLink(link, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.chainLink.update({
    where: { id: link.id },
    data: { shareToken: null, shareTokenCreatedAt: null, shareLinkFirstViewedAt: null },
  });

  return NextResponse.json({ ok: true });
}
