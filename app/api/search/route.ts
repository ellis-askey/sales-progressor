import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SearchResult = {
  transactions: { id: string; address: string; status: string; assignedName: string | null }[];
  contacts:     { id: string; name: string; role: string; transactionId: string; address: string }[];
  solicitors:   { id: string; name: string; fileCount: number }[];
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ transactions: [], contacts: [], solicitors: [] });

  const agencyId = session.user.agencyId;

  const [transactions, contacts, solicitors] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: {
        agencyId,
        propertyAddress: { contains: q, mode: "insensitive" },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        propertyAddress: true,
        status: true,
        assignedUser: { select: { name: true } },
      },
    }),

    prisma.contact.findMany({
      where: {
        transaction: { agencyId },
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        roleType: true,
        propertyTransactionId: true,
        transaction: { select: { propertyAddress: true } },
      },
    }),

    prisma.solicitorFirm.findMany({
      where: {
        agencyId,
        name: { contains: q, mode: "insensitive" },
      },
      take: 4,
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            vendorForTransactions: true,
            purchaserForTransactions: true,
          },
        },
      },
    }),
  ]);

  const result: SearchResult = {
    transactions: transactions.map((t) => ({
      id: t.id,
      address: t.propertyAddress,
      status: t.status,
      assignedName: t.assignedUser?.name ?? null,
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.roleType,
      transactionId: c.propertyTransactionId,
      address: c.transaction.propertyAddress,
    })),
    solicitors: solicitors.map((s) => ({
      id: s.id,
      name: s.name,
      fileCount: s._count.vendorForTransactions + s._count.purchaserForTransactions,
    })),
  };

  return NextResponse.json(result);
}
