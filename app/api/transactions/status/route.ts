// app/api/transactions/status/route.ts
// POST: update transaction status and write an activity entry.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TransactionStatus } from "@prisma/client";

const VALID_STATUSES: TransactionStatus[] = ["active", "on_hold", "completed", "withdrawn"];

const STATUS_LABELS: Record<TransactionStatus, string> = {
  draft: "Draft",
  active: "Active",
  on_hold: "On Hold",
  completed: "Completed",
  withdrawn: "Withdrawn",
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const { transactionId, status } = body;

  if (!transactionId || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const tx = await prisma.propertyTransaction.findFirst({
    where: { id: transactionId, agencyId: session.user.agencyId },
    select: { id: true, status: true },
  });
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  if (tx.status === status) {
    return NextResponse.json({ success: true });
  }

  await prisma.propertyTransaction.update({
    where: { id: transactionId },
    data: { status, lastActivityAt: new Date() },
  });

  await prisma.outboundMessage.create({
    data: {
      transactionId,
      type: "internal_note",
      contactIds: [],
      content: `${session.user.name} changed status from ${STATUS_LABELS[tx.status]} to ${STATUS_LABELS[status as TransactionStatus]}.`,
      createdById: session.user.id,
    },
  });

  console.log(`[AUDIT] transaction_status_changed transactionId=${transactionId} oldStatus=${tx.status} newStatus=${status} changedByUserId=${session.user.id} agencyId=${session.user.agencyId}`);
  return NextResponse.json({ success: true });
}
