import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getChainForTransactionV2,
  createChainV2,
  // Legacy functions kept for _legacy/ widget backward compat
  getChainForTransaction,
  createChain,
  upsertChainLink,
} from "@/lib/services/chains";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { canViewChain } from "@/lib/chain/permissions";

// GET /api/chains?transactionId=... — fetch chain for a transaction (v2)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });

  const scope = getAccessScope(session);
  const txn = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, transactionId),
    select: { id: true },
  });
  if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Try v2 chain first (canonical chainLinkId); fall back to legacy
  const chain = await getChainForTransactionV2(transactionId);
  if (chain) {
    const allLinks = chain.links.map((l) => ({
      claimedByUserId: l.claimedByUserId,
      createdByUserId: l.createdByUserId,
    }));
    if (!canViewChain(allLinks, session.user.id)) {
      return NextResponse.json({ chain: null });
    }
    return NextResponse.json({ chain });
  }

  // Fallback: legacy chain (no permission check required — same agency)
  const legacyChain = await getChainForTransaction(transactionId);
  return NextResponse.json({ chain: legacyChain });
}

// POST /api/chains — create a new chain for the current transaction
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();

  // v2: { transactionId, stubs? }
  if (body.transactionId && !body.links) {
    const { transactionId, stubs } = body as {
      transactionId: string;
      stubs?: Array<{
        direction: "above" | "below";
        stubPropertyAddress: string;
        stubAgencyName: string;
        stubAgentEmail?: string | null;
        stubAgentName?: string | null;
        stubAgentPhone?: string | null;
        stubNotes?: string | null;
      }>;
    };

    const scope = getAccessScope(session);
    const txn = await prisma.propertyTransaction.findFirst({
      where: scopeOwnershipWhere(scope, transactionId),
      select: { id: true, agencyId: true, chainLinkId: true },
    });
    if (!txn) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (txn.chainLinkId) {
      return NextResponse.json({ error: "Transaction already in a chain" }, { status: 409 });
    }

    const chain = await createChainV2({
      transactionId,
      agencyId: txn.agencyId,
      userId: session.user.id,
      stubs: stubs ?? [],
    });
    return NextResponse.json({ chain }, { status: 201 });
  }

  // Legacy path: { transactionId, name?, links[] }
  const { transactionId, name, links } = body as {
    transactionId: string;
    name?: string | null;
    links: Array<{
      position: number;
      transactionId?: string | null;
      externalAddress?: string | null;
      externalStatus?: string | null;
    }>;
  };

  const legacyScope = getAccessScope(session);
  const legacyTxn = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(legacyScope, transactionId),
    select: { id: true, agencyId: true },
  });
  if (!legacyTxn) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chain = await createChain(legacyTxn.agencyId, name ?? null);
  for (const link of links) {
    await upsertChainLink(chain.id, link.position, {
      transactionId: link.transactionId ?? null,
      externalAddress: link.externalAddress ?? null,
      externalStatus: link.externalStatus ?? null,
    });
  }

  const result = await getChainForTransaction(transactionId);
  return NextResponse.json({ chain: result });
}
