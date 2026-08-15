"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { List } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";
import { PortalMenuDrawer } from "./PortalMenuDrawer";
import { PortalOnboardingToasts } from "./PortalOnboardingToasts";
import { extractFirstName } from "@/lib/contacts/displayName";
import { usePortalTimeTracking } from "@/lib/hooks/usePortalTimeTracking";
import { PortalDesignLab } from "./PortalDesignLab";
import { usePortalPick } from "@/lib/glass/portal-context";
import { classFor } from "@/lib/glass/variants";

type Props = {
  token: string;
  contactName: string;
  roleType: string;
  propertyAddress: string;
  agencyName: string;
  vapidPublicKey: string;
  // Optional signed URL for the property photo. When present renders as a
  // hero image below the header; when null the header sits on its own
  // (no dashed placeholder, no broken state).
  photoUrl?: string | null;
  children: React.ReactNode;
};

// NOTE: agencyName is still passed in (Props) but no longer rendered in the
// header — it truncated the greeting. It needs a new home elsewhere in the
// portal (founder, 2026-08-16). Re-add when that lands.
export function PortalShell({ token, contactName, roleType, propertyAddress, vapidPublicKey, photoUrl, children }: Props) {
  const pathname = usePathname();
  const base = `/portal/${token}`;

  // Design Lab: the two nav bars are tagged surfaces too, so a founder pick
  // restyles them live. No pick → the current chrome.
  const topNavPick = usePortalPick("portal-topnav");
  const bottomNavPick = usePortalPick("portal-bottomnav");

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
  const greetingLabel = greeting && firstName ? `${greeting}, ${firstName}` : greeting || firstName || "";

  // Measure real engaged time the client spends on their portal (audit
  // COMMAND_CENTRE_ADMIN_AUDIT_2026-08-13). Mounts once for the whole portal
  // shell, so it spans every sub-page. No backfill — records from ship forward.
  usePortalTimeTracking(token);

  // Menu drawer (hamburger top-right of the header, added 2026-08-09).
  const [menuOpen, setMenuOpen] = useState(false);
  // Deep-link target inside the drawer (audit #16 phase 3): the team card's
  // "Add" dispatches `portal:open-menu` with a section to scroll to.
  const [menuSection, setMenuSection] = useState<string | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => {
      const section = (e as CustomEvent<{ section?: string }>).detail?.section ?? null;
      setMenuSection(section);
      setMenuOpen(true);
    };
    window.addEventListener("portal:open-menu", onOpen);
    return () => window.removeEventListener("portal:open-menu", onOpen);
  }, []);
  // Close the drawer on navigation — if the user taps a link inside it,
  // the underlying page changes but the drawer would linger without this.
  useEffect(() => { setMenuOpen(false); }, [pathname]);

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
      {/* Ambient wash — the agent app's light fallback background (peach +
          lavender + warm halo + cyan sheen over #f6f8fc, see
          app/styles/elevra.css light theme). Rendered as a fixed layer behind
          all content so cards + hero sit on the same subtle wash the agent app
          uses, instead of flat #F8F9FB. Blooms are faint (0.16–0.30 alpha) and
          pinned to the viewport. Added 2026-08-15 per founder request. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          backgroundColor: "#f6f8fc",
          backgroundImage: [
            "radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%)",
            "radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%)",
            "radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%)",
            "radial-gradient(85% 60% at 50% 96%, rgba(255,208,176,0.30), transparent 75%)",
          ].join(","),
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Top header. On the overview it floats OVER the property photo
          (transparent, with a soft top scrim for legibility) so the image runs
          to the very top; elsewhere it's a solid sticky bar. A picked glass
          variant overrides the surface. Left: a time-of-day greeting. Right:
          the agency name + the menu. */}
      <div
        className={`${isHome ? "fixed top-0 inset-x-0 z-30" : "sticky top-0 z-20"}${topNavPick ? ` ${classFor(topNavPick)}` : ""}`}
        data-glass-id="portal-topnav"
        data-glass-label="Top nav bar"
        data-glass-variant={topNavPick ?? "v00"}
        style={
          topNavPick
            ? undefined
            : isHome
              ? { background: "linear-gradient(180deg, rgba(248,249,251,0.72) 0%, rgba(248,249,251,0.28) 55%, rgba(248,249,251,0) 100%)" }
              : { background: "#FFFFFF", boxShadow: P.shadowSm }
        }
      >
        <div className="max-w-lg mx-auto px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Greeting (left) */}
            <p
              className="text-[17px] font-semibold truncate"
              style={{ color: P.textPrimary, textShadow: isHome ? "0 1px 2px rgba(255,255,255,0.7)" : undefined }}
            >
              {greetingLabel}
            </p>
            {/* Menu (right). Agency name removed for now — it truncated the
                greeting; it needs a new home elsewhere in the portal. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              {/* Founder-only Design Lab flask (renders null for clients) */}
              <PortalDesignLab />
              {/* Hamburger — opens the menu drawer. Borderless, same 34px tap. */}
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                aria-expanded={menuOpen}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: "none",
                  background: "transparent",
                  color: P.textPrimary,
                  cursor: "pointer",
                }}
              >
                <List size={18} weight="regular" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Menu drawer */}
      <PortalMenuDrawer
        open={menuOpen}
        onClose={() => { setMenuOpen(false); setMenuSection(null); }}
        token={token}
        contactName={contactName}
        contactRole={roleType}
        scrollToSection={menuSection}
      />

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
      {!isRespond && (
        <div className="lg:hidden">
          <PortalOnboardingToasts token={token} vapidPublicKey={vapidPublicKey} />
        </div>
      )}

      {/* Bottom tab bar — Elevra-style (2026-08-09): blur backdrop
          instead of solid white, hairline top border instead of rounded
          shadow. Active tab shows a coral glow behind the icon + the
          icon scales up gently. Same 3 tabs, same icons, same labels. */}
      <nav
        aria-label="Primary"
        className={`fixed bottom-0 inset-x-0 z-20${bottomNavPick ? ` ${classFor(bottomNavPick)}` : ""}`}
        data-glass-id="portal-bottomnav"
        data-glass-label="Bottom nav bar"
        data-glass-variant={bottomNavPick ?? "v00"}
        style={bottomNavPick ? undefined : {
          background: "rgba(255, 255, 255, 0.82)",
          borderTop: "0.5px solid rgba(15, 23, 42, 0.08)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        }}
      >
        <div className="max-w-lg mx-auto">
          <ul className="grid grid-cols-3 px-2 py-1 m-0 list-none">
            <li className="relative"><TabItem href={base}               active={isHome}     icon="home"     label="Overview" /></li>
            <li className="relative"><TabItem href={`${base}/progress`} active={isProgress} icon="progress" label="Progress" /></li>
            <li className="relative"><TabItem href={`${base}/updates`}  active={isUpdates}  icon="updates"  label="Updates" /></li>
          </ul>
          {/* iOS home-indicator inset */}
          <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
        </div>
      </nav>
    </div>
  );
}

function TabItem({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: "home" | "progress" | "updates";
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl"
    >
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: 32,
          height: 32,
          color: active ? P.primary : P.textMuted,
          // Elevra's "shadow-glowAccent" — accent-hued glow behind the
          // icon when active. Coral for the portal (P.primary).
          boxShadow: active
            ? "0 0 24px rgba(255, 107, 74, 0.35)"
            : "none",
          transform: active ? "scale(1.1)" : "scale(1)",
          transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), color 150ms ease, box-shadow 200ms ease",
        }}
      >
        {icon === "home"     && <HomeIcon     active={active} />}
        {icon === "progress" && <ProgressIcon active={active} />}
        {icon === "updates"  && <UpdatesIcon  active={active} />}
      </span>
      <span
        className="text-[10px] font-semibold"
        style={{
          color: active ? P.primary : P.textMuted,
          transition: "color 150ms ease",
        }}
      >
        {label}
      </span>
    </Link>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <>
          <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15"/>
          <polyline points="12 6 12 12 16 14"/>
          <circle cx="12" cy="12" r="10"/>
        </>
      ) : (
        <>
          <polyline points="12 6 12 12 16 14"/>
          <circle cx="12" cy="12" r="10"/>
        </>
      )}
    </svg>
  );
}

function UpdatesIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill={active ? "currentColor" : "none"} opacity={active ? "0.15" : "1"}/>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );
}
