import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateChainLinkStub, removeChainLink } from "@/lib/services/chains";
import { canManageStub, ownershipFromLinkRow, type StubLinkRow } from "@/lib/chain/stub-permissions";
import { type ChainNodeOwnership } from "@/lib/chain/intel";

type RouteParams = { params: Promise<{ id: string; linkId: string }> };

// The link's creating agency plus the claimed file's agency/owners (null for an
// unclaimed stub). chainId is returned too for the remove call. The permission
// decision itself lives in canManageStub (shared with invite/share/photo).
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
  const { chainId, ...row } = link;
  return { chainId, ownership: ownershipFromLinkRow(row as StubLinkRow) };
}

// PATCH /api/chains/[id]/links/[linkId] — edit an unclaimed stub
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { linkId } = await params;
  const found = await getLinkOwnership(linkId);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canManageStub(session, found.ownership)) {
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

  if (!canManageStub(session, found.ownership)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await removeChainLink(linkId, found.chainId);
  return NextResponse.json({ ok: true });
}
