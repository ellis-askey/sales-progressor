import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@/lib/supabase-storage";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { extractFirstName } from "@/lib/contacts/displayName";
import { authOptions } from "@/lib/auth";
import { isHybridSuperadminEmail } from "@/lib/security/hybrid-emails";
import { getPortalGlassPicks } from "@/lib/glass/portal-picks";
import { PortalGlassProvider } from "@/lib/glass/portal-context";
import { SolicitorPortalShell } from "../SolicitorPortalShell";
import { S } from "../ui";
// Glass variant classes for the founder-only Design Lab (light-theme tokens are
// re-declared on .portal-scope, which the shell carries).
import "@/app/styles/glass.css";

export const dynamic = "force-dynamic";

// Chrome for the solicitor portal tabs (Overview / Progress / Updates). Loads
// the greeting name + the MOS for the menu, then wraps the tab pages in the
// shell. The stop + qr routes live outside this group, so they keep no chrome.
export default async function SolicitorPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = verifySolicitorToken(token);
  if (!decoded) return <InvalidShell />;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: {
      id: true,
      vendorSolicitorContact: { select: { name: true } },
      purchaserSolicitorContact: { select: { name: true } },
      vendorSolicitorEmailsPaused: true,
      purchaserSolicitorEmailsPaused: true,
    },
  });
  if (!tx) return <InvalidShell />;

  const contact = decoded.side === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
  const firstName = contact?.name ? extractFirstName(contact.name) : "";
  const emailsPaused = decoded.side === "vendor" ? tx.vendorSolicitorEmailsPaused : tx.purchaserSolicitorEmailsPaused;

  const mosDoc = await prisma.transactionDocument.findFirst({
    where: { transactionId: tx.id, source: "mos" },
    select: { filename: true, storagePath: true },
    orderBy: { createdAt: "desc" },
  });
  const mosUrl = mosDoc ? await getSignedUrl(mosDoc.storagePath).catch(() => null) : null;

  // Design Lab: load the global glass picks (applied for every viewer) + decide
  // if this viewer may edit them (a founder superadmin logged in on the domain).
  const [glassPicks, session] = await Promise.all([getPortalGlassPicks(), getServerSession(authOptions)]);
  const canEditLab = !!session?.user?.email && isHybridSuperadminEmail(session.user.email);

  return (
    <PortalGlassProvider initialPicks={glassPicks} canEdit={canEditLab}>
      <SolicitorPortalShell token={token} firstName={firstName} mosUrl={mosUrl} mosFilename={mosDoc?.filename ?? null} emailsPaused={emailsPaused}>
        {children}
      </SolicitorPortalShell>
    </PortalGlassProvider>
  );
}

function InvalidShell() {
  return (
    <div style={{ minHeight: "100svh", background: S.bgBottom, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "-apple-system, sans-serif" }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: S.ink, margin: "0 0 8px" }}>This link is not valid</p>
        <p style={{ fontSize: 14, color: S.muted, margin: 0, lineHeight: 1.6 }}>The link may have expired or been mistyped. Please reply to the email you received and we&rsquo;ll send a fresh one.</p>
      </div>
    </div>
  );
}
