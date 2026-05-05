import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateChainLinkStub, removeChainLink } from "@/lib/services/chains";
import { canEditLink, canDeleteLink } from "@/lib/chain/permissions";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

async function getLinkWithChain(linkId: string) {
  return prisma.chainLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      chainId: true,
      createdByUserId: true,
      claimedByUserId: true,
      transactionId: true,
      stubAgentEmail: true,
      inviteStatus: true,
    },
  });
}

// PATCH /api/chains/[id]/links/[linkId] — edit an unclaimed stub
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { linkId } = await params;
  const link = await getLinkWithChain(linkId);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditLink(link, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    stubPropertyAddress?: string;
    stubAgencyName?: string;
    stubAgentEmail?: string | null;
    stubAgentName?: string | null;
    stubAgentPhone?: string | null;
    stubNotes?: string | null;
  };

  await updateChainLinkStub(linkId, body);
  return NextResponse.json({ ok: true });
}

// DELETE /api/chains/[id]/links/[linkId] — remove an unclaimed stub
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { linkId } = await params;
  const link = await getLinkWithChain(linkId);
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canDeleteLink(link, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await removeChainLink(linkId, link.chainId);
  return NextResponse.json({ ok: true });
}
