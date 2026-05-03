// app/api/agency/users/route.ts
// GET: list users for assignment UI.
// Admin/superadmin: returns all sales_progressor users (cross-agency, for the assignment dropdown).
// Agency users: returns users in their agency only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const isAdmin = session.user.role === "admin" || session.user.role === "superadmin";

  const users = isAdmin
    ? await prisma.user.findMany({
        where: { role: "sales_progressor" },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : await prisma.user.findMany({
        where: {
          agencyId: session.user.agencyId,
          role: { in: ["sales_progressor", "admin"] },
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      });

  return NextResponse.json(users);
}
