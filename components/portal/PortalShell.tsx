"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { List, House, ClockCounterClockwise, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";
import { PortalMenuDrawer } from "./PortalMenuDrawer";
import { PortalEditDrawer, type EditDrawerConfig } from "./PortalEditDrawer";
import { PortalOnboardingToasts } from "./PortalOnboardingToasts";
import { PortalPwaPing } from "./PortalPwaPing";
import { PortalWelcomeSheet } from "./PortalWelcomeSheet";
import { extractFirstName } from "@/lib/contacts/displayName";
import { usePortalTimeTracking } from "@/lib/hooks/usePortalTimeTracking";
import { usePortalPick } from "@/lib/glass/portal-context";
import { classFor } from "@/lib/glass/variants";

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
    const t = window.setTimeout(() => setRevealed(true), rm ? 0 : 320);
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
export function PortalShell({ token, contactName, roleType, propertyAddress, vapidPublicKey, welcomeSeen, photoUrl, children }: Props) {
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
  // Nothing until the greeting resolves after mount — we don't want the bare
  // name flashing on first paint and then jumping to the full greeting. Once
  // it's ready the whole line writes on, letter by letter (GreetingText).
  const greetingLabel = greeting ? (firstName ? `${greeting}, ${firstName}` : greeting) : "";

  // Measure real engaged time the client spends on their portal (audit
  // COMMAND_CENTRE_ADMIN_AUDIT_2026-08-13). Mounts once for the whole portal
  // shell, so it spans every sub-page. No backfill — records from ship forward.
  usePortalTimeTracking(token);

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

      {/* Fire-and-forget PWA adoption signal (Command Centre → App adoption). */}
      <PortalPwaPing token={token} />

      {/* Top header. On the overview it floats OVER the property photo
          (transparent, with a soft top scrim for legibility) so the image runs
          to the very top; elsewhere it's a solid sticky bar. A picked glass
          variant overrides the surface. Left: a time-of-day greeting. Right:
          the agency name + the menu. */}
      <div
        className={`${isHome ? "fixed top-0 inset-x-0 z-30" : "sticky top-0 z-20"} ${classFor(topNavPick ?? "v04")}`}
        data-glass-id="portal-topnav"
        data-glass-label="Top nav bar"
        data-glass-variant={topNavPick ?? "v04"}
      >
        <div className="max-w-lg mx-auto px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Greeting (left) */}
            <p
              className="text-[17px] font-semibold truncate"
              style={{ color: P.textPrimary, textShadow: isHome ? "0 1px 2px rgba(255,255,255,0.7)" : undefined }}
            >
              {greetingLabel && <GreetingText key={greetingLabel} text={greetingLabel} />}
            </p>
            {/* Menu (right). Agency name removed for now — it truncated the
                greeting; it needs a new home elsewhere in the portal. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              {/* Design Lab flask hidden 2026-08-16 (founder) — glass picks
                  stay live; re-add <PortalDesignLab /> here to reopen the picker
                  before we bake the final JSON. */}
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
      {/* First-visit welcome (once per client, all viewports). */}
      {!isRespond && (
        <PortalWelcomeSheet token={token} side={roleType === "vendor" ? "vendor" : "purchaser"} alreadySeen={welcomeSeen} />
      )}

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
        className={`fixed bottom-0 inset-x-0 z-20 ${classFor(bottomNavPick ?? "v04")}`}
        data-glass-id="portal-bottomnav"
        data-glass-label="Bottom nav bar"
        data-glass-variant={bottomNavPick ?? "v04"}
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
          // Accent-hued glow behind the icon when active. Follows the
          // client's chosen accent (--portal-primary) so it isn't stuck coral.
          boxShadow: active
            ? "0 0 24px color-mix(in srgb, var(--portal-primary, #FF6B4A) 35%, transparent)"
            : "none",
          transform: active ? "scale(1.1)" : "scale(1)",
          transition: "transform 220ms cubic-bezier(0.16, 1, 0.3, 1), color 150ms ease, box-shadow 200ms ease",
        }}
      >
        {icon === "home"     && <House size={22} weight={active ? "fill" : "regular"} />}
        {icon === "progress" && <ClockCounterClockwise size={22} weight={active ? "fill" : "regular"} />}
        {icon === "updates"  && <ChatCircle size={22} weight={active ? "fill" : "regular"} />}
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

