import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getChainV2, addChainLink, addChainBranch, addAboveLink, insertLinkAdjacent, selfLinkOwnSale, type SelfLinkContext } from "@/lib/services/chains";
import { isInternalStaff } from "@/lib/chain/permissions";
import { normaliseAddressString } from "@/lib/utils/address";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";

type RouteParams = { params: Promise<{ id: string }> };

// Agency-aware "can work this chain" gate. Internal staff always; a customer
// agency user (director OR negotiator) when their agency owns or created any link
// in the chain — so the whole agency can add / insert nodes on a chain one of
// their files sits in, not just the individual who built it. Widened 2026-09-15
// from the old person-based canAddAbove/canAddBelow (Ellis: directors + us should
// be able to add). Blocks a different agency in a shared chain (they own no link).
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

// POST /api/chains/[id]/links — add a stub link above or below, OR (when
// forkFromLinkId is present) an extra onward BRANCH forking above a sale.
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: chainId } = await params;
  const chain = await getChainV2(chainId);
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Must be able to work this chain (internal, or the viewer's agency owns/created
  // a link in it). Agency-aware so a director can add to a colleague's chain.
  if (!(await canManageChain(session, chainId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    direction?: "above" | "below";
    forkFromLinkId?: string;
    aboveOfLinkId?: string;
    // Insert-between mode: slot a new sale at a specific interior position next to
    // an anchor link (not at a column top). placement says which side.
    betweenAnchorLinkId?: string;
    betweenPlacement?: "above" | "below";
    // Self-link mode: drop one of the caller's OWN files in as a claimed node
    // instead of a hand-typed stub. Mutually exclusive with the stub fields.
    linkTransactionId?: string;
    stubPropertyAddress: string;
    stubAgencyName: string;
    stubAgentEmail?: string | null;
    stubAgentName?: string | null;
    stubAgentPhone?: string | null;
    stubNotes?: string | null;
  };

  // Self-link mode: link one of the caller's own live files as a claimed node.
  // The stub fields aren't required here (the transaction supplies address +
  // agency). Position mirrors the stub adds: branch / column-top / spine.
  if (body.linkTransactionId) {
    // Law 7: the file must be within the caller's access scope AND eligible
    // (active/on-hold, not already a link in any chain).
    const scope = getAccessScope(session);
    const eligible = await prisma.propertyTransaction.findFirst({
      where: {
        AND: [
          scopeTransactionWhere(scope),
          { id: body.linkTransactionId, chainLinkId: null, status: { in: ["active", "on_hold"] } },
        ],
      },
      select: { id: true },
    });
    if (!eligible) {
      return NextResponse.json({ error: "That sale can't be added to the chain." }, { status: 400 });
    }

    let context: SelfLinkContext;
    if (body.forkFromLinkId) {
      const forkNode = chain.links.find((l) => l.id === body.forkFromLinkId);
      if (!forkNode) return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
      context = { kind: "branch", forkFromLinkId: body.forkFromLinkId };
    } else if (body.aboveOfLinkId) {
      const anchor = chain.links.find((l) => l.id === body.aboveOfLinkId);
      if (!anchor) return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
      context = { kind: "column", aboveOfLinkId: body.aboveOfLinkId };
    } else if (body.betweenAnchorLinkId) {
      const anchor = chain.links.find((l) => l.id === body.betweenAnchorLinkId);
      if (!anchor) return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
      context = {
        kind: "between",
        anchorLinkId: body.betweenAnchorLinkId,
        placement: body.betweenPlacement === "below" ? "below" : "above",
      };
    } else {
      if (!body.direction) return NextResponse.json({ error: "direction is required" }, { status: 400 });
      context = { kind: "spine", direction: body.direction };
    }

    const linkResult = await selfLinkOwnSale({
      chainId,
      userId: session.user.id,
      transactionId: body.linkTransactionId,
      context,
    });
    if (!linkResult.ok) {
      const msg = linkResult.reason === "at_limit"
        ? "A sale can have at most three onward purchases."
        : "That sale can't be added to the chain.";
      return NextResponse.json({ error: msg }, { status: linkResult.reason === "at_limit" ? 409 : 400 });
    }
    return NextResponse.json({ chain: linkResult.chain, inviteSent: false }, { status: 201 });
  }

  if (!body.stubPropertyAddress || !body.stubAgencyName) {
    return NextResponse.json(
      { error: "stubPropertyAddress and stubAgencyName are required" },
      { status: 400 },
    );
  }

  // Branch mode: an extra onward purchase forking above a specific sale. Adding
  // an onward is an "above" action, so it uses the add-above permission on that
  // fork node.
  if (body.forkFromLinkId) {
    const forkNode = chain.links.find((l) => l.id === body.forkFromLinkId);
    if (!forkNode) {
      return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
    }
    const branchResult = await addChainBranch({
      chainId,
      forkFromLinkId: body.forkFromLinkId,
      userId: session.user.id,
      stubPropertyAddress: normaliseAddressString(body.stubPropertyAddress),
      stubAgencyName: body.stubAgencyName,
      stubAgentEmail: body.stubAgentEmail ?? null,
      stubAgentName: body.stubAgentName ?? null,
      stubAgentPhone: body.stubAgentPhone ?? null,
      stubNotes: body.stubNotes ?? null,
    });
    if (!branchResult.ok) {
      const msg = branchResult.reason === "at_limit"
        ? "A sale can have at most three onward purchases."
        : "That sale is not in this chain.";
      return NextResponse.json({ error: msg }, { status: branchResult.reason === "at_limit" ? 409 : 400 });
    }
    return NextResponse.json({ chain: branchResult.chain, inviteSent: false }, { status: 201 });
  }

  // Add-above-a-column mode: insert a sale at the top of a specific ladder (the
  // spine or a branch). Uses the same add-above permission on that column's top
  // link. This is how each column in a split grows upward independently.
  if (body.aboveOfLinkId) {
    const anchor = chain.links.find((l) => l.id === body.aboveOfLinkId);
    if (!anchor) {
      return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
    }
    const aboveResult = await addAboveLink({
      chainId,
      userId: session.user.id,
      aboveLinkId: body.aboveOfLinkId,
      stubPropertyAddress: normaliseAddressString(body.stubPropertyAddress),
      stubAgencyName: body.stubAgencyName,
      stubAgentEmail: body.stubAgentEmail ?? null,
      stubAgentName: body.stubAgentName ?? null,
      stubAgentPhone: body.stubAgentPhone ?? null,
      stubNotes: body.stubNotes ?? null,
    });
    if (!aboveResult.ok) {
      return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
    }
    return NextResponse.json({ chain: aboveResult.chain, inviteSent: false }, { status: 201 });
  }

  // Insert-between mode: slot a stub at a specific interior position beside an
  // anchor link. Placement drives the permission (above → canAddAbove on the
  // anchor, below → canAddBelow) and the position the new link lands on. Stub-only
  // for now — self-linking your own file between two links isn't supported yet.
  if (body.betweenAnchorLinkId) {
    const anchor = chain.links.find((l) => l.id === body.betweenAnchorLinkId);
    if (!anchor) {
      return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
    }
    const placement = body.betweenPlacement === "below" ? "below" : "above";
    const insertResult = await insertLinkAdjacent({
      chainId,
      userId: session.user.id,
      anchorLinkId: body.betweenAnchorLinkId,
      placement,
      stubPropertyAddress: normaliseAddressString(body.stubPropertyAddress),
      stubAgencyName: body.stubAgencyName,
      stubAgentEmail: body.stubAgentEmail ?? null,
      stubAgentName: body.stubAgentName ?? null,
      stubAgentPhone: body.stubAgentPhone ?? null,
      stubNotes: body.stubNotes ?? null,
    });
    if (!insertResult.ok) {
      return NextResponse.json({ error: "That sale is not in this chain." }, { status: 400 });
    }
    return NextResponse.json({ chain: insertResult.chain, inviteSent: false }, { status: 201 });
  }

  if (!body.direction) {
    return NextResponse.json({ error: "direction is required" }, { status: 400 });
  }

  // Permission is the single agency-aware canManageChain gate at the top; spine
  // add just needs a direction (addChainLink anchors on chainId + direction).
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
