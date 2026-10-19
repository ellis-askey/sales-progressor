"use server";

// Founder "view as" controls (Tier 4, look-only). startViewAsAction is gated on
// the REAL session (read via getServerSession, NOT requireSession — the latter
// would already be swapped to the target while a view-as is active). Both set/
// clear the httpOnly cookie that lib/security/view-as.ts reads. The view is hard
// read-only (middleware blocks mutations while the cookie is present).

import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasSuperAdminPowers } from "@/lib/agent-session";
import { prisma } from "@/lib/prisma";
import { recordGodAction } from "@/lib/security/god-mode";
import { VIEW_AS_COOKIE, VIEW_AS_MAX_AGE_SECONDS } from "@/lib/security/view-as";

export async function startViewAsAction(targetUserId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !hasSuperAdminPowers(session)) {
    throw new Error("Not permitted");
  }

  // Only look through a customer-agency agent's eyes. Impersonating another
  // internal/superadmin account is pointless and avoids odd nested states.
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("User not found");
  if (!["director", "negotiator", "viewer"].includes(target.role)) {
    throw new Error("You can only view as an agency user");
  }

  (await cookies()).set(VIEW_AS_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: VIEW_AS_MAX_AGE_SECONDS,
    path: "/",
  });

  await recordGodAction({
    actorId: session.user.id,
    action: "view_as_start",
    targetType: "user",
    targetId: target.id,
  });

  redirect("/agent/hub");
}

// NOTE: stopping view-as is a GET route (app/api/view-as/stop) rather than a
// server action — while the cookie is present every POST is blocked at the edge,
// which would trap the operator. A GET exit is never blocked.
