import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "negotiator") {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { transactionId, message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  // Verify transaction belongs to this agent if provided
  if (transactionId) {
    const tx = await prisma.propertyTransaction.findFirst({
      where: { id: transactionId, agentUserId: session.user.id },
    });
    if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Find the agent's assigned progressor to assign the task to
  const agentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { progressorId: true, agencyId: true },
  });

  await prisma.manualTask.create({
    data: {
      agencyId: agentUser!.agencyId,
      transactionId: transactionId ?? null,
      title: message.trim(),
      isAgentRequest: true,
      assignedToId: agentUser?.progressorId ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
