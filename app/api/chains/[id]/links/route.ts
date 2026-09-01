import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChainV2, addChainLink } from "@/lib/services/chains";
import { canAddAbove, canAddBelow, canViewChain } from "@/lib/chain/permissions";
import { normaliseAddressString } from "@/lib/utils/address";

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
  if (!canViewChain(allLinks, session.user.id, session.user.role)) {
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

  // Anchor for the add-permission check: the user's own link when they have
  // one. Internal staff progressing an OUTSOURCED file own no chain link, so
  // fall back to any link — canAddAbove/canAddBelow return true for internal
  // staff regardless of which link is passed (mirrors canViewChain). A normal
  // non-participant still fails the check on that fallback link, so their
  // "must own a link" gate is unchanged. addChainLink anchors on chainId +
  // direction, not this link, so the fallback only affects the permission test.
  const usersOwnLink = chain.links.find(
    (l) => l.claimedByUserId === session.user.id || l.createdByUserId === session.user.id,
  );
  const anchorLink = usersOwnLink ?? chain.links[0] ?? null;
  if (!anchorLink) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.direction === "above" && !canAddAbove(anchorLink, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.direction === "below" && !canAddBelow(anchorLink, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Normalise the postcode portion of the stub address before persisting
  // so chain-invite emails and downstream displays never render "bs1 4pn"
  // style garbage. Leaves street/city untouched — postcode is the only
  // segment with a canonical form.
  const updatedChain = await addChainLink({
    chainId,
    userId: session.user.id,
    direction: body.direction,
    stubPropertyAddress: normaliseAddressString(body.stubPropertyAddress),
    stubAgencyName: body.stubAgencyName,
    stubAgentEmail: body.stubAgentEmail ?? null,
    stubAgentName: body.stubAgentName ?? null,
    stubAgentPhone: body.stubAgentPhone ?? null,
    stubNotes: body.stubNotes ?? null,
  });

  // Adding a link to an existing chain never auto-sends the invite. Invites go
  // out automatically only when a sale is first created (see the chain-stub loop
  // in app/actions/transactions.ts). A link added any other way is invited
  // manually via Send invite on its card. (Ellis, 2026-09-01.)
  return NextResponse.json({ chain: updatedChain, inviteSent: false }, { status: 201 });
}
