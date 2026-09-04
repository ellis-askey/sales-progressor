// Detector: silent_agency
// Agencies that were active once (they have events) but have generated no Event
// for more than STUCK_DAYS — whether or not they still have a live file. This
// catches the drift-away case: an agency that signed up, ran a sale that has
// since completed or fallen through, then went quiet with nothing live. (It used
// to require a live transaction, so those exact agencies slipped through.)
// Confidence = 1.0 — it's a fact, not an inference (ADMIN_07 §5.1).
// Silence threshold: 14 days (confirmed by founder, plan approval).
// Runs on the time-sensitive 5-min cadence as well as nightly.

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";
import { internalAgencyFilter } from "@/lib/security/internal-accounts";

const STUCK_DAYS = 14;

export const silentAgency: Detector = async (window) => {
  const silentCutoff = new Date(window.current.end);
  silentCutoff.setUTCDate(silentCutoff.getUTCDate() - STUCK_DAYS);

  // Every non-internal agency is a candidate; the per-agency check below flags
  // those that were active once (>= 1 Event) but have gone quiet for STUCK_DAYS.
  // Agencies that never did anything are skipped (no event = not "gone silent"),
  // so this doesn't flood with dead signups.
  const candidates = await prisma.agency.findMany({
    where: { ...internalAgencyFilter },
    select: { id: true, name: true },
  });

  if (candidates.length === 0) return [];

  const signals: SignalResult[] = [];

  for (const agency of candidates) {
    const lastEvent = await prisma.event.findFirst({
      where: { agencyId: agency.id },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    });

    const lastActivity = lastEvent?.occurredAt;
    if (!lastActivity) {
      // Never had any event — skip (not the same as gone silent)
      continue;
    }

    if (lastActivity < silentCutoff) {
      const daysSilent = Math.floor(
        (window.current.end.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      signals.push({
        detectorName: "silent_agency",
        dedupeKey: `silent_agency:${agency.id}`,
        payload: {
          agencyId: agency.id,
          agencyName: agency.name,
          lastActivityAt: lastActivity.toISOString(),
          daysSilent,
          stuckThresholdDays: STUCK_DAYS,
        },
        // Always 1.0 — it's a fact (ADMIN_07 §5.1)
        confidence: 1.0,
        severity: daysSilent >= STUCK_DAYS * 2 ? "critical" : "leak",
        windowStart: window.current.start,
        windowEnd: window.current.end,
      });
    }
  }

  return signals;
};
