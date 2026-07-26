// Kinetic Depth visual — rollout gate.
// Stage 1: internal roles only. Ellis + any SP staff see the new look before
// customer agencies. When Stage 1 is stable, widen this guard to add specific
// agency IDs. When every agency is on, delete this file and the old surfaces.

type SessionLike = {
  user: { role: string; agencyId: string | null };
};

// Roles that see the Kinetic hub in Stage 1.
const INTERNAL_ROLES = new Set(["admin", "superadmin", "sales_progressor"]);

// Stage 2 — populate with agency IDs to canary specific customer agencies.
// e.g. new Set(["cmou19l8j0000n4djh2enonr7"]) for Akeman.
const KINETIC_HUB_AGENCIES = new Set<string>([]);

export function shouldSeeKineticHub(session: SessionLike): boolean {
  if (INTERNAL_ROLES.has(session.user.role)) return true;
  if (session.user.agencyId && KINETIC_HUB_AGENCIES.has(session.user.agencyId)) return true;
  return false;
}

// Convenience for the shell — same gate for now. If we ever want to
// separate "shell dark override" from "hub redesign" we split here.
export const shouldSeeKineticShell = shouldSeeKineticHub;
