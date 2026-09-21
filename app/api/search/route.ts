import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import { phoneMatchContactIds } from "@/lib/services/contact-search";

/** Name / phone lookup clauses for a Contact search. Phone matching is
 *  format-agnostic: `phoneIds` are pre-resolved by phoneMatchContactIds (which
 *  strips non-digits from both sides so stored spacing never breaks a match),
 *  and folded in here as an id filter. */
function contactSearchClauses(q: string, phoneIds: string[]): Prisma.ContactWhereInput[] {
  const clauses: Prisma.ContactWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
  ];
  if (phoneIds.length > 0) clauses.push({ id: { in: phoneIds } });
  return clauses;
}

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

  const scope = getAccessScope(session);
  const txScopeWhere = scopeTransactionWhere(scope);

  // Internal scopes (sales_progressor, admin, superadmin) should not see
  // agents' draft transactions in search results: drafts are an agent's
  // work-in-progress and create noise on internal surfaces. Agency scopes
  // (director, negotiator, viewer) keep current behaviour so an agent can
  // still find their own draft to resume.
  const hideDrafts = scope.kind !== "agency";
  const draftFilter: Prisma.PropertyTransactionWhereInput =
    hideDrafts ? { status: { not: "draft" } } : {};

  const phoneIds = await phoneMatchContactIds(q);

  const [transactions, contacts, solicitors] = await Promise.all([
    prisma.propertyTransaction.findMany({
      where: {
        ...txScopeWhere,
        ...draftFilter,
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
        transaction: { ...txScopeWhere, ...draftFilter },
        OR: contactSearchClauses(q, phoneIds),
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
      where: { name: { contains: q, mode: "insensitive" } },
      take: 4,
      select: {
        id: true,
        name: true,
        // Scope the counts to what the caller can see (Law 7). Unscoped, this
        // leaked how many files a firm handles platform-wide across agencies.
        _count: {
          select: {
            vendorForTransactions: { where: txScopeWhere },
            purchaserForTransactions: { where: txScopeWhere },
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
