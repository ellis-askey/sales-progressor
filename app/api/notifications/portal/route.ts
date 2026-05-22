import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const after = req.nextUrl.searchParams.get("after");
  const since = after ? new Date(after) : new Date(0);

  // Counts all portal-originated internal notes (confirms, expected-date
  // updates, chase notes) — all three event types include the "via the
  // client portal" marker phrase. Previously this required "confirmed" too,
  // which excluded set-date and leave-note signals.
  const count = await prisma.outboundMessage.count({
    where: {
      type: "internal_note",
      createdAt: { gt: since },
      content: { contains: "via the client portal" },
    },
  });

  return NextResponse.json({ count });
}
