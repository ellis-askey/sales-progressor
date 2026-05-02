// Detector: source_performance
// Compares activation rates per signupSource vs the platform baseline.
// Fires when a source is outperforming or underperforming by 15pp+.
// Minimum N=10 conversions from source required (ADMIN_07 §5.3).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const MIN_SOURCE_SIGNUPS = 10;
const MIN_DELTA_PP = 15;

type SourceStats = {
  source: string;
  signups: number;
  activations: number;
  activationRate: number;
};

async function getSourceStats(start: Date, end: Date): Promise<{ baseline: number; sources: SourceStats[] }> {
  const agencies = await prisma.agency.findMany({
    where: { createdAt: { gte: start, lt: end }, signupSource: { not: null } },
    select: { id: true, signupSource: true },
  });

  if (agencies.length === 0) return { baseline: 0, sources: [] };

  // Check which agencies activated (created at least one transaction)
  const activatedIds = new Set<string>();
  const activated = await prisma.propertyTransaction.groupBy({
    by: ["agencyId"],
    where: { agencyId: { in: agencies.map((a) => a.id) } },
    _count: { id: true },
  });
  for (const r of activated) if (r.agencyId) activatedIds.add(r.agencyId);

  const baseline = agencies.length > 0 ? activatedIds.size / agencies.length : 0;

  // Group by source
  const sourceMap = new Map<string, { signups: number; activations: number }>();
  for (const agency of agencies) {
    const src = agency.signupSource ?? "unknown";
    const entry = sourceMap.get(src) ?? { signups: 0, activations: 0 };
    entry.signups++;
    if (activatedIds.has(agency.id)) entry.activations++;
    sourceMap.set(src, entry);
  }

  const sources: SourceStats[] = Array.from(sourceMap.entries())
    .filter(([, s]) => s.signups >= MIN_SOURCE_SIGNUPS)
    .map(([source, s]) => ({
      source,
      signups: s.signups,
      activations: s.activations,
      activationRate: s.activations / s.signups,
    }));

  return { baseline, sources };
}

export const sourcePerformance: Detector = async (window) => {
  // Use a longer window (the whole current+previous period) for more signal
  const { baseline, sources } = await getSourceStats(
    window.previous.start,
    window.current.end
  );

  if (sources.length === 0 || baseline === 0) return [];

  const signals: SignalResult[] = [];

  for (const src of sources) {
    const deltaPP = (src.activationRate - baseline) * 100;
    if (Math.abs(deltaPP) < MIN_DELTA_PP) continue;

    const confidence = Math.min(
      0.3 + (src.signups / 50) * 0.4 + (Math.abs(deltaPP) / 50) * 0.3,
      0.88
    );
    if (confidence < 0.2) continue;

    signals.push({
      detectorName: "source_performance",
      dedupeKey: `source_performance:${src.source}`,
      payload: {
        source: src.source,
        signups: src.signups,
        activations: src.activations,
        activationRate: Math.round(src.activationRate * 100),
        baselineRate: Math.round(baseline * 100),
        deltaPP: Math.round(deltaPP),
      },
      confidence,
      severity: deltaPP < -MIN_DELTA_PP ? "leak" : "opportunity",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    });
  }

  return signals;
};
