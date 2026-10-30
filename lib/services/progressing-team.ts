// "Same progressing team" test — the ownership rule behind the onward portal
// mirror (docs/active/onward-portal-mirror.md). Two chain-adjacent files count
// as run by the same team when:
//   - an external progression business runs both (same progressionBusinessId), OR
//   - both are TSP-outsourced (no business, serviceType "outsourced"), OR
//   - the same agency runs both (self-managed).
//
// This replaces the older agency-only check so the mirror is solid across all
// three service models — in-house, TSP, and progression-company (which can run
// files across different agencies). Pure (no DB) so it's unit-testable; the
// chain walk that feeds it lives in lib/services/onward.ts (resolveOwnOnwardFileId).

export type ProgressingTeamFacts = {
  agencyId: string | null;
  progressionBusinessId: string | null;
  // PropertyTransaction.serviceType — "self_managed" | "outsourced". Loosely
  // typed as string so this stays decoupled from the Prisma enum for testing.
  serviceType: string;
};

export function isSameProgressingTeam(a: ProgressingTeamFacts, b: ProgressingTeamFacts): boolean {
  // An external progression business owns the run. Only its OWN other files
  // count — a different business (even on the same agency) is a different team.
  if (a.progressionBusinessId || b.progressionBusinessId) {
    return a.progressionBusinessId != null && a.progressionBusinessId === b.progressionBusinessId;
  }
  // No external business → TSP-outsourced or self-managed.
  // Both outsourced (to TSP) = TSP's own team runs both, regardless of agency.
  if (a.serviceType === "outsourced" && b.serviceType === "outsourced") return true;
  // Otherwise self-managed: the same agency runs both.
  return a.agencyId != null && a.agencyId === b.agencyId;
}
