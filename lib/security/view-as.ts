// lib/security/view-as.ts
//
// Founder "view as" (Tier 4) — LOOK-ONLY. A superadmin picks an agent and sees
// the agent app exactly as that agent sees it (their hub, their file list, their
// counts). It is hard read-only: middleware blocks every mutation while a
// view-as session is active, so the founder can never act AS the agent (acting
// on files is done separately via god mode, as themselves/invisibly).
//
// Mechanism, deliberately simple and safe:
//   - A httpOnly cookie (VIEW_AS_COOKIE) holds the TARGET userId. It is only ever
//     set by startViewAsAction, which is superadmin-gated.
//   - requireSession() swaps the session's user to the target ONLY when the REAL
//     session is a superadmin AND the cookie is present. Double-gated: a stray or
//     copied cookie does nothing for a non-superadmin (the real role isn't super).
//     No signing needed — the security gate is "real session is superadmin", and
//     a superadmin impersonating any agent is within their authority anyway.
//   - Middleware blocks mutation methods whenever the cookie is present, so the
//     read-only guarantee is enforced at the edge, not just by convention.

import { cookies } from "next/headers";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hasSuperAdminPowers } from "@/lib/agent-session";

export const VIEW_AS_COOKIE = "sp_view_as";
// A short leash — the founder is dropping in to look, not living as the agent.
export const VIEW_AS_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours

/**
 * If the real session is a superadmin AND a view-as cookie names a real target
 * user, return a session whose `user` is that target (with `viewAsOperatorId`
 * set to the real operator). Otherwise return the real session untouched.
 *
 * Called inside requireSession(), so every downstream read (getAccessScope,
 * file-page-context, lists) automatically reflects the target. Writes are
 * independently blocked by middleware while the cookie is present.
 */
export async function applyViewAs(realSession: Session): Promise<Session> {
  if (!hasSuperAdminPowers(realSession)) return realSession;

  const targetId = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!targetId) return realSession;

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: {
      id: true, name: true, email: true, role: true, agencyId: true, firmName: true,
      progressionBusinessId: true, progressionBusinessRole: true, canViewAllFiles: true,
    },
  });
  if (!target) return realSession;

  return {
    ...realSession,
    user: {
      ...realSession.user,
      id: target.id,
      name: target.name ?? "",
      email: target.email,
      role: target.role,
      agencyId: target.agencyId ?? "",
      firmName: target.firmName ?? null,
      needsSignupCompletion: false,
      progressionBusinessId: target.progressionBusinessId ?? null,
      progressionBusinessRole: target.progressionBusinessRole ?? null,
      canViewAllFiles: target.canViewAllFiles ?? false,
      viewAsOperatorId: realSession.user.id,
    },
  };
}
