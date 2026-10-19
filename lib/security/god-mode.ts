// lib/security/god-mode.ts
//
// Founder "god mode". A superadmin (the platform operator) can open and act on
// ANY agency's file via the platform access scope (lib/security/access-scope.ts).
// This module is the INVISIBILITY + PRIVATE-LOG layer that makes those actions
// leave no trace the agency can see, while keeping a private record only the
// founder can read in the Command Centre.
//
// Decisions (2026-10-19, Ellis): agencies see nothing; a private god-log
// (adminAuditLog, Command-Centre-only) records what the founder changed so a
// mystery change can later be traced to him. "Unrecorded" means no trace of
// HIM — the effects (a confirmed milestone, a sent client email) still happen.
//
// The chokepoint is logActivity(): the agency-visible activity feed is the one
// place the founder's name (and name-in-text) would surface. When the actor is a
// platform operator we skip the agency-visible note entirely and write to the
// god-log instead. See lib/services/activity.ts.

import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hasSuperAdminPowers } from "@/lib/agent-session";

/** Is this session the founder operating as the platform god? */
export function isPlatformOperator(session: Session): boolean {
  return hasSuperAdminPowers(session);
}

// Process-lifetime cache of userId → "is a superadmin". Roles effectively never
// change in-flight, and the process recycles often on Vercel, so a plain Map is
// safe and keeps logActivity from re-querying the role on every call. We cache
// both true and false so normal agency users pay one PK lookup per process, once.
const superadminCache = new Map<string, boolean>();

/**
 * Does this actor's write need to be ghosted (hidden from the agency)? True only
 * for a genuine superadmin. Cheap: a cached PK lookup of the user's role. Returns
 * false for a null/unknown actor (system writes stay as they are).
 */
export async function isGhostActor(actorId: string | null | undefined): Promise<boolean> {
  if (!actorId) return false;
  const cached = superadminCache.get(actorId);
  if (cached !== undefined) return cached;
  const user = await prisma.user.findUnique({ where: { id: actorId }, select: { role: true } });
  const isSuper = user?.role === "superadmin";
  superadminCache.set(actorId, isSuper);
  return isSuper;
}

/**
 * Record a founder action in the private god-log (adminAuditLog — superadmin-only,
 * surfaced in the Command Centre audit view). Never throws into the caller: a
 * logging failure must not break the underlying action. Writes prisma directly
 * (not lib/command/*) so the agent-path import graph stays clean (Law 8).
 */
export async function recordGodAction(input: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
}): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: input.actorId,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        afterValue: input.detail != null ? ({ detail: input.detail } as object) : undefined,
        reason: "god-mode",
      },
    });
  } catch {
    // Swallow — the god-log is a convenience, not a correctness guarantee.
  }
}
