import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const after = req.nextUrl.searchParams.get("after");
  const since = after ? new Date(after) : new Date(0);

  const count = await prisma.communicationRecord.count({
    where: {
      type: "internal_note",
      createdAt: { gt: since },
      AND: [
        { content: { contains: "confirmed" } },
        { content: { contains: "via the client portal" } },
      ],
    },
  });

  return NextResponse.json({ count });
}
