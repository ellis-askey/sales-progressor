import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChainV2, addChainLink } from "@/lib/services/chains";
import { canAddAbove, canAddBelow, canViewChain } from "@/lib/chain/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/chains/[id]/links — add a stub link above or below
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: chainId } = await params;
  const chain = await getChainV2(chainId);
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Must be a chain participant to add links
  const allLinks = chain.links.map((l) => ({
    claimedByUserId: l.claimedByUserId,
    createdByUserId: l.createdByUserId,
  }));
  if (!canViewChain(allLinks, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    direction: "above" | "below";
    stubPropertyAddress: string;
    stubAgencyName: string;
    stubAgentEmail?: string | null;
    stubAgentName?: string | null;
    stubAgentPhone?: string | null;
    stubNotes?: string | null;
  };

  if (!body.direction || !body.stubPropertyAddress || !body.stubAgencyName) {
    return NextResponse.json(
      { error: "direction, stubPropertyAddress and stubAgencyName are required" },
      { status: 400 },
    );
  }

  // Find the user's own link to determine if they have add permission
  const usersOwnLink = chain.links.find(
    (l) => l.claimedByUserId === session.user.id || l.createdByUserId === session.user.id,
  );

  if (!usersOwnLink) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.direction === "above" && !canAddAbove(usersOwnLink, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.direction === "below" && !canAddBelow(usersOwnLink, session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updatedChain = await addChainLink({
    chainId,
    userId: session.user.id,
    direction: body.direction,
    stubPropertyAddress: body.stubPropertyAddress,
    stubAgencyName: body.stubAgencyName,
    stubAgentEmail: body.stubAgentEmail ?? null,
    stubAgentName: body.stubAgentName ?? null,
    stubAgentPhone: body.stubAgentPhone ?? null,
    stubNotes: body.stubNotes ?? null,
  });

  return NextResponse.json({ chain: updatedChain }, { status: 201 });
}
