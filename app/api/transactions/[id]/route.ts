// app/api/transactions/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.propertyTransaction.findFirst({
    where: { id, agencyId: session.user.agencyId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const {
    notes,
    vendorSolicitorFirmId,
    vendorSolicitorContactId,
    purchaserSolicitorFirmId,
    purchaserSolicitorContactId,
    assignedUserId,
  } = body;

  const updated = await prisma.propertyTransaction.update({
    where: { id },
    data: {
      ...(notes !== undefined && { notes }),
      ...(vendorSolicitorFirmId !== undefined && { vendorSolicitorFirmId }),
      ...(vendorSolicitorContactId !== undefined && { vendorSolicitorContactId }),
      ...(purchaserSolicitorFirmId !== undefined && { purchaserSolicitorFirmId }),
      ...(purchaserSolicitorContactId !== undefined && { purchaserSolicitorContactId }),
      ...(assignedUserId !== undefined && { assignedUserId: assignedUserId || null }),
    },
  });

  return NextResponse.json(updated);
}
