import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { prisma } from "@/lib/prisma";

export type AgentSearchResult = {
  transactions: { id: string; address: string; status: string }[];
  contacts:     {
    id: string;
    name: string;
    role: string;
    transactionId: string;
    address: string;
    // Phase-2 PR 1 (GAP-4): purchaser-role contacts whose buyerRoundId
    // doesn't match the transaction's activeBuyerRoundId belong to a
    // previous (fell-through) sale. The row is still returned so the agent
    // can find them, but the frontend renders the row muted with a
    // "previous sale" sub-line. null = current/active contact.
    previousSale: { roundNumber: number } | null;
  }[];
  solicitors:   { id: string; name: string; fileCount: number }[];
};

const INTERNAL_ROLES = ["admin", "superadmin", "sales_progressor"];

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ transactions: [], contacts: [], solicitors: [] });

  const isInternal = INTERNAL_ROLES.includes(session.user.role ?? "");
  const vis = isInternal
    ? resolveInternalVisibility(session.user.id, session.user.role ?? "", hasAdminPowers(session))
    : await resolveAgentVisibility(session.user.id, session.user.agencyId);

  let txWhere: Record<string, unknown>;
  if (vis.internalMode === "admin_all") {
    txWhere = {};
  } else if (vis.internalMode === "assigned") {
    txWhere = { assignedUserId: vis.userId };
  } else if (vis.seeAll) {
    txWhere = vis.firmName
      ? { agencyId: vis.agencyId, agentUser: { firmName: vis.firmName } }
      : { agencyId: vis.agencyId };
  } else {
    txWhere = { agencyId: vis.agencyId, agentUserId: vis.userId };
  }

  // Internal staff should not see agents' in-progress drafts in global search
  // (clutters results with files the agent hasn't committed yet). Agents still
  // see their own drafts so they can resume mid-creation.
  if (isInternal) {
    txWhere.status = { not: "draft" };
  }

  const [transactions, contacts, solicitors] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: { ...txWhere, propertyAddress: { contains: q, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, propertyAddress: true, status: true },
    }),
    prisma.contact.findMany({
      where: {
        transaction: txWhere,
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, name: true, roleType: true, propertyTransactionId: true,
        // Phase-2 PR 1 (GAP-4): pull the contact's buyerRound + the
        // transaction's active round so we can label previous-round
        // purchaser contacts on the frontend.
        buyerRoundId: true,
        buyerRound: { select: { roundNumber: true } },
        transaction: { select: { propertyAddress: true, activeBuyerRoundId: true } },
      },
    }),
    prisma.solicitorFirm.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: 4,
      select: {
        id: true, name: true,
        _count: { select: { vendorForTransactions: true, purchaserForTransactions: true } },
      },
    }),
  ]);

  const result: AgentSearchResult = {
    transactions: transactions.map((t) => ({ id: t.id, address: t.propertyAddress, status: t.status })),
    contacts: contacts.map((c) => {
      // GAP-4 labelling: a purchaser contact with a buyerRoundId that
      // doesn't match the transaction's activeBuyerRoundId belongs to a
      // fall-through sale. Non-purchaser roles (vendor / solicitor /
      // broker) are file-level by design — always treated as current.
      const isPreviousPurchaser =
        c.roleType === "purchaser" &&
        c.buyerRoundId !== null &&
        c.buyerRoundId !== c.transaction.activeBuyerRoundId;
      return {
        id: c.id,
        name: c.name,
        role: c.roleType,
        transactionId: c.propertyTransactionId,
        address: c.transaction.propertyAddress,
        previousSale: isPreviousPurchaser && c.buyerRound
          ? { roundNumber: c.buyerRound.roundNumber }
          : null,
      };
    }),
    solicitors: solicitors.map((s) => ({
      id: s.id, name: s.name,
      fileCount: s._count.vendorForTransactions + s._count.purchaserForTransactions,
    })),
  };

  return NextResponse.json(result);
}
