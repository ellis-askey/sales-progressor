import { NextRequest, NextResponse } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAccessScope } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { updateChainLinkStub, removeChainLink } from "@/lib/services/chains";
import { canEditNodeIntel, type IntelViewer, type ChainNodeOwnership } from "@/lib/chain/intel";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

// Ownership facts a stub edit/remove permission decision needs — the link's
// creating agency plus the claimed file's agency/owners (null for an unclaimed
// stub). chainId is returned too for the remove call.
async function getLinkOwnership(
  linkId: string,
): Promise<{ chainId: string; ownership: ChainNodeOwnership } | null> {
  const link = await prisma.chainLink.findUnique({
    where: { id: linkId },
    select: {
      chainId: true,
      transactionId: true,
      createdByUserId: true,
      createdBy: { select: { agencyId: true } },
      transaction: { select: { agencyId: true, assignedUserId: true, agentUserId: true } },
    },
  });
  if (!link) return null;
  return {
    chainId: link.chainId,
    ownership: {
      transactionId: link.transactionId,
      linkCreatedByUserId: link.createdByUserId,
      linkCreatedByAgencyId: link.createdBy?.agencyId ?? null,
      txAgencyId: link.transaction?.agencyId ?? null,
      txAssignedUserId: link.transaction?.assignedUserId ?? null,
      txAgentUserId: link.transaction?.agentUserId ?? null,
    },
  };
}

// True when this viewer may edit/remove an UNCLAIMED stub: the same owner set as
// the node intel (internal team, the stub's creator, or a director in the
// creating agency). Mirrors canEditStub in getChainV2 so UI and API agree.
function canEditStub(
  session: Session | null,
  ownership: ChainNodeOwnership,
): boolean {
  if (!session?.user) return false;
  if (ownership.transactionId !== null) return false; // claimed = a real file, not a stub
  const viewer: IntelViewer = {
    userId: session.user.id,
    role: session.user.role,
    agencyId: session.user.agencyId ?? null,
    scope: getAccessScope(session),
  };
  return canEditNodeIntel(viewer, ownership);
}

// PATCH /api/chains/[id]/links/[linkId] — edit an unclaimed stub
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { linkId } = await params;
  const found = await getLinkOwnership(linkId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditStub(session, found.ownership)) {
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
  const found = await getLinkOwnership(linkId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditStub(session, found.ownership)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await removeChainLink(linkId, found.chainId);
  return NextResponse.json({ ok: true });
}
