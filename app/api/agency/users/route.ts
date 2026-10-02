// app/api/agency/users/route.ts
// GET: list users for the assignment dropdown.
// Admin/superadmin: all sales_progressor users (cross-agency).
// External progression-business OWNER: only their own business's members.
// Agency users: users in their agency only.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const isAdmin = hasAdminPowers(session);

  // Any member of an EXTERNAL progression business (owner or not) only ever sees
  // their own business's members in the assignment picker. Scoped strictly to
  // progressionBusinessId so no other business's users — and no TSP staff — can
  // leak in. Previously a non-admin progressor (agencyId = null) hit the agency
  // branch below and filtered on `agencyId: null`, mis-matching a cross-business
  // mix of users. Strictly TSP-safe: a TSP user (isTsp business, or null) does not
  // match the external-business condition and keeps the existing agency branch.
  const me = !isAdmin && progressionBusinessesEnabled()
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { progressionBusinessId: true, progressionBusiness: { select: { isTsp: true } } },
      })
    : null;
  const externalBusinessId =
    me?.progressionBusinessId && me.progressionBusiness && !me.progressionBusiness.isTsp
      ? me.progressionBusinessId
      : null;

  const users = isAdmin
    ? await prisma.user.findMany({
        where: { role: "sales_progressor" },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : externalBusinessId
      ? await prisma.user.findMany({
          where: { progressionBusinessId: externalBusinessId },
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
