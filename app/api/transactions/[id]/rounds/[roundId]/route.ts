// GET /api/transactions/[id]/rounds/[roundId]
//
// Returns the archived-round payload for the drawer in
// components/transaction/ArchivedRoundDrawer.tsx. Read-only.
//
// Auth: NextAuth session + access-scope ownership check. The fetcher
// returns null on access miss; the route surfaces 404 (not 403) so
// no cross-tx leakage signal is emitted.

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeOwnershipWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { getArchivedRoundData, getFileLevelDocumentsForArchive } from "@/lib/services/archived-round";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; roundId: string }> },
) {
  const session = await requireSession();
  const scope = getAccessScope(session);
  const { id, roundId } = await ctx.params;

  // Ownership check via the same scope helper every other agent route
  // uses. Missing → 404 (not 403), matches the existing pattern.
  const tx = await prisma.propertyTransaction.findFirst({
    where: scopeOwnershipWhere(scope, id),
    select: { id: true },
  });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await getArchivedRoundData(id, roundId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const fileDocuments = await getFileLevelDocumentsForArchive(id, roundId);

  return NextResponse.json({
    ...data,
    fileDocuments,
  });
}
