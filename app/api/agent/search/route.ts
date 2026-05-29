import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { hasAdminPowers } from "@/lib/agent-session";
import { resolveAgentVisibility, resolveInternalVisibility } from "@/lib/services/agent";
import { prisma } from "@/lib/prisma";

export type AgentSearchResult = {
  transactions: { id: string; address: string; status: string }[];
  contacts:     { id: string; name: string; role: string; transactionId: string; address: string }[];
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
        transaction: { select: { propertyAddress: true } },
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
    contacts: contacts.map((c) => ({
      id: c.id, name: c.name, role: c.roleType,
      transactionId: c.propertyTransactionId, address: c.transaction.propertyAddress,
    })),
    solicitors: solicitors.map((s) => ({
      id: s.id, name: s.name,
      fileCount: s._count.vendorForTransactions + s._count.purchaserForTransactions,
    })),
  };

  return NextResponse.json(result);
}
