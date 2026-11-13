import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";
import { getSignedUrlMap } from "@/lib/supabase-storage";

// Photos for the top-bar "Recently viewed" dropdown. The ids come from the
// viewer's own localStorage; this returns ONLY the files they can actually access
// (Law 7, via scopeTransactionWhere) with a freshly-signed photo URL — stored
// signed URLs would expire, so we re-sign on open. Address is returned too, so a
// renamed file shows its current name rather than the stale localStorage copy.
export async function GET(req: NextRequest) {
  const session = await requireSession();
  const scope = getAccessScope(session);

  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean).slice(0, 8);
  if (ids.length === 0) return NextResponse.json({ files: [] });

  const rows = await prisma.propertyTransaction.findMany({
    where: { ...scopeTransactionWhere(scope), id: { in: ids } },
    select: { id: true, propertyAddress: true, photoStoragePath: true },
  });
  const signed = await getSignedUrlMap(rows.map((r) => r.photoStoragePath));

  const files = rows.map((r) => ({
    id: r.id,
    address: r.propertyAddress,
    photoUrl: r.photoStoragePath ? signed.get(r.photoStoragePath) ?? null : null,
  }));
  return NextResponse.json({ files });
}
