import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageStub, ownershipFromLinkRow } from "@/lib/chain/stub-permissions";
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
      inviteResendCount: true,
      // Ownership facts for the agency-aware stub gate (canManageStub).
      createdBy: { select: { agencyId: true } },
      transaction: { select: { agencyId: true, assignedUserId: true, agentUserId: true } },
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
  if (!canManageStub(session, ownershipFromLinkRow(link))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // canSendInvite used to fold in the "has an email" requirement; keep it as an
  // explicit guard now the permission check is agency-scoped.
  if (!link.stubAgentEmail) {
    return NextResponse.json({ error: "Add an email for this contact before inviting them." }, { status: 400 });
  }

  // Resend cap: one initial send plus up to five resends. Beyond that a resend
  // is almost always a wrong/dead address, so we stop rather than keep emailing.
  const MAX_SENDS = 6;
  if (link.inviteResendCount >= MAX_SENDS) {
    return NextResponse.json(
      { error: "This invite has been sent the maximum number of times. Check the address or reach the agent another way." },
      { status: 429 },
    );
  }

  await sendChainInvite({ link, sentByUserId: session.user.id, sentByName: session.user.name ?? "" });
  return NextResponse.json({ ok: true });
}
