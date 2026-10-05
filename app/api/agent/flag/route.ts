import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== "negotiator" && session.user.role !== "director")) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { transactionId, message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const agentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { progressorId: true, agencyId: true },
  });

  if (transactionId) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: { id: transactionId, agencyId: agentUser?.agencyId ?? undefined },
    });
    if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Resolve who a GENERAL (no-sale) note goes to. A file note rides its sale's
  // assignment; a general note must be addressed to a person, or it reaches nobody
  // (audit V1). progressorId covers TSP-outsourced agencies; an external-business
  // client agency routes its general note to the business owner.
  let assignedToId: string | null = agentUser?.progressorId ?? null;
  if (!transactionId && !assignedToId && agentUser?.agencyId) {
    const link = await prisma.progressionBusinessClient.findFirst({
      where: { agencyId: agentUser.agencyId, removedAt: null }, // live client links only (audit SP-polish)
      select: { progressionBusinessId: true },
    });
    if (link) {
      const owner = await prisma.user.findFirst({
        where: { progressionBusinessId: link.progressionBusinessId, progressionBusinessRole: "owner" },
        select: { id: true },
      });
      assignedToId = owner?.id ?? null;
    }
  }

  await prisma.manualTask.create({
    data: {
      agencyId: agentUser!.agencyId ?? "",
      transactionId: transactionId ?? null,
      title: message.trim(),
      isAgentRequest: true,
      assignedToId,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
