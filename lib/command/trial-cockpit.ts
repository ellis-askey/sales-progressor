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
import { classifyDevice } from "@/lib/command/device";
import { getAgencySales, getAgencyEmailLog, type AgencySaleRow } from "@/lib/command/agency-file";
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

// ── Usage tab ─────────────────────────────────────────────────────────────────

export interface UsageDayPoint {
  date: string; // YYYY-MM-DD
  logins: number;
  activeUsers: number;
}

export interface WeekHoursPoint {
  label: string;   // week-start date, e.g. "3 Nov"
  seconds: number; // engaged seconds that week, whole team
}

export interface TrialUsage {
  days: UsageDayPoint[];        // trial start → today
  weeklyHours: WeekHoursPoint[]; // last 12 weeks, oldest first
  deviceMobile: number;          // file sessions, last 12 weeks
  deviceDesktop: number;
  weekday: number[];             // 7 session counts Mon→Sun, last 8 weeks
  hourOfDay: number[];           // 24 session counts by start hour, last 8 weeks
}

async function staffIdsFor(agencyId: string): Promise<string[]> {
  const staff = await commandDb.user.findMany({
    where: {
      agencyId,
      role: { in: STAFF_ROLES as never },
      isDemo: false,
      deactivatedAt: null,
      NOT: { email: { endsWith: TSP_DOMAIN } },
    },
    select: { id: true },
  });
  return staff.map((s) => s.id);
}

export async function getTrialUsage(agencyId: string, trial: TrialConfig): Promise<TrialUsage> {
  const now = new Date();
  const nowMs = now.getTime();
  const trialStart = new Date(`${trial.startsAt}T00:00:00`);
  const since12w = new Date(nowMs - 12 * 7 * DAY_MS);
  const since8w = new Date(nowMs - 8 * 7 * DAY_MS);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const staffIds = await staffIdsFor(agencyId);

  const [metricRows, sessions, todayLogins, todayActive] = await Promise.all([
    commandDb.dailyMetric.findMany({
      where: { agencyId, date: { gte: trialStart } },
      select: { date: true, logins: true, uniqueActiveUsers: true },
      orderBy: { date: "asc" },
    }),
    staffIds.length
      ? commandDb.fileTimeSession.findMany({
          where: { agencyId, userId: { in: staffIds }, startedAt: { gte: since12w } },
          select: { startedAt: true, endedAt: true, totalEngagedSeconds: true, userAgent: true },
        })
      : [],
    commandDb.event.count({
      where: { agencyId, type: "user_logged_in" as never, isInternalUser: false, occurredAt: { gte: todayStart } },
    }),
    activeStaffIds(agencyId, staffIds, todayStart, now),
  ]);

  // Daily logins + active users: nightly rollups, live today on top.
  const byDay = new Map<string, UsageDayPoint>();
  for (const r of metricRows) {
    const key = r.date.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { date: key, logins: 0, activeUsers: 0 };
    cur.logins += r.logins;
    cur.activeUsers += r.uniqueActiveUsers;
    byDay.set(key, cur);
  }
  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  if (todayStart >= trialStart) {
    const key = dayKey(todayStart);
    const cur = byDay.get(key) ?? { date: key, logins: 0, activeUsers: 0 };
    cur.logins = Math.max(cur.logins, todayLogins);
    cur.activeUsers = Math.max(cur.activeUsers, todayActive.size);
    byDay.set(key, cur);
  }
  const days: UsageDayPoint[] = [];
  for (let t = trialStart.getTime(); t <= todayStart.getTime(); t += DAY_MS) {
    const key = dayKey(new Date(t));
    days.push(byDay.get(key) ?? { date: key, logins: 0, activeUsers: 0 });
  }

  // Weekly engaged hours + device + rhythm from the raw sessions.
  const weeklyHours: WeekHoursPoint[] = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(nowMs - (12 - 1 - i) * 7 * DAY_MS - 6 * DAY_MS);
    return { label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), seconds: 0 };
  });
  let deviceMobile = 0;
  let deviceDesktop = 0;
  const weekday = new Array(7).fill(0);
  const hourOfDay = new Array(24).fill(0);
  for (const s of sessions) {
    const started = s.startedAt.getTime();
    const idx = 12 - 1 - Math.min(12 - 1, Math.floor((nowMs - started) / (7 * DAY_MS)));
    if (idx >= 0 && idx < 12 && s.endedAt && s.totalEngagedSeconds) weeklyHours[idx].seconds += s.totalEngagedSeconds;
    const device = classifyDevice(s.userAgent);
    if (device === "mobile") deviceMobile += 1;
    else if (device === "desktop") deviceDesktop += 1;
    if (started >= since8w.getTime()) {
      const d = s.startedAt.getDay(); // 0 Sun .. 6 Sat
      weekday[(d + 6) % 7] += 1;      // Mon-first
      hourOfDay[s.startedAt.getHours()] += 1;
    }
  }

  return { days, weeklyHours, deviceMobile, deviceDesktop, weekday, hourOfDay };
}

// ── Files tab ─────────────────────────────────────────────────────────────────

export interface TrialFiles {
  migrated: number;
  newSinceTrial: number;
  exchangedTrial: number; // contracts_exchanged events since trial start
  completedTrial: number; // sale_completed events since trial start
  withdrawnTrial: number;
  weeklyNew: Array<{ label: string; value: number }>; // per trial week, oldest first
  selfManagedLive: number;
  outsourcedLive: number;
  stageCounts: Array<{ stage: AgencySaleRow["stage"]; count: number }>;
  sales: AgencySaleRow[]; // every live file, most recently worked first
}

export async function getTrialFiles(agencyId: string, trial: TrialConfig): Promise<TrialFiles> {
  const now = new Date();
  const trialStart = new Date(`${trial.startsAt}T00:00:00`);

  const [sales, migrated, newRows, exchangedTrial, completedTrial, withdrawnTrial] = await Promise.all([
    getAgencySales(agencyId, now),
    commandDb.propertyTransaction.count({ where: { agencyId, isMigrated: true } }),
    commandDb.propertyTransaction.findMany({
      where: { agencyId, isDemo: false, isMigrated: false, createdAt: { gte: trialStart } },
      select: { createdAt: true },
    }),
    commandDb.event.count({
      where: { agencyId, type: "contracts_exchanged" as never, occurredAt: { gte: trialStart } },
    }),
    commandDb.event.count({
      where: { agencyId, type: "sale_completed" as never, occurredAt: { gte: trialStart } },
    }),
    commandDb.propertyTransaction.count({
      where: { agencyId, isDemo: false, withdrawnAt: { gte: trialStart } },
    }),
  ]);

  // New instructions per trial week (week 1 = the first 7 days, and so on).
  const weeksSoFar = Math.max(1, Math.ceil(((now.getTime() - trialStart.getTime()) / DAY_MS + 1) / 7));
  const weeklyNew = Array.from({ length: weeksSoFar }, (_, i) => {
    const start = new Date(trialStart.getTime() + i * 7 * DAY_MS);
    return { label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: 0 };
  });
  for (const r of newRows) {
    const idx = Math.floor((r.createdAt.getTime() - trialStart.getTime()) / (7 * DAY_MS));
    if (idx >= 0 && idx < weeklyNew.length) weeklyNew[idx].value += 1;
  }

  const stageOrder: AgencySaleRow["stage"][] = ["Onboarding", "Conveyancing", "Pre-exchange", "Post-exchange"];
  const stageCounts = stageOrder.map((stage) => ({ stage, count: sales.filter((s) => s.stage === stage).length }));

  return {
    migrated,
    newSinceTrial: newRows.length,
    exchangedTrial,
    completedTrial,
    withdrawnTrial,
    weeklyNew,
    selfManagedLive: sales.filter((s) => s.serviceType === "self_managed").length,
    outsourcedLive: sales.filter((s) => s.serviceType === "outsourced").length,
    stageCounts,
    sales,
  };
}

// ── Actions tab ───────────────────────────────────────────────────────────────

export interface TrialActions {
  // Trial-to-date counts
  steps: number;
  manualChases: number;
  autoChases: number;
  updatesLogged: number;   // internal notes / logged updates by a person
  todosAdded: number;      // hand-made
  todosCompleted: number;
  chainsBuilt: number;     // chains created during the trial
  activeChains: number;
  openEnquiries: number;   // open enquiry loops right now
  enquiriesClosed: number; // closed during the trial
  // Who confirms steps (trial-to-date)
  confirmSplit: { agent: number; portal: number; solicitor: number; broker: number; other: number };
  // Per trial week, oldest first
  weeklySteps: Array<{ label: string; value: number }>;
  weeklyManualChases: Array<{ label: string; value: number }>;
  // Open to-dos by assignee, busiest first
  openTodos: Array<{ name: string; count: number }>;
}

export async function getTrialActions(agencyId: string, trial: TrialConfig): Promise<TrialActions> {
  const now = new Date();
  const trialStart = new Date(`${trial.startsAt}T00:00:00`);
  const weeksSoFar = Math.max(1, Math.ceil(((now.getTime() - trialStart.getTime()) / DAY_MS + 1) / 7));
  const weekBuckets = () =>
    Array.from({ length: weeksSoFar }, (_, i) => {
      const start = new Date(trialStart.getTime() + i * 7 * DAY_MS);
      return { label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: 0 };
    });
  const weekIdx = (d: Date) => Math.floor((d.getTime() - trialStart.getTime()) / (7 * DAY_MS));

  const [milestones, chaseRows, updatesLogged, todosAdded, todosCompleted, chainsBuilt, activeChains, openEnquiries, enquiriesClosed, openTodoGroups] = await Promise.all([
    commandDb.milestoneCompletion.findMany({
      where: {
        state: "complete" as never,
        reflected: false,
        backfilledCompletion: false,
        completedAt: { gte: trialStart },
        transaction: { agencyId, isDemo: false },
      },
      select: {
        completedAt: true,
        completedById: true,
        confirmedByPortal: true,
        confirmedBySolicitorFirmId: true,
        confirmedBySolicitorContactId: true,
        confirmedByBrokerFirmId: true,
        confirmedByBrokerContactId: true,
      },
    }),
    commandDb.outboundMessage.findMany({
      where: { agencyId, purpose: "chase" as never, type: "outbound" as never, createdAt: { gte: trialStart } },
      select: { createdAt: true, isAutomated: true },
    }),
    commandDb.outboundMessage.count({
      where: { agencyId, type: "internal_note" as never, createdById: { not: null }, createdAt: { gte: trialStart } },
    }),
    commandDb.manualTask.count({
      where: { agencyId, sourceMessageId: null, isPossible: false, createdAt: { gte: trialStart } },
    }),
    commandDb.manualTask.count({
      where: { agencyId, status: "done" as never, completedAt: { gte: trialStart } },
    }),
    commandDb.propertyChain.count({ where: { agencyId, createdAt: { gte: trialStart } } }),
    commandDb.propertyChain.count({ where: { agencyId, status: "ACTIVE" as never } }),
    commandDb.enquiryTracker.count({ where: { closedAt: null, transaction: { agencyId, isDemo: false } } }),
    commandDb.enquiryTracker.count({ where: { closedAt: { gte: trialStart }, transaction: { agencyId, isDemo: false } } }),
    commandDb.manualTask.groupBy({
      by: ["assignedToId"],
      where: { agencyId, status: "open" as never, isPossible: false },
      _count: { _all: true },
    }),
  ]);

  // Attribution: portal first (client self-confirm), then solicitor, broker,
  // then an agent-side user, else "other" (system reconciliation etc.).
  const confirmSplit = { agent: 0, portal: 0, solicitor: 0, broker: 0, other: 0 };
  const weeklySteps = weekBuckets();
  for (const m of milestones) {
    if (m.confirmedByPortal) confirmSplit.portal += 1;
    else if (m.confirmedBySolicitorFirmId || m.confirmedBySolicitorContactId) confirmSplit.solicitor += 1;
    else if (m.confirmedByBrokerFirmId || m.confirmedByBrokerContactId) confirmSplit.broker += 1;
    else if (m.completedById) confirmSplit.agent += 1;
    else confirmSplit.other += 1;
    if (m.completedAt) {
      const idx = weekIdx(m.completedAt);
      if (idx >= 0 && idx < weeklySteps.length) weeklySteps[idx].value += 1;
    }
  }

  const weeklyManualChases = weekBuckets();
  let manualChases = 0;
  let autoChases = 0;
  for (const c of chaseRows) {
    if (c.isAutomated) autoChases += 1;
    else {
      manualChases += 1;
      const idx = weekIdx(c.createdAt);
      if (idx >= 0 && idx < weeklyManualChases.length) weeklyManualChases[idx].value += 1;
    }
  }

  // Resolve assignee names for open to-dos (unassigned rolls up as one row).
  const assigneeIds = openTodoGroups.map((g) => g.assignedToId).filter((id): id is string => !!id);
  const assignees = assigneeIds.length
    ? await commandDb.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const nameMap = new Map(assignees.map((a) => [a.id, a.name]));
  const openTodos = openTodoGroups
    .map((g) => ({ name: g.assignedToId ? nameMap.get(g.assignedToId) ?? "Unknown" : "Unassigned", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  return {
    steps: milestones.length,
    manualChases,
    autoChases,
    updatesLogged,
    todosAdded,
    todosCompleted,
    chainsBuilt,
    activeChains,
    openEnquiries,
    enquiriesClosed,
    confirmSplit,
    weeklySteps,
    weeklyManualChases,
    openTodos,
  };
}

// ── Clients tab ───────────────────────────────────────────────────────────────

export interface TrialSideFunnel {
  invited: number;
  visited: number;
  engaged: number;
}

export interface TrialClientRow {
  id: string;
  name: string;
  role: "Buyer" | "Seller";
  address: string;
  visits: number;
  minutes: number;
  lastVisited: Date | null;
}

export interface TrialClients {
  totalClients: number; // buyers + sellers on live files
  funnel: TrialSideFunnel; // nested: invited ⊇ visited ⊇ engaged
  installed: number;       // added the portal to their home screen
  notifications: number;   // push notifications on
  bySide: { buyer: TrialSideFunnel; seller: TrialSideFunnel };
  visitsTrial: number;     // portal visit-days since trial start
  messagesTrial: number;   // messages clients sent since trial start
  topClients: TrialClientRow[];
  email: { totalSent: number; delivered: number; opened: number; clicked: number; bouncedFailed: number; openRatePct: number };
}

export async function getTrialClients(agencyId: string, trial: TrialConfig): Promise<TrialClients> {
  const trialStart = new Date(`${trial.startsAt}T00:00:00`);

  const contacts = await commandDb.contact.findMany({
    where: {
      roleType: { in: ["purchaser", "vendor"] as never },
      transaction: { agencyId, isDemo: false, status: { in: ["active", "on_hold"] as never } },
    },
    select: {
      id: true, name: true, roleType: true,
      portalToken: true, lastVisitedPortalAt: true, pwaInstalledAt: true,
      transaction: { select: { propertyAddress: true } },
    },
  });
  const contactIds = contacts.map((c) => c.id);

  const [visitGroups, sessionGroups, pushGroups, visitsTrial, messagesTrial, emailSummary] = await Promise.all([
    contactIds.length
      ? commandDb.portalVisit.groupBy({ by: ["contactId"], where: { contactId: { in: contactIds } }, _count: { _all: true } })
      : [],
    contactIds.length
      ? commandDb.portalTimeSession.groupBy({ by: ["contactId"], where: { contactId: { in: contactIds } }, _sum: { totalEngagedSeconds: true } })
      : [],
    contactIds.length
      ? commandDb.portalPushSubscription.groupBy({ by: ["contactId"], where: { contactId: { in: contactIds } } })
      : [],
    commandDb.portalVisit.count({
      where: { createdAt: { gte: trialStart }, contact: { transaction: { agencyId, isDemo: false } } },
    }),
    commandDb.portalMessage.count({
      where: { fromClient: true, createdAt: { gte: trialStart }, transaction: { agencyId, isDemo: false } },
    }),
    getAgencyEmailLog(agencyId, 1),
  ]);

  const visitMap = new Map(visitGroups.map((g) => [g.contactId, g._count._all]));
  const minutesMap = new Map(sessionGroups.map((g) => [g.contactId, Math.round((g._sum.totalEngagedSeconds ?? 0) / 60)]));
  const pushSet = new Set(pushGroups.map((g) => g.contactId));

  // Same engagement bar as the adoption page: came back (2+ visit-days) or
  // spent 5+ real minutes.
  const engagedOf = (c: (typeof contacts)[number]) =>
    (visitMap.get(c.id) ?? 0) >= 2 || (minutesMap.get(c.id) ?? 0) >= 5;

  const emptyFunnel = (): TrialSideFunnel => ({ invited: 0, visited: 0, engaged: 0 });
  const funnel = emptyFunnel();
  const bySide = { buyer: emptyFunnel(), seller: emptyFunnel() };
  let installed = 0;
  for (const c of contacts) {
    if (!c.portalToken) continue;
    const side = c.roleType === "purchaser" ? bySide.buyer : bySide.seller;
    funnel.invited += 1;
    side.invited += 1;
    if (c.lastVisitedPortalAt) {
      funnel.visited += 1;
      side.visited += 1;
      if (engagedOf(c)) {
        funnel.engaged += 1;
        side.engaged += 1;
      }
    }
    if (c.pwaInstalledAt) installed += 1;
  }

  const topClients: TrialClientRow[] = contacts
    .filter((c) => c.lastVisitedPortalAt)
    .map((c) => ({
      id: c.id,
      name: c.name,
      role: (c.roleType === "purchaser" ? "Buyer" : "Seller") as "Buyer" | "Seller",
      address: c.transaction.propertyAddress,
      visits: visitMap.get(c.id) ?? 0,
      minutes: minutesMap.get(c.id) ?? 0,
      lastVisited: c.lastVisitedPortalAt,
    }))
    .sort((a, b) => b.visits - a.visits || b.minutes - a.minutes)
    .slice(0, 8);

  return {
    totalClients: contacts.length,
    funnel,
    installed,
    notifications: pushSet.size,
    bySide,
    visitsTrial,
    messagesTrial,
    topClients,
    email: {
      totalSent: emailSummary.totalSent,
      delivered: emailSummary.delivered,
      opened: emailSummary.opened,
      clicked: emailSummary.clicked,
      bouncedFailed: emailSummary.bouncedFailed,
      openRatePct: emailSummary.openRatePct,
    },
  };
}

// ── Team tab ──────────────────────────────────────────────────────────────────

export type TeamStatus = "active" | "quiet" | "dormant" | "never";

export interface TeamMemberRow {
  userId: string;
  name: string;
  role: string;
  isInHouseProgressor: boolean;
  image: string | null;
  imageFocusX: number;
  imageFocusY: number;
  joinedAt: Date;          // account created
  lastActive: Date | null; // max of events, file sessions, lastLoginAt
  status: TeamStatus;
  logins7d: number;
  seconds7d: number;
  files7d: number;
  // Trial-to-date contribution counts, attributed to this person
  steps: number;   // milestones they confirmed
  chases: number;  // manual chase messages they sent
  todos: number;   // hand-made to-dos they created
  weeks: number[]; // 12 weekly file-session counts, oldest → newest
}

export interface TrialInviteRow {
  id: string;
  kind: "negotiator" | "director";
  name: string;
  email: string;
  invitedBy: string;
  sentAt: Date;
  status: "accepted" | "pending" | "expired" | "cancelled";
  acceptedAt: Date | null;
}

export interface TrialTeam {
  rosterCount: number;
  signedInCount: number;
  active7dCount: number;
  members: TeamMemberRow[];
  invites: TrialInviteRow[];
}

function teamStatus(lastActive: Date | null, now: number): TeamStatus {
  if (!lastActive) return "never";
  const days = (now - lastActive.getTime()) / DAY_MS;
  if (days < 7) return "active";
  if (days < 14) return "quiet";
  return "dormant";
}

const WEEKS = 12;

export async function getTrialTeam(agencyId: string, trial: TrialConfig): Promise<TrialTeam> {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since12w = new Date(now - WEEKS * 7 * DAY_MS);
  const trialStart = new Date(`${trial.startsAt}T00:00:00`);

  const staff = await commandDb.user.findMany({
    where: {
      agencyId,
      role: { in: STAFF_ROLES as never },
      isDemo: false,
      deactivatedAt: null,
      NOT: { email: { endsWith: TSP_DOMAIN } },
    },
    select: {
      id: true, name: true, role: true, isInHouseProgressor: true,
      image: true, imageFocusX: true, imageFocusY: true,
      createdAt: true, lastLoginAt: true,
    },
  });
  const staffIds = staff.map((s) => s.id);

  const [loginGroups, lastEventGroups, lastSessionGroups, sessions, stepGroups, chaseGroups, todoGroups, negInvites, dirInvites] = await Promise.all([
    staffIds.length
      ? commandDb.event.groupBy({
          by: ["userId"],
          where: { type: "user_logged_in" as never, userId: { in: staffIds }, occurredAt: { gte: since7 } },
          _count: { _all: true },
        })
      : [],
    staffIds.length
      ? commandDb.event.groupBy({ by: ["userId"], where: { agencyId, userId: { in: staffIds } }, _max: { occurredAt: true } })
      : [],
    staffIds.length
      ? commandDb.fileTimeSession.groupBy({ by: ["userId"], where: { userId: { in: staffIds } }, _max: { lastActivityAt: true } })
      : [],
    staffIds.length
      ? commandDb.fileTimeSession.findMany({
          where: { userId: { in: staffIds }, startedAt: { gte: since12w } },
          select: { userId: true, startedAt: true, endedAt: true, totalEngagedSeconds: true, transactionId: true },
        })
      : [],
    commandDb.milestoneCompletion.groupBy({
      by: ["completedById"],
      where: {
        state: "complete" as never,
        reflected: false,
        backfilledCompletion: false,
        completedById: { in: staffIds.length ? staffIds : ["-"] },
        completedAt: { gte: trialStart },
        transaction: { agencyId, isDemo: false },
      },
      _count: { _all: true },
    }),
    commandDb.outboundMessage.groupBy({
      by: ["createdById"],
      where: {
        agencyId,
        purpose: "chase" as never,
        type: "outbound" as never,
        isAutomated: false,
        createdById: { in: staffIds.length ? staffIds : ["-"] },
        createdAt: { gte: trialStart },
      },
      _count: { _all: true },
    }),
    commandDb.manualTask.groupBy({
      by: ["createdById"],
      where: {
        agencyId,
        sourceMessageId: null,
        isPossible: false,
        createdById: { in: staffIds.length ? staffIds : ["-"] },
        createdAt: { gte: trialStart },
      },
      _count: { _all: true },
    }),
    commandDb.negotiatorInvitation.findMany({
      where: { agencyId },
      select: {
        id: true, negotiatorName: true, negotiatorEmail: true, createdAt: true,
        expiresAt: true, acceptedAt: true, cancelledAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    commandDb.directorInvitation.findMany({
      where: { agencyId },
      select: {
        id: true, directorName: true, directorEmail: true, createdAt: true,
        expiresAt: true, acceptedAt: true, cancelledAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const loginMap = new Map(loginGroups.map((g) => [g.userId, g._count._all]));
  const lastEventMap = new Map(lastEventGroups.map((g) => [g.userId, g._max.occurredAt ?? null]));
  const lastSessionMap = new Map(lastSessionGroups.map((g) => [g.userId, g._max.lastActivityAt ?? null]));
  const stepMap = new Map(stepGroups.filter((g) => g.completedById).map((g) => [g.completedById as string, g._count._all]));
  const chaseMap = new Map(chaseGroups.filter((g) => g.createdById).map((g) => [g.createdById as string, g._count._all]));
  const todoMap = new Map(todoGroups.map((g) => [g.createdById, g._count._all]));

  const agg = new Map<string, { seconds: number; files: Set<string>; weeks: number[] }>();
  for (const id of staffIds) agg.set(id, { seconds: 0, files: new Set(), weeks: new Array(WEEKS).fill(0) });
  for (const s of sessions) {
    const a = agg.get(s.userId);
    if (!a) continue;
    const started = s.startedAt.getTime();
    const idx = WEEKS - 1 - Math.min(WEEKS - 1, Math.floor((now - started) / (7 * DAY_MS)));
    if (idx >= 0 && idx < WEEKS) a.weeks[idx] += 1;
    if (started >= now - 7 * DAY_MS) {
      if (s.endedAt && s.totalEngagedSeconds) a.seconds += s.totalEngagedSeconds;
      a.files.add(s.transactionId);
    }
  }

  const later = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);
  const members: TeamMemberRow[] = staff.map((u) => {
    const a = agg.get(u.id)!;
    const lastActive = later(later(lastEventMap.get(u.id) ?? null, lastSessionMap.get(u.id) ?? null), u.lastLoginAt);
    return {
      userId: u.id,
      name: u.name,
      role: u.role as string,
      isInHouseProgressor: u.isInHouseProgressor,
      image: u.image,
      imageFocusX: u.imageFocusX,
      imageFocusY: u.imageFocusY,
      joinedAt: u.createdAt,
      lastActive,
      status: teamStatus(lastActive, now),
      logins7d: loginMap.get(u.id) ?? 0,
      seconds7d: a.seconds,
      files7d: a.files.size,
      steps: stepMap.get(u.id) ?? 0,
      chases: chaseMap.get(u.id) ?? 0,
      todos: todoMap.get(u.id) ?? 0,
      weeks: a.weeks,
    };
  });
  // Champions first: trial contribution, then engaged time, then recency.
  members.sort(
    (x, y) =>
      y.steps + y.chases + y.todos - (x.steps + x.chases + x.todos) ||
      y.seconds7d - x.seconds7d ||
      (y.lastActive?.getTime() ?? 0) - (x.lastActive?.getTime() ?? 0),
  );

  const inviteStatus = (i: { acceptedAt: Date | null; cancelledAt: Date | null; expiresAt: Date }): TrialInviteRow["status"] => {
    if (i.acceptedAt) return "accepted";
    if (i.cancelledAt) return "cancelled";
    if (i.expiresAt.getTime() < now) return "expired";
    return "pending";
  };
  const invites: TrialInviteRow[] = [
    ...negInvites.map((i): TrialInviteRow => ({
      id: i.id, kind: "negotiator", name: i.negotiatorName, email: i.negotiatorEmail,
      invitedBy: i.invitedBy.name, sentAt: i.createdAt, status: inviteStatus(i), acceptedAt: i.acceptedAt,
    })),
    ...dirInvites.map((i): TrialInviteRow => ({
      id: i.id, kind: "director", name: i.directorName, email: i.directorEmail,
      invitedBy: i.invitedBy.name, sentAt: i.createdAt, status: inviteStatus(i), acceptedAt: i.acceptedAt,
    })),
  ].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

  return {
    rosterCount: staff.length,
    signedInCount: staff.filter((s) => s.lastLoginAt !== null).length,
    active7dCount: members.filter((m) => m.status === "active").length,
    members,
    invites,
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
