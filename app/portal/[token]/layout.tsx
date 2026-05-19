import { notFound } from "next/navigation";
import type { Metadata, Viewport } from "next";
import { getPortalData, logPortalView } from "@/lib/services/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalAutoRefresh } from "@/components/portal/PortalAutoRefresh";
import { prisma } from "@/lib/prisma";
import { trackServerEvent } from "@/lib/analytics/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

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

  let data: Awaited<ReturnType<typeof getPortalData>>;
  try {
    data = await getPortalData(token);
  } catch (err) {
    console.error("[Portal] getPortalData threw:", err);
    notFound();
  }

  if (!data) {
    console.error("[Portal] no data for token:", token);
    notFound();
  }

  const { contact, transaction } = data;

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
      void trackServerEvent(`portal-${contact.id}`, ANALYTICS_EVENTS.PORTAL_VISITED, {
        contactId:     contact.id,
        transactionId: transaction.id,
      });
    }
  })();

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <PortalShell
      token={token}
      contactName={contact.name}
      roleType={contact.roleType}
      propertyAddress={transaction.propertyAddress}
      agencyName={transaction.agencyName}
      vapidPublicKey={vapidPublicKey}
    >
      <PortalAutoRefresh />
      {children}
    </PortalShell>
  );
}
