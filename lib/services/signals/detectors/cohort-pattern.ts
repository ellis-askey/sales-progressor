// Detector: cohort_pattern
// Finds "users who do X are Nx more likely to retain" patterns.
// v1 tests one specific hypothesis: agencies that sent their first chase within
// 24h of signup retain better than those that didn't.
// Minimum N=20 in each group required (ADMIN_07 §5.3).
// The spec's example: "78% vs 31% retention" (ADMIN_07 §1).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const MIN_GROUP_SIZE = 20;
// "Active at week 4" = had any event in the 4th week after signup
const RETENTION_WEEKS = 4;

export const cohortPattern: Detector = async (window) => {
  // Agencies that signed up before the current window (give time to observe behaviour)
  const cohortCutoff = new Date(window.current.start);
  cohortCutoff.setUTCDate(cohortCutoff.getUTCDate() - RETENTION_WEEKS * 7);

  const signupStart = new Date(cohortCutoff);
  signupStart.setUTCDate(signupStart.getUTCDate() - 90); // agencies that signed up in last 90d before cutoff

  const allAgencies = await prisma.agency.findMany({
    where: { createdAt: { gte: signupStart, lt: cohortCutoff } },
    select: { id: true, createdAt: true },
  });

  if (allAgencies.length < MIN_GROUP_SIZE * 2) return [];

  // Group A: agencies that sent first chase within 24h
  const groupAIds: string[] = [];
  const groupBIds: string[] = [];

  for (const agency of allAgencies) {
    const first24hEnd = new Date(agency.createdAt);
    first24hEnd.setUTCDate(first24hEnd.getUTCDate() + 1);

    const chaseWithin24h = await prisma.event.findFirst({
      where: {
        agencyId: agency.id,
        type: "chase_sent",
        occurredAt: { gte: agency.createdAt, lt: first24hEnd },
      },
      select: { id: true },
    });

    if (chaseWithin24h) {
      groupAIds.push(agency.id);
    } else {
      groupBIds.push(agency.id);
    }
  }

  if (groupAIds.length < MIN_GROUP_SIZE || groupBIds.length < MIN_GROUP_SIZE) return [];

  // Retention: active at week 4 = had any event in [signup + 4w, signup + 5w]
  // Simplified: check if agency had any event in the 4-week post-signup window
  const retentionWindowWeeks = RETENTION_WEEKS;

  async function retentionRate(agencyIds: string[]): Promise<number> {
    let retained = 0;
    for (const id of agencyIds) {
      const agency = allAgencies.find((a) => a.id === id)!;
      const retStart = new Date(agency.createdAt);
      retStart.setUTCDate(retStart.getUTCDate() + retentionWindowWeeks * 7);
      const retEnd = new Date(retStart);
      retEnd.setUTCDate(retEnd.getUTCDate() + 7);

      const hasActivity = await prisma.event.findFirst({
        where: { agencyId: id, occurredAt: { gte: retStart, lt: retEnd } },
        select: { id: true },
      });
      if (hasActivity) retained++;
    }
    return retained / agencyIds.length;
  }

  const [rateA, rateB] = await Promise.all([
    retentionRate(groupAIds),
    retentionRate(groupBIds),
  ]);

  const lift = rateA - rateB;
  if (Math.abs(lift) < 0.10) return []; // less than 10pp difference — not interesting

  // Confidence based on group sizes and effect size
  const minN = Math.min(groupAIds.length, groupBIds.length);
  const confidence = Math.min(
    0.3 + (minN / 50) * 0.4 + Math.abs(lift) * 0.5,
    0.92
  );

  if (confidence < 0.2) return [];

  return [
    {
      detectorName: "cohort_pattern",
      dedupeKey: "cohort_pattern:first_chase_24h_retention",
      payload: {
        pattern: "first_chase_within_24h_predicts_retention",
        groupA: { label: "Sent first chase within 24h", n: groupAIds.length, retentionRate: Math.round(rateA * 100) },
        groupB: { label: "Did not", n: groupBIds.length, retentionRate: Math.round(rateB * 100) },
        liftPP: Math.round(lift * 100),
        retentionWeeks: RETENTION_WEEKS,
        cohortDays: 90,
      },
      confidence,
      severity: lift > 0 ? "opportunity" : "info",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    },
  ];
};
