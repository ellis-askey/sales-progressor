import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteChain, upsertChainLink, deleteChainLink } from "@/lib/services/chains";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  await deleteChain(id);
  return NextResponse.json({ ok: true });
}
