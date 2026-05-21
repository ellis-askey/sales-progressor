// Milestone slowness signals — surfaces the existing MILESTONE_DURATION_MEDIANS
// data as per-row "X days slower than typical" badges on the agent file detail.
//
// Why this lives here:
//   - The data exists in lib/services/fees.ts but is only consumed by the
//     phase-aware exchange forecast. The medians are also useful as a per-
//     milestone yardstick.
//
// Approximation note (v1):
//   - There's no recorded "became available" timestamp on MilestoneCompletion.
//   - Proxy used: the latest completedAt across the milestone's DIRECT
//     prerequisites (the moment its predecessor chain finished). When the
//     milestone has no prerequisites (VM1, VM2, PM1, PM2) the proxy is null
//     and no signal is produced. Some genuinely-stale early milestones won't
//     get flagged — accepted v1 limitation per Ellis (better than false
//     badges on day-1 onboarding rows).
//
// Threshold: > 1.5× the median (50% over) before any badge fires.

import { MILESTONE_DURATION_MEDIANS } from "@/lib/services/fees";
import { DIRECT_PREREQUISITES } from "@/lib/milestone-prerequisites";

// Hardcoded estimates aren't data. The slowness badge stays hidden until
// the medians-ready email (lib/email/medians-ready.ts / cron) fires
// (~50+ completed files) AND MILESTONE_DURATION_MEDIANS in fees.ts has
// been swapped for learned values. Flip to true at that point — the
// badge wiring stays in place and re-activates platform-wide.
// See: docs/active/ELLIS_MANUAL_TODO.md for the manual switch-flip step.
export const MEDIANS_READY = false;

const SLOWNESS_THRESHOLD = 1.5;
const DAY_MS = 86_400_000;

export type SlownessSignal = {
  slow: true;
  daysOver: number;
  median: number;
  daysAvailable: number;
};

// Lookup of milestone-code → completion date (Date | null). Caller builds
// this once per render from the milestones it has, then probes it per row.
export type CompletionLookup = Map<string, Date | null>;

export function buildCompletionLookup(
  milestones: { code: string; isComplete: boolean; completion: { completedAt: Date | null } | null }[],
): CompletionLookup {
  const m: CompletionLookup = new Map();
  for (const ms of milestones) {
    if (ms.isComplete && ms.completion?.completedAt) {
      m.set(ms.code, ms.completion.completedAt);
    }
  }
  return m;
}

// Latest completedAt across the milestone's direct prerequisites. Null when
// any prereq is unknown to the lookup OR when the milestone has no prereqs.
function latestPrerequisiteCompletion(code: string, lookup: CompletionLookup): Date | null {
  const prereqs = DIRECT_PREREQUISITES[code];
  if (!prereqs || prereqs.length === 0) return null;

  let latest: Date | null = null;
  for (const p of prereqs) {
    const completedAt = lookup.get(p);
    if (!completedAt) return null; // any unknown / not-yet-complete prereq → bail
    if (!latest || completedAt.getTime() > latest.getTime()) latest = completedAt;
  }
  return latest;
}

// Compute the slowness signal for ONE milestone row. Null = no badge.
// Caller should only invoke this for milestones that are currently
// available + not complete + not not_required; this helper does not gate
// on row state (keeps it pure).
export function computeSlowness(
  code: string,
  lookup: CompletionLookup,
  now: Date = new Date(),
): SlownessSignal | null {
  const median = MILESTONE_DURATION_MEDIANS[code];
  if (median == null || median <= 0) return null;

  const becameAvailableAt = latestPrerequisiteCompletion(code, lookup);
  if (!becameAvailableAt) return null; // null proxy → no badge (v1 limitation)

  const daysAvailable = Math.floor((now.getTime() - becameAvailableAt.getTime()) / DAY_MS);
  if (daysAvailable <= 0) return null;
  if (daysAvailable < median * SLOWNESS_THRESHOLD) return null;

  return {
    slow: true,
    daysOver: daysAvailable - median,
    median,
    daysAvailable,
  };
}

// ─── Staleness signal (Change 5 of the visibility-pass) ──────────────────────
//
// Unlike the slowness signal, this DOES NOT compare to learned medians —
// the threshold is ReminderRule.graceDays, the same configured value the
// reminder engine uses to decide when to start chasing. The badge says
// "this has been sitting longer than the chase rule allows", which is a
// fact derived from config Ellis already set, not an inference from data
// we don't have. Safe to show without MEDIANS_READY.
//
// Returns null when:
//   - graceDays for this code is unknown (no active ReminderRule with
//     targetMilestoneCode === code)
//   - the becameAvailableAt proxy is null (no prereqs known, same
//     limitation as the slowness signal)
//   - daysAvailable <= graceDays (still within the chase rule's grace
//     window — not yet overdue)

export type StalenessSignal = {
  stale: true;
  daysAwaiting: number; // days since the milestone became available
  graceDays: number;    // threshold sourced from ReminderRule.graceDays
};

export function computeStaleness(
  code: string,
  lookup: CompletionLookup,
  graceDays: number | null | undefined,
  now: Date = new Date(),
): StalenessSignal | null {
  if (graceDays == null || graceDays < 0) return null;

  const becameAvailableAt = latestPrerequisiteCompletion(code, lookup);
  if (!becameAvailableAt) return null;

  const daysAwaiting = Math.floor((now.getTime() - becameAvailableAt.getTime()) / DAY_MS);
  if (daysAwaiting <= graceDays) return null;

  return { stale: true, daysAwaiting, graceDays };
}
