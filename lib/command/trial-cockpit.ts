// Command Centre → Trial cockpit data layer. Superadmin-only (Law 8) — all
// reads through commandDb, every query pinned to one agencyId.
//
// Everything here is already-collected data (Event log, FileTimeSession,
// DailyMetric rollups, base tables) — the cockpit adds NO instrumentation.
// Counting rules follow the rest of the Command Centre: exclude isDemo
// files/users, exclude isMigrated files from "new instructions" (Boardwalk's
// imported book is shown separately, never as adoption), exclude reflected /
// backfilled milestone rows from velocity, and exclude TSP oversight accounts
// (@thesalesprogressor.co.uk) from the staff roster.

import { commandDb } from "@/lib/command/prisma";
import type { TrialConfig } from "@/lib/command/trials";

const DAY_MS = 86_400_000;
const STAFF_ROLES = ["director", "negotiator", "viewer"];
const TSP_DOMAIN = "@thesalesprogressor.co.uk";

export interface TrialKpi {
  key: string;
  label: string;
  tip: string;
  current: number;
  previous: number;
  // Render hint: "int" plain count, "hours" seconds → h/m
  format: "int" | "hours";
}

export interface TrialDayPoint {
  date: string; // YYYY-MM-DD
  logins: number;
  activeUsers: number;
  milestones: number;
  chases: number;
  filesCreated: number;
}

export interface QuietStaffRow {
  userId: string;
  name: string;
  role: string;
  lastActive: Date | null; // null = never logged in / no activity ever
}

export interface IdleFileRow {
  id: string;
  address: string;
  lastActivityAt: Date | null;
  idleDays: number;
}

export interface TrialOverview {
  staffCount: number;      // live (non-deactivated) agency logins on the roster
  activatedCount: number;  // of those, ever signed in
  activeStaff7d: number;
  migratedFiles: number;   // the imported book
  newFilesSinceTrial: number;
  activeFiles: number;
  kpis: TrialKpi[];
  days: TrialDayPoint[];   // trial start → today, oldest first
  quietStaff: QuietStaffRow[];
  idleFiles: IdleFileRow[];
}

// Distinct staff userIds with any sign of life in [from, to): a tracked Event
// or a real file-viewing session. Mirrors lib/command/usage.ts's "active".
async function activeStaffIds(
  agencyId: string,
  staffIds: string[],
  from: Date,
  to: Date,
): Promise<Set<string>> {
  if (staffIds.length === 0) return new Set();
  const [events, sessions] = await Promise.all([
    commandDb.event.groupBy({
      by: ["userId"],
      where: { agencyId, userId: { in: staffIds }, occurredAt: { gte: from, lt: to } },
    }),
    commandDb.fileTimeSession.groupBy({
      by: ["userId"],
      where: { agencyId, userId: { in: staffIds }, startedAt: { gte: from, lt: to } },
    }),
  ]);
  const ids = new Set<string>();
  for (const e of events) if (e.userId) ids.add(e.userId);
  for (const s of sessions) ids.add(s.userId);
  return ids;
}

// One window's worth of the KPI counts. Called twice (current 7d, prior 7d).
async function windowCounts(agencyId: string, staffIds: string[], from: Date, to: Date) {
  const [logins, hoursAgg, newFiles, milestones, manualChases, todos, portalVisits, active] = await Promise.all([
    commandDb.event.count({
      where: { agencyId, type: "user_logged_in" as never, isInternalUser: false, occurredAt: { gte: from, lt: to } },
    }),
    commandDb.fileTimeSession.aggregate({
      where: { agencyId, userId: { in: staffIds }, startedAt: { gte: from, lt: to }, endedAt: { not: null } },
      _sum: { totalEngagedSeconds: true },
    }),
    commandDb.propertyTransaction.count({
      where: { agencyId, isDemo: false, isMigrated: false, createdAt: { gte: from, lt: to } },
    }),
    commandDb.milestoneCompletion.count({
      where: {
        state: "complete" as never,
        reflected: false,
        backfilledCompletion: false,
        completedAt: { gte: from, lt: to },
        transaction: { agencyId, isDemo: false },
      },
    }),
    commandDb.outboundMessage.count({
      where: {
        agencyId,
        purpose: "chase" as never,
        type: "outbound" as never,
        isAutomated: false,
        createdById: { not: null },
        createdAt: { gte: from, lt: to },
      },
    }),
    commandDb.manualTask.count({
      // Hand-made to-dos only: WhatsApp-scan promises (sourceMessageId) and
      // unconfirmed "possible" rows aren't the staff choosing to use to-dos.
      where: { agencyId, sourceMessageId: null, isPossible: false, createdAt: { gte: from, lt: to } },
    }),
    commandDb.portalVisit.count({
      where: { createdAt: { gte: from, lt: to }, contact: { transaction: { agencyId, isDemo: false } } },
    }),
    activeStaffIds(agencyId, staffIds, from, to),
  ]);
  return {
    activeStaff: active.size,
    logins,
    hoursSeconds: hoursAgg._sum.totalEngagedSeconds ?? 0,
    newFiles,
    milestones,
    manualChases,
    todos,
    portalVisits,
  };
}

export async function getTrialOverview(agencyId: string, trial: TrialConfig): Promise<TrialOverview> {
  const now = new Date();
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since14 = new Date(now.getTime() - 14 * DAY_MS);
  const trialStart = new Date(`${trial.startsAt}T00:00:00`);

  // The roster: real agency logins only — no demo users, no deactivated
  // members, no TSP oversight accounts.
  const staff = await commandDb.user.findMany({
    where: {
      agencyId,
      role: { in: STAFF_ROLES as never },
      isDemo: false,
      deactivatedAt: null,
      NOT: { email: { endsWith: TSP_DOMAIN } },
    },
    select: { id: true, name: true, role: true, lastLoginAt: true },
  });
  const staffIds = staff.map((s) => s.id);

  const [current, previous, fileCounts, metricRows, lastEventGroups, lastSessionGroups, idleFilesRaw] = await Promise.all([
    windowCounts(agencyId, staffIds, since7, now),
    windowCounts(agencyId, staffIds, since14, since7),
    Promise.all([
      commandDb.propertyTransaction.count({ where: { agencyId, isMigrated: true } }),
      commandDb.propertyTransaction.count({
        where: { agencyId, isDemo: false, isMigrated: false, createdAt: { gte: trialStart } },
      }),
      commandDb.propertyTransaction.count({
        where: { agencyId, isDemo: false, status: { in: ["active", "on_hold"] as never } },
      }),
    ]),
    // Daily rollups from the trial start (nightly cron). Today's partial day is
    // layered on top from live counts below.
    commandDb.dailyMetric.findMany({
      where: { agencyId, date: { gte: trialStart } },
      select: { date: true, logins: true, uniqueActiveUsers: true, milestonesConfirmed: true, chasesSent: true, transactionsCreated: true },
      orderBy: { date: "asc" },
    }),
    staffIds.length
      ? commandDb.event.groupBy({
          by: ["userId"],
          where: { agencyId, userId: { in: staffIds } },
          _max: { occurredAt: true },
        })
      : Promise.resolve([] as Array<{ userId: string | null; _max: { occurredAt: Date | null } }>),
    staffIds.length
      ? commandDb.fileTimeSession.groupBy({
          by: ["userId"],
          where: { agencyId, userId: { in: staffIds } },
          _max: { lastActivityAt: true },
        })
      : Promise.resolve([] as Array<{ userId: string; _max: { lastActivityAt: Date | null } }>),
    commandDb.propertyTransaction.findMany({
      where: {
        agencyId,
        isDemo: false,
        status: { in: ["active", "on_hold"] as never },
        OR: [{ lastActivityAt: { lt: since14 } }, { lastActivityAt: null }],
      },
      select: { id: true, propertyAddress: true, lastActivityAt: true, createdAt: true },
      orderBy: { lastActivityAt: "asc" },
      take: 8,
    }),
  ]);
  const [migratedFiles, newFilesSinceTrial, activeFiles] = fileCounts;

  // ── Daily series: rollups + live today ──────────────────────────────────
  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const byDay = new Map<string, TrialDayPoint>();
  for (const r of metricRows) {
    // DailyMetric.date is a @db.Date — read as UTC midnight; key by its UTC day.
    const key = r.date.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { date: key, logins: 0, activeUsers: 0, milestones: 0, chases: 0, filesCreated: 0 };
    cur.logins += r.logins;
    cur.activeUsers += r.uniqueActiveUsers;
    cur.milestones += r.milestonesConfirmed;
    cur.chases += r.chasesSent;
    cur.filesCreated += r.transactionsCreated;
    byDay.set(key, cur);
  }
  // Live today (the rollup cron runs nightly, so today is always missing).
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (todayStart >= trialStart) {
    const live = await windowCounts(agencyId, staffIds, todayStart, now);
    const key = dayKey(todayStart);
    const cur = byDay.get(key) ?? { date: key, logins: 0, activeUsers: 0, milestones: 0, chases: 0, filesCreated: 0 };
    cur.logins = Math.max(cur.logins, live.logins);
    cur.activeUsers = Math.max(cur.activeUsers, live.activeStaff);
    cur.milestones = Math.max(cur.milestones, live.milestones);
    cur.chases = Math.max(cur.chases, live.manualChases);
    cur.filesCreated = Math.max(cur.filesCreated, live.newFiles);
    byDay.set(key, cur);
  }
  // Fill every trial day so the pulse shows honest zero-days, not gaps.
  const days: TrialDayPoint[] = [];
  for (let t = trialStart.getTime(); t <= todayStart.getTime(); t += DAY_MS) {
    const key = dayKey(new Date(t));
    days.push(byDay.get(key) ?? { date: key, logins: 0, activeUsers: 0, milestones: 0, chases: 0, filesCreated: 0 });
  }

  // ── Watch list: staff gone quiet ─────────────────────────────────────────
  const lastEventMap = new Map<string, Date | null>();
  for (const g of lastEventGroups) if (g.userId) lastEventMap.set(g.userId, g._max.occurredAt ?? null);
  const lastSessionMap = new Map<string, Date | null>();
  for (const g of lastSessionGroups) lastSessionMap.set(g.userId, g._max.lastActivityAt ?? null);
  const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

  const quietStaff: QuietStaffRow[] = staff
    .map((s) => ({
      userId: s.id,
      name: s.name,
      role: s.role as string,
      lastActive: later(later(lastEventMap.get(s.id) ?? null, lastSessionMap.get(s.id) ?? null), s.lastLoginAt),
    }))
    .filter((s) => !s.lastActive || s.lastActive < since7)
    .sort((a, b) => (a.lastActive?.getTime() ?? 0) - (b.lastActive?.getTime() ?? 0));

  const idleFiles: IdleFileRow[] = idleFilesRaw.map((f) => {
    const anchor = f.lastActivityAt ?? f.createdAt;
    return {
      id: f.id,
      address: f.propertyAddress,
      lastActivityAt: f.lastActivityAt,
      idleDays: Math.floor((now.getTime() - anchor.getTime()) / DAY_MS),
    };
  });

  const kpis: TrialKpi[] = [
    { key: "activeStaff", label: "Active staff", tip: "Staff with any tracked action or real file-viewing time in the window.", current: current.activeStaff, previous: previous.activeStaff, format: "int" },
    { key: "logins", label: "Logins", tip: "Sign-ins across the whole team.", current: current.logins, previous: previous.logins, format: "int" },
    { key: "hours", label: "Hours in app", tip: "Real focused time on files (engaged seconds, not open tabs).", current: current.hoursSeconds, previous: previous.hoursSeconds, format: "hours" },
    { key: "newFiles", label: "New files", tip: "New instructions added. Excludes the migrated book and demo files.", current: current.newFiles, previous: previous.newFiles, format: "int" },
    { key: "milestones", label: "Milestones confirmed", tip: "Steps confirmed on their files, by anyone (agent, client or solicitor). Excludes mirrored and backfilled rows.", current: current.milestones, previous: previous.milestones, format: "int" },
    { key: "chases", label: "Manual chases", tip: "Chases a human sent (auto-chase sends not counted here).", current: current.manualChases, previous: previous.manualChases, format: "int" },
    { key: "todos", label: "To-dos added", tip: "Hand-made to-dos (WhatsApp promise suggestions not counted).", current: current.todos, previous: previous.todos, format: "int" },
    { key: "portalVisits", label: "Client portal visits", tip: "Days on which a client opened their portal (one per client per day).", current: current.portalVisits, previous: previous.portalVisits, format: "int" },
  ];

  return {
    staffCount: staff.length,
    activatedCount: staff.filter((s) => s.lastLoginAt !== null).length,
    activeStaff7d: current.activeStaff,
    migratedFiles,
    newFilesSinceTrial,
    activeFiles,
    kpis,
    days,
    quietStaff,
    idleFiles,
  };
}
