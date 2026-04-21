// app/api/agency/users/route.ts
// GET: list users in the same agency (for assignment UI)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: {
      agencyId: session.user.agencyId,
      role: { in: ["progressor", "admin"] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
