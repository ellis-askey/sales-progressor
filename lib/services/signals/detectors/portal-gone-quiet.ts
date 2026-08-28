// Detector: portal_gone_quiet
// A buyer or seller who used the portal (2+ visit days) on a LIVE file, then
// stopped opening it for QUIET_DAYS. Mirrors the "gone quiet" rule the Files
// operational view already uses (lib/command/files.ts).

import { prisma } from "@/lib/prisma";
import type { Detector, SignalResult } from "../types";

const QUIET_DAYS = 14;

export const portalGoneQuiet: Detector = async (window) => {
  const now = window.current.end;
  const quietCutoff = new Date(now.getTime() - QUIET_DAYS * 86_400_000);

  const contacts = await prisma.contact.findMany({
    where: {
      roleType: { in: ["vendor", "purchaser"] },
      portalToken: { not: null },
      lastVisitedPortalAt: { lt: quietCutoff },
      transaction: {
        status: "active",
        isDemo: false,
        isMigrated: false,
        agency: { isInternal: false },
      },
    },
    select: {
      id: true,
      name: true,
      roleType: true,
      lastVisitedPortalAt: true,
      transaction: { select: { id: true, propertyAddress: true, agency: { select: { name: true } } } },
      _count: { select: { portalVisits: true } },
    },
    take: 200,
  });

  const signals: SignalResult[] = [];
  for (const c of contacts) {
    // Needs a real prior engagement (2+ distinct visit days) to count as "went
    // quiet" rather than "never really started".
    if (c._count.portalVisits < 2 || !c.lastVisitedPortalAt) continue;
    const daysQuiet = Math.floor((now.getTime() - c.lastVisitedPortalAt.getTime()) / 86_400_000);

    signals.push({
      detectorName: "portal_gone_quiet",
      dedupeKey: `portal_gone_quiet:${c.id}`,
      payload: {
        contactId: c.id,
        clientName: c.name,
        role: c.roleType === "vendor" ? "seller" : "buyer",
        transactionId: c.transaction.id,
        address: c.transaction.propertyAddress,
        agencyName: c.transaction.agency?.name ?? null,
        daysQuiet,
      },
      confidence: 0.7,
      severity: "leak",
      windowStart: window.current.start,
      windowEnd: window.current.end,
    });
  }

  return signals;
};
