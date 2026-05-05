// POST /api/claim
// Claims a chain link for the authenticated user.
// Body: { token: string; action: "create" | "link"; existingTransactionId?: string }
//
// "create" — creates a new PropertyTransaction from the stub, links it to the chain.
// "link"   — links an existing transaction the caller owns to the chain.
//
// Both branches run atomically. Returns { ok: true, transactionId }.

import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { token?: unknown; action?: unknown; existingTransactionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token, action, existingTransactionId } = body;

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }
  if (action !== "create" && action !== "link") {
    return NextResponse.json({ error: "action must be 'create' or 'link'" }, { status: 400 });
  }

  const link = await prisma.chainLink.findFirst({
    where: { inviteToken: token },
    select: {
      id: true,
      transactionId: true,
      inviteStatus: true,
      stubAgentEmail: true,
      stubPropertyAddress: true,
      chain: { select: { createdByUserId: true } },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }
  if (link.transactionId !== null || link.inviteStatus === "CLAIMED") {
    return NextResponse.json({ error: "This invite has already been claimed" }, { status: 409 });
  }

  // Email must match the stub
  const userEmail = session.user.email?.toLowerCase().trim();
  const stubEmail = link.stubAgentEmail?.toLowerCase().trim();
  if (!userEmail || !stubEmail || userEmail !== stubEmail) {
    return NextResponse.json(
      { error: "This invite was sent to a different email address" },
      { status: 403 },
    );
  }

  // Caller cannot be the originator
  if (link.chain.createdByUserId === session.user.id) {
    return NextResponse.json({ error: "You can't claim your own invite" }, { status: 403 });
  }

  const agencyId = session.user.agencyId;
  if (!agencyId) {
    return NextResponse.json(
      { error: "No agency associated with your account" },
      { status: 403 },
    );
  }

  if (action === "create") {
    const result = await prisma.$transaction(async (tx) => {
      const newTxn = await tx.propertyTransaction.create({
        data: {
          propertyAddress: link.stubPropertyAddress ?? "",
          agencyId,
          agentUserId: session.user.id,
          progressedBy: "agent",
          serviceType: "self_managed",
        },
      });

      await tx.chainLink.update({
        where: { id: link.id },
        data: {
          transactionId: newTxn.id,
          claimedByUserId: session.user.id,
          claimedAt: new Date(),
          inviteStatus: "CLAIMED",
        },
      });

      await tx.propertyTransaction.update({
        where: { id: newTxn.id },
        data: { chainLinkId: link.id },
      });

      return { transactionId: newTxn.id };
    });

    console.log(
      `[AUDIT] chain_link_claimed linkId=${link.id} userId=${session.user.id} action=create transactionId=${result.transactionId}`,
    );
    return NextResponse.json({ ok: true, transactionId: result.transactionId });
  }

  // action === "link"
  if (typeof existingTransactionId !== "string" || !existingTransactionId) {
    return NextResponse.json(
      { error: "existingTransactionId is required for link action" },
      { status: 400 },
    );
  }

  const existingTxn = await prisma.propertyTransaction.findFirst({
    where: { id: existingTransactionId, agencyId },
    select: { id: true, chainLinkId: true },
  });

  if (!existingTxn) {
    return NextResponse.json({ error: "Transaction not found or access denied" }, { status: 404 });
  }
  if (existingTxn.chainLinkId !== null) {
    return NextResponse.json(
      { error: "This transaction is already linked to a chain" },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.chainLink.update({
      where: { id: link.id },
      data: {
        transactionId: existingTransactionId,
        claimedByUserId: session.user.id,
        claimedAt: new Date(),
        inviteStatus: "CLAIMED",
      },
    });

    await tx.propertyTransaction.update({
      where: { id: existingTransactionId },
      data: { chainLinkId: link.id },
    });
  });

  console.log(
    `[AUDIT] chain_link_claimed linkId=${link.id} userId=${session.user.id} action=link transactionId=${existingTransactionId}`,
  );
  return NextResponse.json({ ok: true, transactionId: existingTransactionId });
}
