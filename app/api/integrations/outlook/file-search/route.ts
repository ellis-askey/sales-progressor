// GET /api/integrations/outlook/file-search?q=...
//
// Searches property files by address for the sync review UI (picking which file
// a missed email belongs to). Scoped to the caller's access scope (Law 7).

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";

export async function GET(req: Request) {
  const session = await requireSession();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const scope = getAccessScope(session);
  const rows = await prisma.propertyTransaction.findMany({
    where: {
      AND: [scopeTransactionWhere(scope), { propertyAddress: { contains: q, mode: "insensitive" } }],
    },
    select: { id: true, propertyAddress: true },
    orderBy: { lastActivityAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    results: rows.map((r) => ({ transactionId: r.id, address: r.propertyAddress })),
  });
}
