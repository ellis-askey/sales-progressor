import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isInternalStaff } from "@/lib/chain/permissions";
import { externalMemberChainAccess } from "@/lib/chain/external-scope";

type RouteParams = { params: Promise<{ id: string }> };

// Same "can work this chain" gate as adding links (canManageChain in
// links/route.ts): internal staff always; a customer-agency user (director or
// negotiator) when their agency owns or created any link in the chain. Blocks a
// different agency in a shared chain.
async function canManageChain(
  session: { user: { id: string; role?: string | null; agencyId?: string | null } },
  chainId: string,
): Promise<boolean> {
  if (isInternalStaff(session.user.role)) return true;
  const agencyId = session.user.agencyId;
  if (!agencyId) return false;
  const links = await prisma.chainLink.findMany({
    where: { chainId },
    select: {
      createdBy: { select: { agencyId: true } },
      transaction: { select: { agencyId: true } },
    },
  });
  return links.some(
    (l) => l.transaction?.agencyId === agencyId || l.createdBy?.agencyId === agencyId,
  );
}

// POST /api/chains/[id]/complete — mark the chain complete (the top property is
// the top of the chain), or clear it. Internal only; never surfaced to clients
// or other agencies. Completeness itself is DERIVED on read (getChainV2) from the
// stamped top link, so this endpoint only sets or clears that stamp — adding a
// sale above, or a fall-through, flips the derived flag back on its own.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: chainId } = await params;
  const chain = await prisma.propertyChain.findUnique({ where: { id: chainId }, select: { id: true } });
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // External business member → scoped to chains their own sales are in; everyone
  // else uses the agency-aware gate above.
  const ext = await externalMemberChainAccess(session, chainId);
  const canManage = ext ? ext.participates : await canManageChain(session, chainId);
  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { complete?: boolean };

  if (body.complete) {
    // The top of the chain is the lowest-position link on the MAIN SPINE
    // (branchKey ""). Stamp it; the read derives complete from it staying the top.
    const topLink = await prisma.chainLink.findFirst({
      where: { chainId, branchKey: "" },
      orderBy: { position: "asc" },
      select: { id: true },
    });
    if (!topLink) return NextResponse.json({ error: "This chain has no sales yet." }, { status: 400 });
    await prisma.propertyChain.update({
      where: { id: chainId },
      data: {
        topConfirmedLinkId: topLink.id,
        topConfirmedAt: new Date(),
        topConfirmedById: session.user.id,
      },
    });
  } else {
    await prisma.propertyChain.update({
      where: { id: chainId },
      data: { topConfirmedLinkId: null, topConfirmedAt: null, topConfirmedById: null },
    });
  }

  return NextResponse.json({ ok: true });
}
