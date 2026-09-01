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
// scope, active/on-hold, and not already a link in any chain (chainLinkId null).
// Agency-scoped via the access-scope helper (Law 7).
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

  const files = await prisma.propertyTransaction.findMany({
    where: {
      AND: [
        scopeTransactionWhere(scope),
        { chainLinkId: null, status: { in: ["active", "on_hold"] } },
        q ? { propertyAddress: { contains: q, mode: "insensitive" } } : {},
      ],
    },
    select: { id: true, propertyAddress: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return NextResponse.json({ files });
}
