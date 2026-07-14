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

  // Try v2 chain first (canonical chainLinkId); fall back to legacy.
  // session.user.id flows through so stuckMilestoneLabel is populated only
  // on the viewer's own link (privacy: full detail for self, summary only
  // for other links).
  const chain = await getChainForTransactionV2(transactionId, session.user.id);
  if (chain) {
    const allLinks = chain.links.map((l) => ({
      claimedByUserId: l.claimedByUserId,
      createdByUserId: l.createdByUserId,
    }));
    // 2026-07-14: pass role so internal staff (admin / superadmin /
    // sales_progressor) bypass the participant check. Everyone else stays
    // gated by membership.
    //
    // When gated out we now surface an explicit flag so the drawer can
    // render "This file is in a chain" honest copy instead of the "No
    // chain yet + Create" empty state — the latter was misleading (chain
    // does exist) AND set up a double-create trap that immediately errored
    // with "Transaction already in a chain".
    if (!canViewChain(allLinks, session.user.id, session.user.role)) {
      return NextResponse.json({ chain: null, notAParticipant: true });
    }

    // Cascade-notification augmentation: per-link directional state for badges
    // + this user's pending notifications for the respond UI.
    const allNotifications = await prisma.chainNotificationQueue.findMany({
      where: { chainId: chain.id },
      select: {
        id: true,
        recipientLinkId: true,
        recipientUserId: true,
        type: true,
        direction: true,
        triggeringLinkId: true,
        response: true,
        respondedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // For each link, find the most-recent responded notification per direction.
    // The link's existing `withdrawalStatus = 'WITHDRAWN'` is terminal and
    // overrides per-direction state.
    const directional: Record<string, { upward: string | null; downward: string | null }> = {};
    for (const link of chain.links) {
      const upward = allNotifications.find(
        (n) => n.recipientLinkId === link.id && n.direction === "UPWARD" && n.response,
      );
      const downward = allNotifications.find(
        (n) => n.recipientLinkId === link.id && n.direction === "DOWNWARD" && n.response,
      );
      directional[link.id] = {
        upward: upward?.response ?? null,
        downward: downward?.response ?? null,
      };
    }

    const pendingNotifications = allNotifications
      .filter((n) => n.recipientUserId === session.user.id && !n.response)
      .map((n) => ({
        id: n.id,
        type: n.type,
        direction: n.direction,
        triggeringLinkId: n.triggeringLinkId,
        createdAt: n.createdAt,
      }));

    return NextResponse.json({ chain, pendingNotifications, directional });
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
