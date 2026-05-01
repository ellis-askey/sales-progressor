import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { token, rating, comment } = await req.json();

  if (!token || typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    select: { id: true, propertyTransactionId: true },
  });

  if (!contact) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const content = comment?.trim()
    ? `Survey response ${stars} (${rating}/5): ${comment.trim()}`
    : `Survey response ${stars} (${rating}/5 — no comment)`;

  await prisma.outboundMessage.create({
    data: {
      transactionId: contact.propertyTransactionId,
      type: "inbound",
      contactIds: [contact.id],
      content,
    },
  });

  return NextResponse.json({ ok: true });
}
