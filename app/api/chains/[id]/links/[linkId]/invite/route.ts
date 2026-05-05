import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canSendInvite } from "@/lib/chain/permissions";
import { sendChainInvite } from "@/lib/chain/invite";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

// POST /api/chains/[id]/links/[linkId]/invite — send or resend invite
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { linkId } = await params;

  const link = await prisma.chainLink.findUnique({
    where: { id: linkId },
    select: {
      id: true,
      chainId: true,
      createdByUserId: true,
      claimedByUserId: true,
      transactionId: true,
      stubAgentEmail: true,
      stubAgentName: true,
      stubPropertyAddress: true,
      stubAgencyName: true,
      inviteStatus: true,
      chain: {
        select: {
          createdByUserId: true,
          links: {
            select: {
              position: true,
              transactionId: true,
              transaction: { select: { propertyAddress: true } },
              stubPropertyAddress: true,
            },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canSendInvite(link, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await sendChainInvite({ link, sentByUserId: session.user.id, sentByName: session.user.name ?? "" });
  return NextResponse.json({ ok: true });
}
