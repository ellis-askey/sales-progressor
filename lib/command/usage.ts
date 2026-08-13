// Command Centre → Agencies & agents. Platform-usage view: who's active, how
// often, and who's gone quiet. Superadmin-only (Law 8) — uses commandDb.
//
// All real, already-collected data: logins + last-activity from the Event log,
// engaged hours + files touched from FileTimeSession (the same tracking the
// Files tab reads). No new instrumentation.

import { commandDb } from "@/lib/command/prisma";

const AGENT_ROLES = ["director", "negotiator"];
const DAY_MS = 86_400_000;
const WEEKS = 12;

export type UsageStatus = "active" | "quiet" | "dormant";

export type AgentUsage = {
  userId: string;
  name: string;
  role: string;
  agencyId: string;
  agencyName: string;
  lastActive: Date | null;
  logins7d: number;
  seconds7d: number;
  filesTouched7d: number;
  weeks: number[]; // WEEKS weekly session counts, oldest → newest
  status: UsageStatus;
};

export type AgencyUsage = {
  agencyId: string;
  agencyName: string;
  agentCount: number;
  activeCount: number;
  logins7d: number;
  seconds7d: number;
  filesTouched7d: number;
  lastActive: Date | null;
  status: UsageStatus;
};

export type UsageSummary = {
  activeAgents7d: number;
  hoursSeconds7d: number;
  logins7d: number;
  goneQuiet: number; // not seen in 14+ days (dormant)
};

export type UsageOverview = {
  agents: AgentUsage[];
  agencies: AgencyUsage[];
  summary: UsageSummary;
};

function statusFor(lastActive: Date | null, now: number): UsageStatus {
  if (!lastActive) return "dormant";
  const days = (now - lastActive.getTime()) / DAY_MS;
  if (days < 7) return "active";
  if (days < 14) return "quiet";
  return "dormant";
}

export async function getUsageOverview(): Promise<UsageOverview> {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since12w = new Date(now - WEEKS * 7 * DAY_MS);

  const users = await commandDb.user.findMany({
    where: { role: { in: AGENT_ROLES as never }, agencyId: { not: null } },
    select: { id: true, name: true, role: true, agencyId: true, agency: { select: { name: true } } },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    return { agents: [], agencies: [], summary: { activeAgents7d: 0, hoursSeconds7d: 0, logins7d: 0, goneQuiet: 0 } };
  }

  const [loginGroups, lastEventGroups, sessions] = await Promise.all([
    commandDb.event.groupBy({
      by: ["userId"],
      where: { type: "user_logged_in" as never, userId: { in: userIds }, occurredAt: { gte: since7 } },
      _count: { _all: true },
    }),
    commandDb.event.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { occurredAt: true },
    }),
    commandDb.fileTimeSession.findMany({
      where: { userId: { in: userIds }, startedAt: { gte: since12w } },
      select: { userId: true, startedAt: true, endedAt: true, totalEngagedSeconds: true, transactionId: true },
    }),
  ]);

  const loginMap = new Map(loginGroups.map((g) => [g.userId, g._count._all]));
  const lastMap = new Map(lastEventGroups.map((g) => [g.userId, g._max.occurredAt ?? null]));

  const agg = new Map<string, { seconds: number; files: Set<string>; weeks: number[] }>();
  for (const id of userIds) agg.set(id, { seconds: 0, files: new Set(), weeks: new Array(WEEKS).fill(0) });
  for (const s of sessions) {
    const a = agg.get(s.userId);
    if (!a) continue;
    const started = s.startedAt.getTime();
    const weeksAgo = Math.floor((now - started) / (7 * DAY_MS));
    const idx = WEEKS - 1 - Math.min(WEEKS - 1, weeksAgo);
    if (idx >= 0 && idx < WEEKS) a.weeks[idx] += 1;
    if (started >= now - 7 * DAY_MS) {
      if (s.endedAt && s.totalEngagedSeconds) a.seconds += s.totalEngagedSeconds;
      a.files.add(s.transactionId);
    }
  }

  const agents: AgentUsage[] = users.map((u) => {
    const a = agg.get(u.id)!;
    const lastActive = lastMap.get(u.id) ?? null;
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      agencyId: u.agencyId!,
      agencyName: u.agency?.name ?? "—",
      lastActive,
      logins7d: loginMap.get(u.id) ?? 0,
      seconds7d: a.seconds,
      filesTouched7d: a.files.size,
      weeks: a.weeks,
      status: statusFor(lastActive, now),
    };
  });

  // Most active first (by engaged hours, then recency); dormant sinks.
  agents.sort(
    (x, y) => y.seconds7d - x.seconds7d || (y.lastActive?.getTime() ?? 0) - (x.lastActive?.getTime() ?? 0),
  );

  // Roll up per agency.
  const byAgency = new Map<string, AgencyUsage>();
  for (const ag of agents) {
    const cur =
      byAgency.get(ag.agencyId) ??
      {
        agencyId: ag.agencyId,
        agencyName: ag.agencyName,
        agentCount: 0,
        activeCount: 0,
        logins7d: 0,
        seconds7d: 0,
        filesTouched7d: 0,
        lastActive: null as Date | null,
        status: "dormant" as UsageStatus,
      };
    cur.agentCount += 1;
    if (ag.status === "active") cur.activeCount += 1;
    cur.logins7d += ag.logins7d;
    cur.seconds7d += ag.seconds7d;
    cur.filesTouched7d += ag.filesTouched7d;
    if (ag.lastActive && (!cur.lastActive || ag.lastActive > cur.lastActive)) cur.lastActive = ag.lastActive;
    byAgency.set(ag.agencyId, cur);
  }
  const agencies = [...byAgency.values()].map((a) => ({ ...a, status: statusFor(a.lastActive, now) }));
  agencies.sort(
    (x, y) => y.seconds7d - x.seconds7d || (y.lastActive?.getTime() ?? 0) - (x.lastActive?.getTime() ?? 0),
  );

  const summary: UsageSummary = {
    activeAgents7d: agents.filter((a) => a.status === "active").length,
    hoursSeconds7d: agents.reduce((s, a) => s + a.seconds7d, 0),
    logins7d: agents.reduce((s, a) => s + a.logins7d, 0),
    goneQuiet: agents.filter((a) => a.status === "dormant").length,
  };

  return { agents, agencies, summary };
}
