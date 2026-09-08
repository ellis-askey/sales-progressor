// lib/services/client-chase-state.ts
//
// B6 of the client-chase arc (Sub-arc B). Per-transaction lookup that
// aggregates ClientChaseState rows into a chip-renderable summary keyed by
// milestone code. The agent's MilestonePanel calls this once per page-load
// (when wired) and passes the result to MilestoneRow as a prop; the chip
// renders when a milestone has any non-default chase state.
//
// Aggregation rules (multiple contacts can share a milestone on the same
// side — joint sellers, joint purchasers):
//   - If ANY row is status="opted_out"      → kind="opted_out"  (the grey chip wins)
//   - Else if ANY row has lastEngagedAt > lastChasedAt → kind="engaged"
//   - Else if ANY row has chaseCount > 0    → kind="chased"
//   - Else no entry (no chip)
//
// "Engaged" is decided by lastEngagedAt > lastChasedAt — the client has
// visited the respond page (or set a date, or left a note) SINCE the most
// recent chase landed. Engagement that pre-dates the most recent chase
// doesn't count (they engaged once but then we chased them again and
// they've gone quiet — chip should re-flag).
//
// status="completed" rows are skipped: the milestone is done, no chip needed.
// status="escalated" rows surface a distinct "exhausted" chip ("Chased N times,
// no reply") — auto-chasing has given up and handed the milestone to the agent.
// That is NOT the same as a client unsubscribing: a genuine opt-out
// (status="opted_out") keeps its own chip. The two used to be conflated under
// one "Client opted out" label, which was misleading — nobody had opted out.

import { prisma } from "@/lib/prisma";

export type ClientChaseChipKind = "chased" | "engaged" | "exhausted" | "opted_out";

export type AggregatedClientChase = {
  kind: ClientChaseChipKind;
  lastChasedAt: Date | null;
  lastEngagedAt: Date | null;
  // Highest chase count across the contacts on this milestone. Drives the
  // "Chased N times" text on the exhausted chip so it reflects the real number
  // (auto-chase caps at 2, but a silence hand-off can happen after just 1).
  chaseCount: number;
  // For multi-contact transparency. Not rendered in the chip text v1, but
  // available for hover tooltips or future per-contact drill-down.
  contactCount: number;
};

export async function getClientChaseStatesForTransaction(
  transactionId: string,
): Promise<Record<string, AggregatedClientChase>> {
  const rows = await prisma.clientChaseState.findMany({
    where: {
      transactionId,
      // Don't surface chip for milestones the client already confirmed.
      // status="active", "escalated", "opted_out" all surface a chip;
      // "completed" doesn't.
      status: { in: ["active", "escalated", "opted_out"] },
    },
    select: {
      milestoneCode: true,
      chaseCount: true,
      lastChasedAt: true,
      lastEngagedAt: true,
      status: true,
    },
  });
  if (rows.length === 0) return {};

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = grouped.get(r.milestoneCode) ?? [];
    arr.push(r);
    grouped.set(r.milestoneCode, arr);
  }

  const out: Record<string, AggregatedClientChase> = {};
  for (const [code, group] of grouped) {
    // A genuine unsubscribe wins the chip; otherwise a "given up, handed to
    // agent" (escalated) row shows the exhausted chip.
    const anyOptedOut = group.some((r) => r.status === "opted_out");
    const anyExhausted = group.some((r) => r.status === "escalated");
    const chaseCount = group.reduce((acc, r) => Math.max(acc, r.chaseCount), 0);
    const lastChasedAt = group.reduce<Date | null>(
      (acc, r) => (r.lastChasedAt && (!acc || r.lastChasedAt > acc) ? r.lastChasedAt : acc),
      null,
    );
    const lastEngagedAt = group.reduce<Date | null>(
      (acc, r) => (r.lastEngagedAt && (!acc || r.lastEngagedAt > acc) ? r.lastEngagedAt : acc),
      null,
    );

    let kind: ClientChaseChipKind;
    if (anyOptedOut) {
      kind = "opted_out";
    } else if (anyExhausted) {
      kind = "exhausted";
    } else if (lastEngagedAt && lastChasedAt && lastEngagedAt > lastChasedAt) {
      kind = "engaged";
    } else if (lastEngagedAt && !lastChasedAt) {
      // Engaged but no chase yet (unusual — engagement bumps before first chase
      // are possible if a client clicks an old link). Treat as engaged.
      kind = "engaged";
    } else if (group.some((r) => r.chaseCount > 0)) {
      kind = "chased";
    } else {
      // Active row but no chases yet — skip the chip. (B7's cron writes
      // chaseCount=1 on first send via upsert; this branch covers the
      // theoretical case of a row sitting at 0 — e.g. a fixture or a
      // race window between row creation and chase send.)
      continue;
    }

    out[code] = {
      kind,
      lastChasedAt,
      lastEngagedAt,
      chaseCount,
      contactCount: group.length,
    };
  }

  return out;
}
