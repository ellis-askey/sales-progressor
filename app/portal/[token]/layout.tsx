import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { getServerSession } from "next-auth";
import { getPortalData, getPortalTimeline, logPortalView } from "@/lib/services/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalAutoRefresh } from "@/components/portal/PortalAutoRefresh";
import { DeadRoundNotice } from "@/components/portal/DeadRoundNotice";
import { prisma } from "@/lib/prisma";
import { toUKDateStr } from "@/lib/utils";
import { recordPortalEvent } from "@/lib/services/portal-events";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { authOptions } from "@/lib/auth";
import { isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";
import { getPortalGlassPicks } from "@/lib/glass/portal-picks";
import { PortalGlassProvider } from "@/lib/glass/portal-context";
import { PortalSettingsProvider } from "@/components/portal/PortalSettingsProvider";
import { parsePortalSettings, portalSettingsBootScript } from "@/lib/portal/settings";
// Glass variant classes for the founder-only portal Design Lab. Light-theme
// glass tokens are re-declared on .portal-scope in globals.css.
import "@/app/styles/glass.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FF6B4A",
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return {
    manifest: `/api/portal/manifest/${token}`,
    appleWebApp: {
      capable: true,
      title: "My Property",
      statusBarStyle: "default",
    },
  };
}

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let result: Awaited<ReturnType<typeof getPortalData>>;
  try {
    result = await getPortalData(token);
  } catch (err) {
    console.error("[Portal] getPortalData threw:", err);
    notFound();
  }

  if (!result) {
    console.error("[Portal] no data for token:", token);
    notFound();
  }

  // Phase 1 commit 5 — dead-round friendly notice. Renders inside the
  // portal shell so the link "explains itself" instead of returning 404,
  // which a buyer might interpret as the file being lost or hidden from
  // them. Triggered by belt-and-braces guard:
  //   contact.buyerRoundId !== tx.activeBuyerRoundId on a purchaser contact.
  // Vendor contacts never go dead.
  if (result.kind === "deadRound") {
    return (
      <DeadRoundNotice
        contactName={result.contactName}
        agencyName={result.agencyName}
        address={result.address}
      />
    );
  }

  const { contact, transaction } = result.data;

  // Client appearance/accessibility settings (Batch 4). Applied to <html>
  // pre-paint by the boot script (no flash), then managed live by the provider.
  const portalSettings = parsePortalSettings((contact as { portalSettings?: unknown }).portalSettings);

  // Log portal view and update last-visited timestamp (fire-and-forget — never blocks render)
  // Both run from layout so they fire on every sub-page (progress, updates, etc.), not just root.
  logPortalView(token).catch(() => {});
  void (async () => {
    const row = await prisma.contact.findUnique({
      where: { id: contact.id },
      select: { lastVisitedPortalAt: true },
    }).catch(() => null);
    const now = new Date();
    const msSinceLastVisit = row?.lastVisitedPortalAt
      ? now.getTime() - row.lastVisitedPortalAt.getTime()
      : Infinity;
    if (msSinceLastVisit > 5 * 60 * 1000) {
      await prisma.contact.update({
        where: { id: contact.id },
        data:  { lastVisitedPortalAt: now },
      }).catch(() => {});
      // One row per contact per UK day (audit #6). Idempotent via the
      // unique (contactId, day) index — the risk engine reads this history
      // to spot a client who was engaged and then went quiet.
      const day = toUKDateStr(now);
      // Was today already logged? Drives the "returned on a new day" signal below.
      const alreadyToday = await prisma.portalVisit.findUnique({
        where:  { contactId_day: { contactId: contact.id, day } },
        select: { contactId: true },
      }).catch(() => null);
      await prisma.portalVisit.upsert({
        where:  { contactId_day: { contactId: contact.id, day } },
        create: { contactId: contact.id, day },
        update: {},
      }).catch(() => {});
      void trackServerEvent(`portal-${contact.id}`, ANALYTICS_EVENTS.PORTAL_VISITED, {
        contactId:     contact.id,
        transactionId: transaction.id,
      });
      // Portal Engagement v2 (Phase 1): a genuine RETURN — the first open of a
      // NEW UK day when they've already visited on at least one prior day. Fires
      // at most once per new day, so it means "came back", not "opened again".
      if (!alreadyToday) {
        const priorDays = await prisma.portalVisit
          .count({ where: { contactId: contact.id, day: { not: day } } })
          .catch(() => 0);
        if (priorDays >= 1) {
          void recordPortalEvent("portal_returned", contact.id, { visitDay: day, priorDays });
        }
      }
    }
  })();

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  // Portal Engagement v2 (Phase 1, PR4): unread count for the Updates-tab badge.
  // Same "new since last visit" definition as the recap + Latest-updates pill
  // (timeline entries created after the client's previous visit). Read before the
  // fire-and-forget visit stamp above updates it, so it reflects the prior visit.
  // Best-effort — the badge just doesn't show if this throws.
  const viewerSide: "vendor" | "purchaser" = contact.roleType === "vendor" ? "vendor" : "purchaser";
  const lastVisitAt = (contact as { lastVisitedPortalAt?: Date | null }).lastVisitedPortalAt ?? null;
  let unreadCount = 0;
  if (lastVisitAt) {
    const tl = await getPortalTimeline(transaction.id, viewerSide, contact.id, {
      buyerRoundId: (contact as { buyerRoundId?: string | null }).buyerRoundId ?? null,
      activeBuyerRoundId: transaction.activeBuyerRoundId,
    }).catch(() => []);
    unreadCount = tl.filter((e) => e.createdAt && new Date(e.createdAt) > new Date(lastVisitAt)).length;
  }

  // Portal Engagement v2 (Phase 2): signals that gate WHEN the install /
  // notification prompts appear. hasConfirmedStep = they've confirmed a step via
  // their portal (a value moment); isReturningVisit = 2nd+ visit day;
  // isNearExchange = a predicted/expected exchange date within ~4 weeks.
  const [confirmedCount, visitCount] = await Promise.all([
    prisma.milestoneCompletion.count({ where: { confirmedByContactId: contact.id } }).catch(() => 0),
    prisma.portalVisit.count({ where: { contactId: contact.id } }).catch(() => 0),
  ]);
  const hasConfirmedStep = confirmedCount > 0;
  const isReturningVisit = visitCount >= 2;
  const exDate =
    (transaction as { overridePredictedDate?: Date | null }).overridePredictedDate ??
    (transaction as { expectedExchangeDate?: Date | null }).expectedExchangeDate ??
    null;
  const msToExchange = exDate ? new Date(exDate).getTime() - Date.now() : null;
  const isNearExchange = msToExchange != null && msToExchange > 0 && msToExchange <= 28 * 86400000;

  // Founder-only Design Lab: read the global glass picks (applied for every
  // client) and decide if this viewer may edit them. Gate is the agent session
  // on the same domain — clients have no session, so they only ever see the
  // applied styles, never the flask button.
  const [glassPicks, session] = await Promise.all([
    getPortalGlassPicks(),
    getServerSession(authOptions),
  ]);
  const canEditLab = !!session?.user?.email && isHybridSuperadminEmail(session.user.email);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: portalSettingsBootScript(portalSettings) }} />
      <PortalSettingsProvider token={token} initial={portalSettings}>
        <PortalGlassProvider initialPicks={glassPicks} canEdit={canEditLab}>
          <PortalShell
            token={token}
            contactName={contact.name}
            roleType={contact.roleType}
            propertyAddress={transaction.propertyAddress}
            agencyName={transaction.agencyName}
            vapidPublicKey={vapidPublicKey}
            welcomeSeen={!!(contact as { welcomeSeenAt?: Date | null }).welcomeSeenAt}
            photoUrl={transaction.photoUrl ?? null}
            unreadCount={unreadCount}
            hasConfirmedStep={hasConfirmedStep}
            isReturningVisit={isReturningVisit}
            isNearExchange={isNearExchange}
          >
            <PortalAutoRefresh />
            {children}
          </PortalShell>
        </PortalGlassProvider>
      </PortalSettingsProvider>
    </>
  );
}
