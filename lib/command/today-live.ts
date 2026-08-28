import type { CommandMode } from "@/lib/command/scope";
import {
  computeMetricsForScope,
  loadInternalIds,
  londonDateStr,
  type MetricValues,
} from "@/lib/services/metrics-rollup";

/**
 * Live counts for TODAY (London day-so-far), computed straight from the main DB
 * using the exact same counting rules as the nightly rollup. The rollup only
 * ever writes YESTERDAY's DailyMetric row, so anything that reads a "today" row
 * reads zero until the next night. This fills that gap for the Command Centre
 * Today page.
 *
 * Scope mirrors the rollup's own scope split so numbers reconcile with history:
 *  - specific agencies  -> sum per-agency scopes
 *  - combined           -> the global (all-null) scope
 *  - sp / pm            -> transaction metrics from the serviceType scope,
 *                          signups from the matching modeProfile scope
 */
export interface TodayLive {
  transactionsCreated: number;
  milestonesConfirmed: number;
  chasesSent: number;
  aiDraftsGenerated: number;
  signups: number;
}

function pick(m: MetricValues): TodayLive {
  return {
    transactionsCreated: m.transactionsCreated,
    milestonesConfirmed: m.milestonesConfirmed,
    chasesSent: m.chasesSent,
    aiDraftsGenerated: m.aiDraftsGenerated,
    signups: m.signups,
  };
}

function sumLive(rows: TodayLive[]): TodayLive {
  return rows.reduce<TodayLive>(
    (acc, r) => ({
      transactionsCreated: acc.transactionsCreated + r.transactionsCreated,
      milestonesConfirmed: acc.milestonesConfirmed + r.milestonesConfirmed,
      chasesSent: acc.chasesSent + r.chasesSent,
      aiDraftsGenerated: acc.aiDraftsGenerated + r.aiDraftsGenerated,
      signups: acc.signups + r.signups,
    }),
    { transactionsCreated: 0, milestonesConfirmed: 0, chasesSent: 0, aiDraftsGenerated: 0, signups: 0 },
  );
}

export async function computeTodayLive(
  mode: CommandMode,
  agencyIds: string[],
): Promise<TodayLive> {
  const dateStr = londonDateStr(new Date());
  const internal = await loadInternalIds();

  if (agencyIds.length > 0) {
    const rows = await Promise.all(
      agencyIds.map((id) =>
        computeMetricsForScope(dateStr, { agencyId: id, serviceType: null, modeProfile: null }, internal).then(pick),
      ),
    );
    return sumLive(rows);
  }

  if (mode === "combined") {
    const m = await computeMetricsForScope(dateStr, { agencyId: null, serviceType: null, modeProfile: null }, internal);
    return pick(m);
  }

  const serviceType = mode === "sp" ? "self_managed" : "outsourced";
  const modeProfile = mode === "sp" ? "self_progressed" : "progressor_managed";
  const [txM, userM] = await Promise.all([
    computeMetricsForScope(dateStr, { agencyId: null, serviceType, modeProfile: null }, internal),
    computeMetricsForScope(dateStr, { agencyId: null, serviceType: null, modeProfile }, internal),
  ]);
  return { ...pick(txM), signups: userM.signups };
}
