"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PortalMenuDrawer } from "./PortalMenuDrawer";
import { PortalTopNav } from "./PortalTopNav";
import { PortalBottomNav } from "./PortalBottomNav";
import { PORTAL_NAV_CSS } from "./PortalNavGlass";
import { PortalEditDrawer, type EditDrawerConfig } from "./PortalEditDrawer";
import { PortalOnboardingToasts } from "./PortalOnboardingToasts";
import { PortalPwaPing } from "./PortalPwaPing";
import { PortalWelcomeSheet } from "./PortalWelcomeSheet";
import { extractFirstName } from "@/lib/contacts/displayName";
import { usePortalTimeTracking } from "@/lib/hooks/usePortalTimeTracking";
import { usePortalReadOnly } from "./PortalReadOnlyProvider";

type Props = {
  token: string;
  contactName: string;
  roleType: string;
  propertyAddress: string;
  agencyName: string;
  vapidPublicKey: string;
  // True once the client has dismissed the first-visit welcome sheet (stamped
  // on their Contact). Gates the sheet once-per-person across all their devices.
  welcomeSeen: boolean;
  // Optional signed URL for the property photo. When present renders as a
  // hero image below the header; when null the header sits on its own
  // (no dashed placeholder, no broken state).
  photoUrl?: string | null;
  // Portal Engagement v2 (Phase 1, PR4): count of timeline items newer than the
  // client's previous visit. Drives the unread badge on the Updates tab. Same
  // "new since last visit" definition as the recap + Latest-updates pill.
  unreadCount?: number;
  // Portal Engagement v2 (Phase 2): signals that gate WHEN the install /
  // notification prompts may appear (see PortalOnboardingToasts).
  hasConfirmedStep?: boolean;
  isReturningVisit?: boolean;
  isNearExchange?: boolean;
  children: React.ReactNode;
};

// Greeting that writes on letter by letter, left to right, a beat after the
// page settles. Each character fades + lifts with a staggered delay. Honours
// reduced-motion (OS or the in-app toggle): the line just appears.
function GreetingText({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const rm =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.getAttribute("data-portal-motion") === "reduced";
    setReduced(rm);
    // Let the cards land first, then start writing the greeting on.
    const t = window.setTimeout(() => setRevealed(true), rm ? 0 : 150);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <span aria-label={text}>
      {[...text].map((ch, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            display: "inline-block",
            whiteSpace: "pre",
            opacity: revealed ? 1 : 0,
            transform: revealed ? "translateY(0)" : "translateY(0.24em)",
            transition: reduced
              ? "none"
              : "opacity 560ms cubic-bezier(0.22, 1, 0.36, 1), transform 560ms cubic-bezier(0.22, 1, 0.36, 1)",
            transitionDelay: reduced ? "0ms" : `${i * 40}ms`,
          }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

// NOTE: agencyName is still passed in (Props) but no longer rendered in the
// header — it truncated the greeting. It needs a new home elsewhere in the
// portal (founder, 2026-08-16). Re-add when that lands.
export function PortalShell({ token, contactName, roleType, propertyAddress, vapidPublicKey, welcomeSeen, photoUrl, unreadCount = 0, hasConfirmedStep = false, isReturningVisit = false, isNearExchange = false, children }: Props) {
  const pathname = usePathname();
  const base = `/portal/${token}`;
  const saleWord = roleType === "vendor" ? "sale" : "purchase";

  // Read-only window: an agent is looking through the glass. Suppress every
  // passive tracker (engaged-time, PWA ping, onboarding, first-visit welcome) so
  // viewing trips nothing. Interactive components handle their own guard.
  const readOnly = usePortalReadOnly();

  // Time-of-day greeting for the header. Computed client-side (after mount) so
  // it matches the viewer's local time without a hydration mismatch — until
  // then, and if there's no name, it gracefully falls back to just the name /
  // just the greeting.
  const firstName = extractFirstName(contactName);
  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);
  // Nothing until the greeting resolves after mount — we don't want the bare
  // name flashing on first paint and then jumping to the full greeting. Once
  // it's ready the whole line writes on, letter by letter (GreetingText).
  const greetingLabel = greeting ? (firstName ? `${greeting}, ${firstName}` : greeting) : "";

  // Measure real engaged time the client spends on their portal (audit
  // COMMAND_CENTRE_ADMIN_AUDIT_2026-08-13). Mounts once for the whole portal
  // shell, so it spans every sub-page. No backfill — records from ship forward.
  usePortalTimeTracking(readOnly ? null : token);

  // Menu drawer (hamburger top-right of the header, added 2026-08-09).
  const [menuOpen, setMenuOpen] = useState(false);
  // Deep-link target inside the drawer (audit #16 phase 3): the team card's
  // "Add" dispatches `portal:open-menu` with a section to scroll to.
  const [menuSection, setMenuSection] = useState<string | null>(null);
  const [menuEdit, setMenuEdit] = useState(false);
  // Edit drawer (details / agent / solicitor). When open it stacks ABOVE the
  // settings drawer: settings slides down (pushedDown) but stays logically open,
  // so it restores to exactly where it was when this closes. Opened from the
  // Settings sections and the Overview team card via `portal:open-edit-drawer`.
  // editConfig persists after close so the exit animation keeps its content.
  const [editOpen, setEditOpen] = useState(false);
  const [editConfig, setEditConfig] = useState<EditDrawerConfig | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ section?: string; edit?: boolean }>).detail;
      setMenuSection(detail?.section ?? null);
      setMenuEdit(!!detail?.edit);
      setMenuOpen(true);
    };
    const onEdit = (e: Event) => {
      const cfg = (e as CustomEvent<EditDrawerConfig>).detail;
      if (cfg) { setEditConfig(cfg); setEditOpen(true); }
    };
    window.addEventListener("portal:open-menu", onOpen);
    window.addEventListener("portal:open-edit-drawer", onEdit);
    return () => {
      window.removeEventListener("portal:open-menu", onOpen);
      window.removeEventListener("portal:open-edit-drawer", onEdit);
    };
  }, []);
  // Close the edit drawer on navigation.
  useEffect(() => { setEditOpen(false); }, [pathname]);
  // Close the drawer on navigation — if the user taps a link inside it,
  // the underlying page changes but the drawer would linger without this.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // The top-nav fan taps a section pill → open the drawer to that tab.
  const openMenuTo = (section: string) => { setMenuSection(section); setMenuEdit(false); setMenuOpen(true); };

  // Clear the home screen badge whenever the user opens the portal
  useEffect(() => {
    if ("clearAppBadge" in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [pathname]);

  const isHome     = pathname === base || pathname === base + "/";
  const isProgress = pathname.startsWith(base + "/progress");
  const isUpdates  = pathname.startsWith(base + "/updates");
  // Hide install + push prompts on the chase respond page — the page is
  // a focused single-task UX reached from a chase email, and both prompts
  // (Add to Home Screen, Enable Notifications) compete for attention
  // with the chase items. Also: the browser's PWA install would capture
  // the chase deep-link URL (not the manifest's start_url), which would
  // create a stale home-screen icon. Both prompts still appear on the
  // overview / progress / updates pages where they belong.
  const isRespond  = pathname.startsWith(base + "/respond");

  return (
    <div
      className="min-h-screen portal-scope"
      style={{
        background: "transparent",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif",
      }}
    >
      {/* Ambient wash — fixed layer behind all content (peach + lavender + warm
          halo + cyan over #f6f8fc). Now a themeable class (.portal-ambient in
          globals.css) so dark mode gets a deep-ground variant. Batch 4. */}
      <div aria-hidden className="portal-ambient" />

      {/* Fire-and-forget PWA adoption signal (Command Centre → App adoption).
          Suppressed in the agent window — an agent looking is not a client
          adding the app to their home screen. */}
      {!readOnly && <PortalPwaPing token={token} />}

      {/* Top nav — T8 "expandable corner" (signed off in /dev/portal-preview).
          On the overview it floats OVER the property photo (fixed) so the image
          runs to the very top; elsewhere it's a sticky floating row. A greeting
          pill on the left; a menu on the right that fans the drawer's sections
          as matching glass pills. Bespoke glass (PortalNavGlass), not the Design
          Lab variant. */}
      <div className={isHome ? "fixed top-0 inset-x-0 z-30" : "sticky top-0 z-20"}>
        <div className="max-w-lg mx-auto px-4 pt-3">
          <PortalTopNav
            greeting={greetingLabel ? <GreetingText key={greetingLabel} text={greetingLabel} /> : null}
            onOpenMenu={openMenuTo}
          />
        </div>
      </div>

      {/* Menu drawer */}
      <PortalMenuDrawer
        open={menuOpen}
        pushedDown={editOpen}
        onClose={() => { setMenuOpen(false); setMenuSection(null); setMenuEdit(false); }}
        token={token}
        contactName={contactName}
        contactRole={roleType}
        scrollToSection={menuSection}
        editSolicitor={menuEdit}
      />

      {/* Edit drawer (details / agent / solicitor) — stacks above settings. */}
      <PortalEditDrawer open={editOpen} config={editConfig} token={token} onClose={() => setEditOpen(false)} />

      {/* 2026-08-09 hero rebuild: the property photo is now rendered
          INSIDE the Overview page (components/portal/PortalOverviewHero)
          as a hero-with-overlay carrying address, pills, ring, and the
          6-tile progress row. The shell no longer paints its own photo —
          it would double up with the Overview hero on the home tab and
          look odd elsewhere. Progress + Updates pages get no photo hero,
          which is the intended shape. `photoUrl` prop kept on the shell
          signature for now; unused. Safe to strip in a later cleanup. */}

      {/* Page content */}
      <main className="max-w-lg mx-auto px-4 pt-5 pb-32">
        {children}
      </main>

      {/* Onboarding toasts — replaces the inline PortalInstallPrompt +
          PortalPushPrompt banners. Queued: Install first, then Push if
          Install dismissed. 3s delay after page load. Mobile-only via
          the .lg:hidden gate. See PortalOnboardingToasts for the queue
          logic. 2026-08-09.
          The original PortalInstallPrompt + PortalPushPrompt files
          are kept on disk for revert; unused as of this change. */}
      {/* First-visit welcome (once per client, all viewports). Suppressed in the
          agent window: it would auto-open a modal over the very portal the agent
          wants to see, and dismissing it would stamp "welcome seen" on the
          client. */}
      {!isRespond && !readOnly && (
        <PortalWelcomeSheet token={token} side={roleType === "vendor" ? "vendor" : "purchaser"} alreadySeen={welcomeSeen} />
      )}

      {!isRespond && !readOnly && (
        <div className="lg:hidden">
          <PortalOnboardingToasts
            token={token}
            vapidPublicKey={vapidPublicKey}
            saleWord={saleWord}
            addressShort={propertyAddress.split(",")[0] ?? propertyAddress}
            hasConfirmedStep={hasConfirmedStep}
            isReturningVisit={isReturningVisit}
            isNearExchange={isNearExchange}
            hasFreshUpdate={unreadCount > 0}
          />
        </div>
      )}

      {/* Bottom nav — B5 "magnify dock" (signed off in /dev/portal-preview): a
          floating, centred glass pill clear of the home indicator. The current
          page magnifies into a labelled pill with a lifted, glowing icon; the
          others stay as icons. Real <Link> navigation + the unread badge are
          preserved. The wrapper handles centring + the safe-area inset. */}
      <nav aria-label="Primary" className="fixed bottom-0 inset-x-0 z-20 pnav-bottom-wrap">
        <PortalBottomNav base={base} isHome={isHome} isProgress={isProgress} isUpdates={isUpdates} unreadCount={unreadCount} />
      </nav>

      <style>{PORTAL_NAV_CSS}</style>
    </div>
  );
}

