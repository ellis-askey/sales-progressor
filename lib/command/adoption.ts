import { commandDb } from "@/lib/command/prisma";

// Command Centre → App adoption. Who, among clients on live files, has turned on
// notifications, added the app to their home screen, and is actually opening the
// portal. Notifications come from stored push subscriptions; PWA from the
// pwaInstalledAt/pwaLastOpenedAt signals; engagement from the time sessions.

const LIVE_STATUSES = ["draft", "active", "on_hold"] as const;

// Whether we can actually reach this client by email, and why not if we can't.
// Precedence runs hardest-block first: the top three mean "don't/can't email at
// all"; the two pauses are softer and (for client_paused) temporary.
//   no_email      — no address on file
//   opted_out     — client unsubscribed from everything (Contact.unsubscribedAt)
//   bouncing      — their most recent send bounced or was blocked, undelivered
//   agent_paused  — an agent paused chase emails for them (Contact.emailsPausedAt)
//   client_paused — client's timed "pause for a week" (Contact.chasesPausedUntil)
//   reachable     — none of the above
export type CommsStatusKind =
  | "reachable"
  | "no_email"
  | "opted_out"
  | "bouncing"
  | "agent_paused"
  | "client_paused";

export type CommsStatus = {
  kind: CommsStatusKind;
  // Set only for client_paused — when the timed pause auto-resumes.
  pausedUntil: Date | null;
  // The date behind the status where there is one: opt-out date (opted_out) or
  // the date an agent paused (agent_paused). Null for the other kinds.
  since: Date | null;
};

// The three states where the client hears nothing from us at all.
export function isUnreachable(kind: CommsStatusKind): boolean {
  return kind === "no_email" || kind === "opted_out" || kind === "bouncing";
}

// The outcome of the most recent email we queued to a client — what actually
// happened after we handed it to SendGrid, per the delivery webhook.
export type LastEmailStatus =
  | "delivered"
  | "bounced"
  | "blocked"
  | "deferred"
  | "sent"
  | "pending";

export type LastEmail = {
  type: string;
  at: Date;
  status: LastEmailStatus;
  reason: string | null;
};

// Everything shown when a row is expanded. Kept off the base row so the list
// stays light; computed once here so the client component is pure render.
export type AdoptionClientDetail = {
  email: string | null;
  phone: string | null;
  saleStatus: string;
  lastEmail: LastEmail | null;
  visits: number;
  firstVisitAt: Date | null;
  installedAt: Date | null;
  // Deeper engagement / activation signals — each a simple has-it-or-not.
  welcomeSeen: boolean;
  hasPhoto: boolean;
  customisedOverview: boolean;
  requestedBrokerCallback: boolean;
  gaveExchangeAuthority: boolean;
};

export type AdoptionClient = {
  id: string;
  name: string;
  agencyId: string;
  agencyName: string;
  address: string;
  role: "Buyer" | "Seller";
  notifications: boolean;
  installed: boolean;
  lastOpened: Date | null;
  lastVisited: Date | null;
  engagedMinutes: number;
  comms: CommsStatus;
  detail: AdoptionClientDetail;
};

// A REAL nested engagement funnel: each stage is a strict subset of the one
// above, so bars only ever shrink and the fall between them is genuine drop-off.
// Install + notifications are NOT stages (you can engage without either) — they
// live in AdoptionCapabilities instead.
export type AdoptionFunnel = {
  invited: number; // has portal access at all
  visited: number; // opened the portal at least once (subset of invited)
  engaged: number; // came back or spent real time (subset of visited)
};

// Parallel "how equipped is this client" signals — not funnel stages.
export type AdoptionCapabilities = {
  installed: number;     // added the app to their home screen
  notifications: number; // turned on push notifications
  cantReach: number;     // no email, opted out, or bouncing
};

// Per-agency adoption rollup — the lever for "who drives adoption, who needs help".
export type AgencyAdoptionRow = {
  agencyId: string;
  agencyName: string;
  total: number;
  visited: number;
  engaged: number;
  notifications: number;
};

// Actionable segments — the "what to do next" behind the numbers. All restricted
// to clients we can actually email right now (kind === "reachable").
export type AdoptionPriority = {
  notificationsOff: number;   // reachable, push off — the nudge lever
  neverVisited: number;       // reachable, never opened the portal
  visitedNotEngaged: number;  // reachable, glanced once but didn't come back
};

// "Deeply engaged" = more than a single glance: two or more tracked visits, or
// at least five minutes of real time in the portal. Used for the funnel's last
// stage and the table's "Deeply engaged" filter.
export function isDeeplyEngaged(c: AdoptionClient): boolean {
  return c.detail.visits >= 2 || c.engagedMinutes >= 5;
}

// One week of the growth trend. weekStart is the Monday (UK) of the week.
// invited = clients first added that week; activated = clients whose first
// portal visit fell that week.
export type GrowthWeek = {
  weekStart: Date;
  invited: number;
  activated: number;
};

const GROWTH_WEEKS = 12;

export type PortalAdoption = {
  totalClients: number;
  notificationsCount: number;
  installedCount: number;
  visitedCount: number;
  cantReachCount: number;
  funnel: AdoptionFunnel;
  capabilities: AdoptionCapabilities;
  priority: AdoptionPriority;
  byAgency: AgencyAdoptionRow[];
  growth: GrowthWeek[];
  clients: AdoptionClient[];
};

export async function getPortalAdoption(): Promise<PortalAdoption> {
  const contacts = await commandDb.contact.findMany({
    where: {
      portalToken: { not: null },
      roleType: { in: ["purchaser", "vendor"] },
      // Exclude demo showcase files and internal/test agencies so their fake
      // clients don't inflate the portal-adoption funnel.
      transaction: { status: { in: [...LIVE_STATUSES] }, isDemo: false, agency: { isInternal: false } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      roleType: true,
      lastVisitedPortalAt: true,
      pwaInstalledAt: true,
      pwaLastOpenedAt: true,
      unsubscribedAt: true,
      emailsPausedAt: true,
      chasesPausedUntil: true,
      welcomeSeenAt: true,
      image: true,
      overviewLayout: true,
      brokerCallbackRequestedAt: true,
      exchangeAuthorityGivenAt: true,
      transaction: {
        select: { status: true, propertyAddress: true, agencyId: true, agency: { select: { name: true } } },
      },
      createdAt: true,
      pushSubscriptions: { select: { id: true }, take: 1 },
      portalTimeSessions: { select: { totalEngagedSeconds: true, startedAt: true } },
    },
  });

  const emailStatus = await getEmailStatusByContact(contacts.map((c) => c.id));
  const now = new Date();

  const clients: AdoptionClient[] = contacts.map((c) => {
    const engagedSeconds = c.portalTimeSessions.reduce((s, t) => s + (t.totalEngagedSeconds ?? 0), 0);
    const status = emailStatus.get(c.id);
    const firstVisitAt = c.portalTimeSessions.reduce<Date | null>((min, s) => {
      if (!s.startedAt) return min;
      return min == null || s.startedAt < min ? s.startedAt : min;
    }, null);
    return {
      id: c.id,
      name: c.name,
      agencyId: c.transaction.agencyId,
      agencyName: c.transaction.agency?.name ?? "—",
      address: c.transaction.propertyAddress ?? "—",
      role: c.roleType === "vendor" ? "Seller" : "Buyer",
      notifications: c.pushSubscriptions.length > 0,
      installed: c.pwaInstalledAt != null,
      lastOpened: c.pwaLastOpenedAt,
      lastVisited: c.lastVisitedPortalAt,
      engagedMinutes: Math.round(engagedSeconds / 60),
      comms: resolveCommsStatus({
        email: c.email,
        unsubscribedAt: c.unsubscribedAt,
        emailsPausedAt: c.emailsPausedAt,
        chasesPausedUntil: c.chasesPausedUntil,
        bouncing: status?.bouncing ?? false,
        now,
      }),
      detail: {
        email: c.email,
        phone: c.phone,
        saleStatus: c.transaction.status,
        lastEmail: status?.lastEmail ?? null,
        visits: c.portalTimeSessions.length,
        firstVisitAt,
        installedAt: c.pwaInstalledAt,
        welcomeSeen: c.welcomeSeenAt != null,
        hasPhoto: c.image != null,
        customisedOverview: c.overviewLayout != null,
        requestedBrokerCallback: c.brokerCallbackRequestedAt != null,
        gaveExchangeAuthority: c.exchangeAuthorityGivenAt != null,
      },
    };
  });

  // Most-engaged first: installed, then notifications on, then most recent visit.
  clients.sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1;
    if (a.notifications !== b.notifications) return a.notifications ? -1 : 1;
    return (b.lastVisited?.getTime() ?? 0) - (a.lastVisited?.getTime() ?? 0);
  });

  const notificationsCount = clients.filter((c) => c.notifications).length;
  const installedCount = clients.filter((c) => c.installed).length;
  const visitedCount = clients.filter((c) => c.lastVisited != null).length;
  const engagedCount = clients.filter(isDeeplyEngaged).length;

  // Actionable segments — only clients we can email right now.
  const reachable = clients.filter((c) => c.comms.kind === "reachable");
  const priority: AdoptionPriority = {
    notificationsOff: reachable.filter((c) => !c.notifications).length,
    neverVisited: reachable.filter((c) => c.lastVisited == null).length,
    visitedNotEngaged: reachable.filter((c) => c.lastVisited != null && !isDeeplyEngaged(c)).length,
  };

  // Per-agency rollup — the lever for "who drives adoption".
  const byAgencyMap = new Map<string, AgencyAdoptionRow>();
  for (const c of clients) {
    const row = byAgencyMap.get(c.agencyId) ?? { agencyId: c.agencyId, agencyName: c.agencyName, total: 0, visited: 0, engaged: 0, notifications: 0 };
    row.total += 1;
    if (c.lastVisited != null) row.visited += 1;
    if (isDeeplyEngaged(c)) row.engaged += 1;
    if (c.notifications) row.notifications += 1;
    byAgencyMap.set(c.agencyId, row);
  }
  // Worst engagement first (most clients but fewest engaged), so the agencies
  // that need help rise to the top.
  const byAgency = [...byAgencyMap.values()].sort(
    (a, b) => (a.engaged / a.total) - (b.engaged / b.total) || b.total - a.total,
  );

  const firstVisitById = new Map(clients.map((c) => [c.id, c.detail.firstVisitAt]));
  const growth = computeWeeklyGrowth(
    contacts.map((c) => ({ createdAt: c.createdAt, firstVisitAt: firstVisitById.get(c.id) ?? null })),
    now,
  );

  return {
    totalClients: clients.length,
    notificationsCount,
    installedCount,
    visitedCount,
    cantReachCount: clients.filter((c) => isUnreachable(c.comms.kind)).length,
    funnel: {
      invited: clients.length,
      visited: visitedCount,
      engaged: engagedCount,
    },
    capabilities: {
      installed: installedCount,
      notifications: notificationsCount,
      cantReach: clients.filter((c) => isUnreachable(c.comms.kind)).length,
    },
    priority,
    byAgency,
    growth,
    clients,
  };
}

// Monday-00:00 (local) of the week containing d.
function weekStartOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const mondayOffset = (x.getDay() + 6) % 7; // Sun=0 -> 6, Mon=1 -> 0, ...
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

// Bucket clients into the last GROWTH_WEEKS weeks by when they were invited
// (createdAt) and when they first visited. Dates older than the window are
// dropped. Weeks with no activity stay in the series as zeros so the trend
// keeps a steady x-axis.
function computeWeeklyGrowth(
  rows: { createdAt: Date; firstVisitAt: Date | null }[],
  now: Date,
): GrowthWeek[] {
  const thisWeek = weekStartOf(now);
  const weeks: GrowthWeek[] = [];
  const indexByTime = new Map<number, number>();
  for (let i = GROWTH_WEEKS - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    indexByTime.set(start.getTime(), weeks.length);
    weeks.push({ weekStart: start, invited: 0, activated: 0 });
  }

  const bump = (d: Date | null, key: "invited" | "activated") => {
    if (!d) return;
    const idx = indexByTime.get(weekStartOf(d).getTime());
    if (idx != null) weeks[idx][key]++;
  };
  for (const r of rows) {
    bump(r.createdAt, "invited");
    bump(r.firstVisitAt, "activated");
  }
  return weeks;
}

// Resolve the single comms status for a contact, hardest block first. A client
// can be several of these at once (e.g. opted out AND paused); we surface the
// one that most affects whether they hear from us.
function resolveCommsStatus(args: {
  email: string | null;
  unsubscribedAt: Date | null;
  emailsPausedAt: Date | null;
  chasesPausedUntil: Date | null;
  bouncing: boolean;
  now: Date;
}): CommsStatus {
  if (!args.email || args.email.trim() === "") return { kind: "no_email", pausedUntil: null, since: null };
  if (args.unsubscribedAt != null) return { kind: "opted_out", pausedUntil: null, since: args.unsubscribedAt };
  if (args.bouncing) return { kind: "bouncing", pausedUntil: null, since: null };
  if (args.emailsPausedAt != null) return { kind: "agent_paused", pausedUntil: null, since: args.emailsPausedAt };
  if (args.chasesPausedUntil != null && args.chasesPausedUntil > args.now) {
    return { kind: "client_paused", pausedUntil: args.chasesPausedUntil, since: null };
  }
  return { kind: "reachable", pausedUntil: null, since: null };
}

type ContactEmailStatus = { bouncing: boolean; lastEmail: LastEmail | null };

// The most recent email we queued to each contact, and what happened to it. A
// contact is "bouncing" when that latest send bounced or was blocked and no
// later send has been delivered — mail to that address is currently dying. We
// read each contact's latest queue row (by createdAt) and classify it. Contacts
// with no queued mail are absent from the map.
async function getEmailStatusByContact(contactIds: string[]): Promise<Map<string, ContactEmailStatus>> {
  const out = new Map<string, ContactEmailStatus>();
  if (contactIds.length === 0) return out;
  const rows = await commandDb.outboundEmailQueue.findMany({
    where: { recipientContactId: { in: contactIds } },
    select: {
      recipientContactId: true,
      emailType: true,
      createdAt: true,
      sentAt: true,
      deliveredAt: true,
      deferredAt: true,
      bouncedAt: true,
      bouncedReason: true,
      blockedAt: true,
      blockedReason: true,
    },
    orderBy: { createdAt: "desc" },
  });
  for (const row of rows) {
    const id = row.recipientContactId;
    if (!id || out.has(id)) continue; // only the latest row per contact
    const { status, reason } = classifyQueueRow(row);
    out.set(id, {
      bouncing: status === "bounced" || status === "blocked",
      lastEmail: { type: row.emailType, at: row.sentAt ?? row.createdAt, status, reason },
    });
  }
  return out;
}

function classifyQueueRow(row: {
  sentAt: Date | null;
  deliveredAt: Date | null;
  deferredAt: Date | null;
  bouncedAt: Date | null;
  bouncedReason: string | null;
  blockedAt: Date | null;
  blockedReason: string | null;
}): { status: LastEmailStatus; reason: string | null } {
  if (row.bouncedAt != null) return { status: "bounced", reason: row.bouncedReason };
  if (row.blockedAt != null) return { status: "blocked", reason: row.blockedReason };
  if (row.deliveredAt != null) return { status: "delivered", reason: null };
  if (row.deferredAt != null) return { status: "deferred", reason: null };
  if (row.sentAt != null) return { status: "sent", reason: null };
  return { status: "pending", reason: null };
}
