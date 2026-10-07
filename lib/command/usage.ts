// Command Centre → Agencies & agents. Platform-usage view: who's active, how
// often, and who's gone quiet. Superadmin-only (Law 8) — uses commandDb.
//
// All real, already-collected data. Last-activity is the LATER of a tracked
// action (Event log — logins, chases, milestone confirms, etc.) and real
// file-viewing time (FileTimeSession — the same focus-tracking the Files tab
// reads). Using the Event log alone made agents who browse/read without firing
// a tracked action look dormant when they were in the app yesterday. Engaged
// hours + files touched also come from FileTimeSession. No new instrumentation.

import { commandDb } from "@/lib/command/prisma";
import { eventLabel } from "@/lib/command/event-labels";
import { activitySecondsForUser } from "@/lib/command/activity-time";
import { classifyDevice } from "@/lib/command/device";

const AGENT_ROLES = ["director", "negotiator"];
const DAY_MS = 86_400_000;
const WEEKS = 12;

// "never" = invited but no activity ever (needs onboarding), kept distinct from
// "dormant" = was active then went dark 14+ days (needs winning back).
export type UsageStatus = "active" | "quiet" | "dormant" | "never";

export type AgentUsage = {
  userId: string;
  name: string;
  role: string;
  agencyId: string;
  agencyName: string;
  image: string | null;
  imageFocusX: number;
  imageFocusY: number;
  lastActive: Date | null;
  logins7d: number;
  seconds7d: number;
  filesTouched7d: number;
  deviceMobile: number;  // file sessions from a mobile/tablet UA, last 12wk
  deviceDesktop: number; // file sessions from a desktop UA, last 12wk
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
  deviceMobile: number;
  deviceDesktop: number;
  lastActive: Date | null;
  status: UsageStatus;
};

export type UsageSummary = {
  activeAgents7d: number;
  hoursSeconds7d: number;
  logins7d: number;
  quiet: number;          // 7-14 days silent
  dormant: number;        // 14+ days silent (was active before)
  goneQuiet: number;      // quiet + dormant (agents who started then went 7+ days silent)
  neverActivated: number; // invited but never any activity
};

export type UsageOverview = {
  agents: AgentUsage[];
  agencies: AgencyUsage[];
  summary: UsageSummary;
};

// The later of two possibly-null dates (null = no such activity on that side).
function laterDate(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function statusFor(lastActive: Date | null, now: number): UsageStatus {
  if (!lastActive) return "never";
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
    // Exclude internal/test agencies (e.g. EXP-DB) so the activity view matches
    // the fee/chase/weekly sections and the rest of the Command Centre. Also
    // exclude demo users (e.g. the seeded demo agent an agency creates to explore
    // the product) — they are not real agents and must never pollute our views.
    where: { role: { in: AGENT_ROLES as never }, agencyId: { not: null }, agency: { isInternal: false }, isDemo: false },
    select: {
      id: true, name: true, role: true, agencyId: true,
      image: true, imageFocusX: true, imageFocusY: true,
      agency: { select: { name: true } },
    },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) {
    return { agents: [], agencies: [], summary: { activeAgents7d: 0, hoursSeconds7d: 0, logins7d: 0, quiet: 0, dormant: 0, goneQuiet: 0, neverActivated: 0 } };
  }

  const [loginGroups, lastEventGroups, lastSessionGroups, sessions] = await Promise.all([
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
    // Last real file-viewing moment per agent, across all time (not windowed) —
    // so "last active" reflects someone who was reading files even if they fired
    // no tracked action. lastActivityAt is heartbeat-updated, so it's the truest
    // "last seen" within a session.
    commandDb.fileTimeSession.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { lastActivityAt: true },
    }),
    commandDb.fileTimeSession.findMany({
      where: { userId: { in: userIds }, startedAt: { gte: since12w } },
      select: { userId: true, startedAt: true, endedAt: true, totalEngagedSeconds: true, transactionId: true, userAgent: true },
    }),
  ]);

  const loginMap = new Map(loginGroups.map((g) => [g.userId, g._count._all]));
  const lastEventMap = new Map(lastEventGroups.map((g) => [g.userId, g._max.occurredAt ?? null]));
  const lastSessionMap = new Map(lastSessionGroups.map((g) => [g.userId, g._max.lastActivityAt ?? null]));

  const agg = new Map<string, { seconds: number; files: Set<string>; weeks: number[]; mobile: number; desktop: number }>();
  for (const id of userIds) agg.set(id, { seconds: 0, files: new Set(), weeks: new Array(WEEKS).fill(0), mobile: 0, desktop: 0 });
  for (const s of sessions) {
    const a = agg.get(s.userId);
    if (!a) continue;
    const started = s.startedAt.getTime();
    const weeksAgo = Math.floor((now - started) / (7 * DAY_MS));
    const idx = WEEKS - 1 - Math.min(WEEKS - 1, weeksAgo);
    if (idx >= 0 && idx < WEEKS) a.weeks[idx] += 1;
    const device = classifyDevice(s.userAgent);
    if (device === "mobile") a.mobile += 1;
    else if (device === "desktop") a.desktop += 1;
    if (started >= now - 7 * DAY_MS) {
      if (s.endedAt && s.totalEngagedSeconds) a.seconds += s.totalEngagedSeconds;
      a.files.add(s.transactionId);
    }
  }

  const agents: AgentUsage[] = users.map((u) => {
    const a = agg.get(u.id)!;
    const lastActive = laterDate(lastEventMap.get(u.id) ?? null, lastSessionMap.get(u.id) ?? null);
    return {
      userId: u.id,
      name: u.name,
      role: u.role,
      agencyId: u.agencyId!,
      agencyName: u.agency?.name ?? "—",
      image: u.image,
      imageFocusX: u.imageFocusX,
      imageFocusY: u.imageFocusY,
      lastActive,
      logins7d: loginMap.get(u.id) ?? 0,
      seconds7d: a.seconds,
      filesTouched7d: a.files.size,
      deviceMobile: a.mobile,
      deviceDesktop: a.desktop,
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
        deviceMobile: 0,
        deviceDesktop: 0,
        lastActive: null as Date | null,
        status: "dormant" as UsageStatus,
      };
    cur.agentCount += 1;
    if (ag.status === "active") cur.activeCount += 1;
    cur.logins7d += ag.logins7d;
    cur.seconds7d += ag.seconds7d;
    cur.filesTouched7d += ag.filesTouched7d;
    cur.deviceMobile += ag.deviceMobile;
    cur.deviceDesktop += ag.deviceDesktop;
    if (ag.lastActive && (!cur.lastActive || ag.lastActive > cur.lastActive)) cur.lastActive = ag.lastActive;
    byAgency.set(ag.agencyId, cur);
  }
  const agencies = [...byAgency.values()].map((a) => ({ ...a, status: statusFor(a.lastActive, now) }));
  agencies.sort(
    (x, y) => y.seconds7d - x.seconds7d || (y.lastActive?.getTime() ?? 0) - (x.lastActive?.getTime() ?? 0),
  );

  const quiet = agents.filter((a) => a.status === "quiet").length;
  const dormant = agents.filter((a) => a.status === "dormant").length;
  const summary: UsageSummary = {
    activeAgents7d: agents.filter((a) => a.status === "active").length,
    hoursSeconds7d: agents.reduce((s, a) => s + a.seconds7d, 0),
    logins7d: agents.reduce((s, a) => s + a.logins7d, 0),
    quiet,
    dormant,
    goneQuiet: quiet + dormant,
    neverActivated: agents.filter((a) => a.status === "never").length,
  };

  return { agents, agencies, summary };
}

// ── Single-agent drill-down ───────────────────────────────────────────────────

export type AgentFileTime = {
  transactionId: string;
  address: string;
  seconds: number;
  sessions: number;
  lastActivity: Date | null;
};
export type AgentActivityItem = {
  id: string;
  label: string;
  at: Date;
  address: string | null;
};
export type AgentDetail = {
  userId: string;
  name: string;
  role: string;
  agencyId: string | null;
  agencyName: string;
  // Agency-wide email branding (shared across the agency; shown on client
  // emails). Managed from the CC agent drill-down on the director's behalf.
  logo: { logoPath: string | null; tileColor: string | null; scale: string | null; align: string | null };
  image: string | null;
  imageFocusX: number;
  imageFocusY: number;
  lastActive: Date | null;
  totalSeconds: number;
  sessionCount: number;
  logins7d: number;
  deviceMobile: number;  // file sessions from a mobile/tablet UA, all time
  deviceDesktop: number; // file sessions from a desktop UA, all time
  weeksSeconds: number[]; // WEEKS weekly engaged-seconds, oldest → newest
  files: AgentFileTime[];
  recent: AgentActivityItem[];
};

export async function getAgentDetail(userId: string): Promise<AgentDetail | null> {
  // findFirst (not findUnique) so we can also exclude demo users — a demo agent's
  // detail page should read as not-found, same as it's hidden from the list.
  const user = await commandDb.user.findFirst({
    where: { id: userId, isDemo: false },
    select: {
      id: true, name: true, role: true, agencyId: true,
      image: true, imageFocusX: true, imageFocusY: true,
      agency: {
        select: {
          name: true,
          logoPath: true, logoTileColor: true, logoScale: true, logoAlign: true,
        },
      },
    },
  });
  if (!user) return null;

  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since12w = new Date(now - WEEKS * 7 * DAY_MS);

  const [sessions, logins7d, lastEvent, recentEvents] = await Promise.all([
    commandDb.fileTimeSession.findMany({
      where: { userId },
      select: { transactionId: true, totalEngagedSeconds: true, endedAt: true, startedAt: true, lastActivityAt: true, userAgent: true },
    }),
    commandDb.event.count({ where: { userId, type: "user_logged_in" as never, occurredAt: { gte: since7 } } }),
    commandDb.event.aggregate({ where: { userId }, _max: { occurredAt: true } }),
    commandDb.event.findMany({
      where: { userId },
      select: { id: true, type: true, occurredAt: true, entityType: true, entityId: true },
      orderBy: { occurredAt: "desc" },
      take: 15,
    }),
  ]);

  // Per-file totals + weekly trend.
  const byTx = new Map<string, { seconds: number; sessions: number; last: Date | null }>();
  const weeksSeconds = new Array(WEEKS).fill(0);
  let totalSeconds = 0;
  let sessionCount = 0;
  let deviceMobile = 0;
  let deviceDesktop = 0;
  // Latest real file-viewing moment, folded into lastActive below so browsing
  // without a tracked action still counts.
  let lastSessionActivity: Date | null = null;
  for (const s of sessions) {
    const secs = s.endedAt && s.totalEngagedSeconds ? s.totalEngagedSeconds : 0;
    const cur = byTx.get(s.transactionId) ?? { seconds: 0, sessions: 0, last: null as Date | null };
    cur.seconds += secs;
    cur.sessions += 1;
    if (!cur.last || s.lastActivityAt > cur.last) cur.last = s.lastActivityAt;
    if (!lastSessionActivity || s.lastActivityAt > lastSessionActivity) lastSessionActivity = s.lastActivityAt;
    byTx.set(s.transactionId, cur);
    totalSeconds += secs;
    sessionCount += 1;
    const device = classifyDevice(s.userAgent);
    if (device === "mobile") deviceMobile += 1;
    else if (device === "desktop") deviceDesktop += 1;
    if (secs > 0 && s.startedAt >= since12w) {
      const idx = WEEKS - 1 - Math.min(WEEKS - 1, Math.floor((now - s.startedAt.getTime()) / (7 * DAY_MS)));
      if (idx >= 0 && idx < WEEKS) weeksSeconds[idx] += secs;
    }
  }

  // Weighted comms effort this user put in (messages they sent + notes they
  // wrote), added on top of their measured focus-time. Attributed per-user by
  // author, so inbound (no author) stays file-level only, not here.
  totalSeconds += await activitySecondsForUser(commandDb, userId);

  // Resolve addresses for the files worked + the transaction-scoped activity.
  const txIds = new Set<string>(byTx.keys());
  for (const e of recentEvents) if (e.entityType === "transaction" && e.entityId) txIds.add(e.entityId);
  const txs = txIds.size
    ? await commandDb.propertyTransaction.findMany({
        where: { id: { in: [...txIds] } },
        select: { id: true, propertyAddress: true },
      })
    : [];
  const addrMap = new Map(txs.map((t) => [t.id, t.propertyAddress]));

  const files: AgentFileTime[] = [...byTx.entries()]
    .map(([transactionId, v]) => ({
      transactionId,
      address: addrMap.get(transactionId) ?? "A file",
      seconds: v.seconds,
      sessions: v.sessions,
      lastActivity: v.last,
    }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 20);

  const recent: AgentActivityItem[] = recentEvents.map((e) => ({
    id: e.id,
    label: eventLabel(e.type),
    at: e.occurredAt,
    address: e.entityType === "transaction" && e.entityId ? addrMap.get(e.entityId) ?? null : null,
  }));

  return {
    userId: user.id,
    name: user.name,
    role: user.role,
    agencyId: user.agencyId,
    agencyName: user.agency?.name ?? "—",
    logo: {
      logoPath: user.agency?.logoPath ?? null,
      tileColor: user.agency?.logoTileColor ?? null,
      scale: user.agency?.logoScale ?? null,
      align: user.agency?.logoAlign ?? null,
    },
    image: user.image,
    imageFocusX: user.imageFocusX,
    imageFocusY: user.imageFocusY,
    lastActive: laterDate(lastEvent._max.occurredAt ?? null, lastSessionActivity),
    totalSeconds,
    sessionCount,
    logins7d,
    deviceMobile,
    deviceDesktop,
    weeksSeconds,
    files,
    recent,
  };
}
