import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { getAccessScope, scopeTransactionWhere } from "@/lib/security/access-scope";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Auth + tenant scope (Law 7): this used to run unauthenticated and count
  // portal notes across the WHOLE platform. Now it requires a session and only
  // counts notes on files the caller can actually see — their agency's files
  // (director/negotiator), their assigned files (sales_progressor), or all
  // files (admin/superadmin).
  const session = await requireSession();
  const scope = getAccessScope(session);

  const after = req.nextUrl.searchParams.get("after");
  const since = after ? new Date(after) : new Date(0);

  // Counts all portal-originated internal notes (confirms, expected-date
  // updates, chase notes) — all three event types include the "via the
  // client portal" marker phrase.
  const count = await prisma.outboundMessage.count({
    where: {
      type: "internal_note",
      createdAt: { gt: since },
      content: { contains: "via the client portal" },
      transaction: scopeTransactionWhere(scope),
    },
  });

  return NextResponse.json({ count });
}
