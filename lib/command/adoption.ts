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
};

// The three states where the client hears nothing from us at all.
export function isUnreachable(kind: CommsStatusKind): boolean {
  return kind === "no_email" || kind === "opted_out" || kind === "bouncing";
}

export type AdoptionClient = {
  name: string;
  agencyName: string;
  address: string;
  role: "Buyer" | "Seller";
  notifications: boolean;
  installed: boolean;
  lastOpened: Date | null;
  lastVisited: Date | null;
  engagedMinutes: number;
  comms: CommsStatus;
};

export type PortalAdoption = {
  totalClients: number;
  notificationsCount: number;
  installedCount: number;
  visitedCount: number;
  cantReachCount: number;
  clients: AdoptionClient[];
};

export async function getPortalAdoption(): Promise<PortalAdoption> {
  const contacts = await commandDb.contact.findMany({
    where: {
      portalToken: { not: null },
      roleType: { in: ["purchaser", "vendor"] },
      transaction: { status: { in: [...LIVE_STATUSES] } },
    },
    select: {
      id: true,
      name: true,
      email: true,
      roleType: true,
      lastVisitedPortalAt: true,
      pwaInstalledAt: true,
      pwaLastOpenedAt: true,
      unsubscribedAt: true,
      emailsPausedAt: true,
      chasesPausedUntil: true,
      transaction: { select: { propertyAddress: true, agency: { select: { name: true } } } },
      pushSubscriptions: { select: { id: true }, take: 1 },
      portalTimeSessions: { select: { totalEngagedSeconds: true } },
    },
  });

  const bouncingContactIds = await getBouncingContactIds(contacts.map((c) => c.id));
  const now = new Date();

  const clients: AdoptionClient[] = contacts.map((c) => {
    const engagedSeconds = c.portalTimeSessions.reduce((s, t) => s + (t.totalEngagedSeconds ?? 0), 0);
    return {
      name: c.name,
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
        bouncing: bouncingContactIds.has(c.id),
        now,
      }),
    };
  });

  // Most-engaged first: installed, then notifications on, then most recent visit.
  clients.sort((a, b) => {
    if (a.installed !== b.installed) return a.installed ? -1 : 1;
    if (a.notifications !== b.notifications) return a.notifications ? -1 : 1;
    return (b.lastVisited?.getTime() ?? 0) - (a.lastVisited?.getTime() ?? 0);
  });

  return {
    totalClients: clients.length,
    notificationsCount: clients.filter((c) => c.notifications).length,
    installedCount: clients.filter((c) => c.installed).length,
    visitedCount: clients.filter((c) => c.lastVisited != null).length,
    cantReachCount: clients.filter((c) => isUnreachable(c.comms.kind)).length,
    clients,
  };
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
  if (!args.email || args.email.trim() === "") return { kind: "no_email", pausedUntil: null };
  if (args.unsubscribedAt != null) return { kind: "opted_out", pausedUntil: null };
  if (args.bouncing) return { kind: "bouncing", pausedUntil: null };
  if (args.emailsPausedAt != null) return { kind: "agent_paused", pausedUntil: null };
  if (args.chasesPausedUntil != null && args.chasesPausedUntil > args.now) {
    return { kind: "client_paused", pausedUntil: args.chasesPausedUntil };
  }
  return { kind: "reachable", pausedUntil: null };
}

// A contact is "bouncing" when the most recent email we queued to them bounced
// or was blocked and no later send has been delivered — i.e. mail to that
// address is currently dying. We look at each contact's latest queue row (by
// createdAt): if it carries bouncedAt/blockedAt, they're bouncing. Contacts
// with no queued mail (or a clean latest row) are absent from the set.
async function getBouncingContactIds(contactIds: string[]): Promise<Set<string>> {
  if (contactIds.length === 0) return new Set();
  const rows = await commandDb.outboundEmailQueue.findMany({
    where: { recipientContactId: { in: contactIds } },
    select: { recipientContactId: true, createdAt: true, bouncedAt: true, blockedAt: true },
    orderBy: { createdAt: "desc" },
  });
  const bouncing = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    const id = row.recipientContactId;
    if (!id || seen.has(id)) continue; // only the latest row per contact
    seen.add(id);
    if (row.bouncedAt != null || row.blockedAt != null) bouncing.add(id);
  }
  return bouncing;
}
