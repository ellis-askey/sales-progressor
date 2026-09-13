// Deterministic sample-feasibility (Build Order F). The strategist RECOMMENDS a
// sample size; it does NOT control feasibility. This computes the actual eligible
// population represented by a proposed target filter, using the same deterministic
// eligibility/suppression rules as the rest of the app, and reports whether the
// recommended design is currently feasible. It NEVER alters the proposal and NEVER
// invents prospects. The model sees none of this prospect-level data — only the
// resulting counts.

import { commandDb } from "@/lib/command/prisma";
import { SEGMENT_DIMENSIONS, segmentValue, type SegmentDimension } from "./segments";

export type SegmentFilter = { dimension: SegmentDimension; values: string[] };

export type Feasibility = {
  recommendedSample: number;
  eligiblePopulation: number;
  feasible: boolean;
  note: string;
};

function isSegmentDimension(v: unknown): v is SegmentDimension {
  return typeof v === "string" && (SEGMENT_DIMENSIONS as string[]).includes(v);
}

// Eligible = deterministic: not archived, not opted out, not bounced, not already
// converted, and has an email we could send to. (Suppression/eligibility live in
// application code; the model never overrides them.)
async function loadEligible() {
  return commandDb.prospect.findMany({
    where: {
      archivedAt: null,
      optedOutAt: null,
      bouncedAt: null,
      convertedAgencyId: null,
      OR: [{ generalEmail: { not: null } }, { contacts: { some: { email: { not: null } } } }],
    },
    select: { source: true, groupId: true, followUpCount: true, lastContactedAt: true, postcode: true },
  });
}

// Count eligible prospects matching the target filter minus any exclusion filters,
// using the SAME segment logic as metrics for consistency.
export async function computeFeasibility(args: {
  target: SegmentFilter | null;
  exclusions?: SegmentFilter[];
  recommendedSample: number;
}): Promise<Feasibility> {
  const rows = await loadEligible();

  const matchesFilter = (row: (typeof rows)[number], f: SegmentFilter): boolean =>
    f.values.includes(segmentValue(f.dimension, row));

  let pool = rows;
  if (args.target && isSegmentDimension(args.target.dimension) && args.target.values.length > 0) {
    pool = pool.filter((r) => matchesFilter(r, args.target as SegmentFilter));
  }
  for (const ex of args.exclusions ?? []) {
    if (isSegmentDimension(ex.dimension) && ex.values.length > 0) {
      pool = pool.filter((r) => !matchesFilter(r, ex));
    }
  }

  const eligiblePopulation = pool.length;
  const recommendedSample = Math.max(0, Math.round(args.recommendedSample || 0));
  const feasible = eligiblePopulation > 0 && eligiblePopulation >= recommendedSample;
  const note = feasible
    ? `${eligiblePopulation} eligible prospects match the target; the recommended sample of ${recommendedSample} is feasible.`
    : eligiblePopulation === 0
      ? "No eligible prospects match this target filter right now."
      : `Only ${eligiblePopulation} eligible prospects match the target, fewer than the recommended sample of ${recommendedSample}. Needs human review; the proposal was not altered and no prospects were invented.`;

  return { recommendedSample, eligiblePopulation, feasible, note };
}
