import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await requireSession();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { chainDeclineNotificationAddress: null, chainDeclineNotificationAt: null },
  });
  return NextResponse.json({ ok: true });
}
