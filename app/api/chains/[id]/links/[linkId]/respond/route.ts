import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["REMARKETING", "WAITING"] as const;
type WithdrawalResponse = (typeof VALID_STATUSES)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> },
) {
  const session = await requireSession();
  const { id: chainId, linkId } = await params;

  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = body.status as WithdrawalResponse | undefined;
  if (!status || !VALID_STATUSES.includes(status as WithdrawalResponse)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const link = await prisma.chainLink.findFirst({
    where: { id: linkId, chainId },
    select: { id: true, claimedByUserId: true },
  });

  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (link.claimedByUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.chainLink.update({
    where: { id: linkId },
    data: { withdrawalStatus: status, withdrawalRespondedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
