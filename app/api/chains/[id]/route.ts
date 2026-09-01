import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getChainV2,
  deleteChain,
  upsertChainLink,
  deleteChainLink,
} from "@/lib/services/chains";
import { canViewChain } from "@/lib/chain/permissions";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/chains/[id] — fetch full chain with all links
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const chain = await getChainV2(id);
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allLinks = chain.links.map((l) => ({
    claimedByUserId: l.claimedByUserId,
    createdByUserId: l.createdByUserId,
  }));
  if (!canViewChain(allLinks, session.user.id, session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ chain });
}

// PATCH /api/chains/[id] — legacy: update chain name or bulk-update links
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const chain = await prisma.propertyChain.findUnique({
    where: { id },
    select: { agencyId: true },
  });
  if (!chain || chain.agencyId !== session.user.agencyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.links) {
    for (const link of body.links as Array<{
      id?: string;
      position: number;
      transactionId?: string | null;
      externalAddress?: string | null;
      externalStatus?: string | null;
      _delete?: boolean;
    }>) {
      if (link._delete && link.id) {
        await deleteChainLink(link.id);
      } else {
        await upsertChainLink(id, link.position, {
          transactionId: link.transactionId ?? null,
          externalAddress: link.externalAddress ?? null,
          externalStatus: link.externalStatus ?? null,
        });
      }
    }
  }

  if (body.name !== undefined) {
    await prisma.propertyChain.update({ where: { id }, data: { name: body.name } });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/chains/[id] — remove entire chain (legacy + v2)
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const chain = await getChainV2(id);
  if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the chain creator or an admin can delete
  if (chain.createdByUserId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteChain(id);
  return NextResponse.json({ ok: true });
}
