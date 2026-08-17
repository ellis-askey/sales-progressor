import { commandDb } from "@/lib/command/prisma";

// Command Centre → App adoption. Who, among clients on live files, has turned on
// notifications, added the app to their home screen, and is actually opening the
// portal. Notifications come from stored push subscriptions; PWA from the
// pwaInstalledAt/pwaLastOpenedAt signals; engagement from the time sessions.

const LIVE_STATUSES = ["draft", "active", "on_hold"] as const;

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
};

export type PortalAdoption = {
  totalClients: number;
  notificationsCount: number;
  installedCount: number;
  visitedCount: number;
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
      name: true,
      roleType: true,
      lastVisitedPortalAt: true,
      pwaInstalledAt: true,
      pwaLastOpenedAt: true,
      transaction: { select: { propertyAddress: true, agency: { select: { name: true } } } },
      pushSubscriptions: { select: { id: true }, take: 1 },
      portalTimeSessions: { select: { totalEngagedSeconds: true } },
    },
  });

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
    clients,
  };
}
