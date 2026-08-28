import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
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
      vendorSolicitorContact: { select: { name: true, phone: true, email: true, secondaryEmail: true, image: true } },
      purchaserSolicitorContact: { select: { name: true, phone: true, email: true, secondaryEmail: true, image: true } },
      vendorSolicitorFirm: { select: { name: true } },
      purchaserSolicitorFirm: { select: { name: true } },
      vendorSolicitorEmailsPaused: true,
      purchaserSolicitorEmailsPaused: true,
      vendorSolicitorEmailsPausedUntil: true,
      purchaserSolicitorEmailsPausedUntil: true,
    },
  });
  if (!tx) return <InvalidShell />;

  const contact = decoded.side === "vendor" ? tx.vendorSolicitorContact : tx.purchaserSolicitorContact;
  const firstName = contact?.name ? extractFirstName(contact.name) : "";
  const firmName = (decoded.side === "vendor" ? tx.vendorSolicitorFirm?.name : tx.purchaserSolicitorFirm?.name) ?? null;
  const myDetails = {
    name: contact?.name ?? "",
    phone: contact?.phone ?? "",
    email: contact?.email ?? "",
    secondaryEmail: contact?.secondaryEmail ?? "",
    image: contact?.image ?? null,
  };
  const emailsPaused = decoded.side === "vendor" ? tx.vendorSolicitorEmailsPaused : tx.purchaserSolicitorEmailsPaused;
  const pausedUntilRaw = decoded.side === "vendor" ? tx.vendorSolicitorEmailsPausedUntil : tx.purchaserSolicitorEmailsPausedUntil;
  const pausedUntil = pausedUntilRaw && pausedUntilRaw > new Date() ? pausedUntilRaw.toISOString() : null;

  // Design Lab: load the global glass picks (applied for every viewer) + decide
  // if this viewer may edit them (a founder superadmin logged in on the domain).
  const [glassPicks, session] = await Promise.all([getPortalGlassPicks(), getServerSession(authOptions)]);
  const canEditLab = !!session?.user?.email && isHybridSuperadminEmail(session.user.email);

  return (
    <>
      {/* No-flash boot: (a) apply this device's saved accessibility prefs to
          <html> before first paint (SolicitorAppearance keys off these same
          attributes, which the global portal CSS honours), and (b) flag whether
          the first-visit welcome will show, so the cookie banner can hold back
          until it closes (set pre-paint to avoid a mount-order race). */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{var p=JSON.parse(localStorage.getItem('sol_a11y')||'{}');var d=document.documentElement;if(p.textSize&&p.textSize!=='default')d.setAttribute('data-portal-textsize',p.textSize);if(p.dyslexic)d.setAttribute('data-portal-font','dyslexic');if(p.reduceMotion)d.setAttribute('data-portal-motion','reduced');if(localStorage.getItem('sol_welcome_seen')!=='1')d.setAttribute('data-welcome-open','1');}catch(e){}",
        }}
      />
      <PortalGlassProvider initialPicks={glassPicks} canEdit={canEditLab}>
        <SolicitorPortalShell token={token} firstName={firstName} side={decoded.side} emailsPaused={emailsPaused} pausedUntil={pausedUntil} firmName={firmName} myDetails={myDetails}>
          {children}
        </SolicitorPortalShell>
      </PortalGlassProvider>
    </>
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
