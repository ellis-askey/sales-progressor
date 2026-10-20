import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getChainV2 } from "@/lib/services/chains";
import { canViewChain } from "@/lib/chain/permissions";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/chains/[id]/link-candidates?q=… — the caller's OWN live files that
// could be dropped into this chain as a real (claimed) node: within their access
// scope and active/on-hold. Agency-scoped via the access-scope helper (Law 7).
//
// Since 2026-10-20 a file that already has its OWN chain is a candidate too —
// picking it folds its whole chain into this one (selfLinkOwnSale merge). Each
// result says what that would bring (`chain.others`) and whether the join is
// allowed (`chain.joinable`): refused when the sale sits on a branch of its own
// chain, or when its chain contains a joined sale outside the caller's scope.
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: chainId } = await params;
  const chain = await getChainV2(chainId);
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allLinks = chain.links.map((l) => ({
    claimedByUserId: l.claimedByUserId,
    createdByUserId: l.createdByUserId,
  }));
  if (!canViewChain(allLinks, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const scope = getAccessScope(session);

  const rows = await prisma.propertyTransaction.findMany({
    where: {
      AND: [
        scopeTransactionWhere(scope),
        { status: { in: ["active", "on_hold"] } },
        // No chain yet, or a chain OTHER than this one (already-here is pointless).
        { OR: [{ chainLinkId: null }, { chainLink: { chainId: { not: chainId } } }] },
        q ? { propertyAddress: { contains: q, mode: "insensitive" } } : {},
      ],
    },
    select: {
      id: true,
      propertyAddress: true,
      chainLink: {
        select: {
          branchKey: true,
          chain: { select: { links: { select: { transactionId: true } } } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  // One scope query authorises every companion sale across all candidates.
  const companionIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        (r.chainLink?.chain.links ?? [])
          .map((l) => l.transactionId)
          .filter((id): id is string => Boolean(id) && id !== r.id),
      ),
    ),
  );
  const inScopeCompanions = new Set(
    companionIds.length === 0
      ? []
      : (
          await prisma.propertyTransaction.findMany({
            where: { AND: [scopeTransactionWhere(scope), { id: { in: companionIds } }] },
            select: { id: true },
          })
        ).map((t) => t.id),
  );

  const files = rows.map((r) => {
    if (!r.chainLink) return { id: r.id, propertyAddress: r.propertyAddress, chain: null };
    const companions = r.chainLink.chain.links
      .map((l) => l.transactionId)
      .filter((id): id is string => Boolean(id) && id !== r.id);
    const joinable =
      (r.chainLink.branchKey ?? "") === "" && companions.every((id) => inScopeCompanions.has(id));
    return {
      id: r.id,
      propertyAddress: r.propertyAddress,
      chain: { others: r.chainLink.chain.links.length - 1, joinable },
    };
  });

  return NextResponse.json({ files });
}
