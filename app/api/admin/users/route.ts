// app/api/admin/users/route.ts
// PATCH: update user clientType and legacyFee (admin only)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { userId, clientType, legacyFee } = await req.json();

  const user = await prisma.user.findFirst({
    where: { id: userId, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: userId },
    data: {
      clientType,
      legacyFee: clientType === "legacy" ? Math.round(parseFloat(legacyFee) * 100) : null,
    },
  });

  console.log(`[AUDIT] user_updated userId=${userId} fieldsChanged=clientType,legacyFee updatedByUserId=${session.user.id} agencyId=${session.user.agencyId}`);
  return NextResponse.json({ success: true });
}
