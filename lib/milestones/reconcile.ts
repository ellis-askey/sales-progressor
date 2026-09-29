// Pure decision behind the milestone unlock self-heal.
// See docs/active/milestone-unlock-selfheal.
//
// A milestone's locked/available status is a CACHED field. It only flips
// locked → available via unlockDirectDependents as a post-completion side effect.
// If that cascade is ever missed (a swallowed failure, a concurrent-write skip, or
// a completion written outside the normal path — seed/back-fill/repair), the
// dependent step is stranded "locked" forever with nothing to recompute it. This
// module is the belt-and-braces: given the in-scope completion states, work out
// which locked steps should actually be available. DB-free so it's unit-testable.

import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";

// Codes whose availability is NOT governed by the plain direct-prerequisite rule
// and must never be auto-flipped by the reconcile: the exchange-ready gates
// (VM18 / PM25, unlocked by same-side blocksExchange completion) and the bilateral
// exchange / completion pairs (VM19 / PM26, VM20 / PM27 — agent-orchestrated).
export const RECONCILE_EXCLUDE: ReadonlySet<string> = new Set([
  "VM18", "PM25", "VM19", "PM26", "VM20", "PM27",
]);

// Given a milestone code → its current in-scope state, return the LOCKED codes
// whose direct prerequisites are all complete/not_required and which therefore
// should be available. Never returns an excluded gate/bilateral code, a code with
// no prerequisites (its lock isn't prerequisite-driven), or one whose prerequisite
// state isn't known to be satisfied. Deterministic and idempotent.
export function computeReconcileUnlocks(stateByCode: Map<string, string>): string[] {
  const satisfied = (code: string): boolean => {
    const s = stateByCode.get(code);
    return s === "complete" || s === "not_required";
  };
  const out: string[] = [];
  for (const [code, state] of stateByCode) {
    if (state !== "locked" || RECONCILE_EXCLUDE.has(code)) continue;
    const prereqs = DIRECT_PREREQUISITES[code] ?? [];
    if (prereqs.length === 0) continue;
    if (prereqs.every(satisfied)) out.push(code);
  }
  return out;
}
