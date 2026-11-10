// Trial registry for the Command Centre trial cockpit (/command/trials/[slug]).
// Superadmin-only (Law 8) — resolved against commandDb.
//
// There is no "trial" concept in the schema (Agency carries no trialEndsAt /
// plan field — the old 14-day onboarding trial was removed), so the cockpit
// defines its trials here: a small code registry, one entry per key agency
// on a commercial trial. Agencies are resolved by NAME at runtime (exact
// match first, then contains) so the same config works on staging and prod,
// whose agency ids differ. If a trial ever needs editing from the UI, this
// registry is the seam to move into a table.

import { commandDb } from "@/lib/command/prisma";

export interface TrialConfig {
  slug: string;        // URL segment: /command/trials/<slug>
  agencyName: string;  // exact Agency.name to resolve against
  nameHint: string;    // distinctive fragment for the contains fallback
  label: string;       // display name for the cockpit header
  startsAt: string;    // ISO date, inclusive (UK)
  endsAt: string;      // ISO date, inclusive
  staffTarget: number | null; // expected headcount, for "X of N aboard"
}

export const TRIALS: TrialConfig[] = [
  {
    slug: "boardwalk",
    agencyName: "Boardwalk Property Co",
    nameHint: "Boardwalk",
    label: "Boardwalk Property Co",
    startsAt: "2026-11-10",
    endsAt: "2027-05-10",
    staffTarget: 27,
  },
];

export function getTrialConfig(slug: string): TrialConfig | null {
  return TRIALS.find((t) => t.slug === slug) ?? null;
}

export interface TrialClock {
  startsAt: Date;
  endsAt: Date;
  totalDays: number;
  dayNumber: number;   // 1-based, clamped into [1, totalDays]
  daysLeft: number;    // clamped at 0
  pctThrough: number;  // 0-100
  started: boolean;
  ended: boolean;
}

const DAY_MS = 86_400_000;

export function trialClock(trial: TrialConfig, now: Date = new Date()): TrialClock {
  const startsAt = new Date(`${trial.startsAt}T00:00:00`);
  const endsAt = new Date(`${trial.endsAt}T23:59:59.999`);
  const totalDays = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / DAY_MS));
  const rawDay = Math.floor((now.getTime() - startsAt.getTime()) / DAY_MS) + 1;
  const dayNumber = Math.min(Math.max(rawDay, 1), totalDays);
  const daysLeft = Math.max(0, totalDays - dayNumber);
  return {
    startsAt,
    endsAt,
    totalDays,
    dayNumber,
    daysLeft,
    pctThrough: Math.min(100, Math.max(0, Math.round((dayNumber / totalDays) * 100))),
    started: now >= startsAt,
    ended: now > endsAt,
  };
}

// Resolve the trial's agency row. Exact name first; a contains fallback keeps
// the cockpit working if the agency renames itself slightly (e.g. suffix
// changes). Internal agencies never match.
export async function resolveTrialAgency(
  trial: TrialConfig,
): Promise<{ id: string; name: string; createdAt: Date } | null> {
  const exact = await commandDb.agency.findFirst({
    where: { name: trial.agencyName, isInternal: false },
    select: { id: true, name: true, createdAt: true },
  });
  if (exact) return exact;
  return commandDb.agency.findFirst({
    where: { name: { contains: trial.nameHint, mode: "insensitive" }, isInternal: false },
    select: { id: true, name: true, createdAt: true },
  });
}
