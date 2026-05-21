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
import { initializeMilestoneCompletions } from "@/lib/services/milestones";
import { reconcileClaimMilestonesAction } from "@/app/actions/milestones";
import type { Tenure, PurchaseType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    token?: unknown;
    action?: unknown;
    existingTransactionId?: unknown;
    tenure?: unknown;
    purchaseType?: unknown;
    isShareOfFreehold?: unknown;
    reconciliationMode?: unknown;
    reconciledMilestones?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    token,
    action,
    existingTransactionId,
    tenure,
    purchaseType,
    isShareOfFreehold,
    reconciliationMode,
    reconciledMilestones,
  } = body;

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
      inviteTokenExpiresAt: true,
      stubAgentEmail: true,
      stubPropertyAddress: true,
      chain: {
        select: {
          createdByUserId: true,
          links: {
            select: {
              withdrawalStatus: true,
              transaction: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }
  if (link.transactionId !== null || link.inviteStatus === "CLAIMED") {
    return NextResponse.json({ error: "This invite has already been claimed" }, { status: 409 });
  }
  if (link.inviteTokenExpiresAt && link.inviteTokenExpiresAt < new Date()) {
    return NextResponse.json({ error: "This invite link has expired" }, { status: 410 });
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

  // Race-safety: check for withdrawn chain between page load and submit
  const chainBroken = link.chain.links.some(
    (cl) => cl.transaction?.status === "withdrawn" || cl.withdrawalStatus === "WITHDRAWN",
  );
  if (chainBroken) {
    return NextResponse.json(
      {
        error:
          "This chain has changed — a sale in it has withdrawn. Ask the inviting agent to send a fresh invite once they've sorted out their chain.",
      },
      { status: 409 },
    );
  }

  if (action === "create") {
    const VALID_TENURES: Tenure[] = ["freehold", "leasehold"];
    const VALID_PURCHASE_TYPES: PurchaseType[] = ["mortgage", "cash_buyer", "cash_from_proceeds"];
    if (!tenure || !VALID_TENURES.includes(tenure as Tenure)) {
      return NextResponse.json({ error: "tenure is required (freehold or leasehold)" }, { status: 400 });
    }
    if (!purchaseType || !VALID_PURCHASE_TYPES.includes(purchaseType as PurchaseType)) {
      return NextResponse.json({ error: "purchaseType is required (mortgage, cash_buyer, or cash_from_proceeds)" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newTxn = await tx.propertyTransaction.create({
        data: {
          propertyAddress: link.stubPropertyAddress ?? "",
          agencyId,
          agentUserId: session.user.id,
          progressedBy: "agent",
          serviceType: "self_managed",
          tenure: tenure as Tenure,
          purchaseType: purchaseType as PurchaseType,
          isShareOfFreehold: isShareOfFreehold === true,
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

    // Initialize milestone completions outside the transaction (uses global prisma client)
    await initializeMilestoneCompletions(
      result.transactionId,
      tenure as Tenure,
      purchaseType as PurchaseType,
      session.user.id,
    );

    // Apply claim-time reconciliation if agent selected "Already in progress" on the
    // claim form. Best-effort: if reconciliation fails, the claim still succeeds and
    // the agent lands on the file with whatever was applied (per Stage 1 design — not
    // fatal). reconciledMilestones is an array of { milestoneDefinitionId, eventDate? }.
    if (
      reconciliationMode === "in_progress" &&
      Array.isArray(reconciledMilestones) &&
      reconciledMilestones.length > 0
    ) {
      try {
        const completions = (reconciledMilestones as Array<{ milestoneDefinitionId?: unknown; eventDate?: unknown }>)
          .filter((c) => typeof c.milestoneDefinitionId === "string" && c.milestoneDefinitionId)
          .map((c) => ({
            milestoneDefinitionId: c.milestoneDefinitionId as string,
            eventDate: typeof c.eventDate === "string" && c.eventDate ? c.eventDate : null,
          }));
        if (completions.length > 0) {
          const reconciled = await reconcileClaimMilestonesAction({
            transactionId: result.transactionId,
            completions,
          });
          console.log(
            `[AUDIT] reconcile_at_claim transactionId=${result.transactionId} requested=${completions.length} applied=${reconciled.applied}`,
          );
        }
      } catch (err) {
        // Don't fail the claim — log and continue.
        console.error(
          `[reconcile_at_claim] failed for tx ${result.transactionId}:`,
          err,
        );
      }
    }

    console.log(
      `[AUDIT] chain_link_claimed linkId=${link.id} userId=${session.user.id} action=create transactionId=${result.transactionId} reconciliationMode=${typeof reconciliationMode === "string" ? reconciliationMode : "none"}`,
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
