"use client";

// Experimental agent chrome — Ellis-only (gated in app/agent/layout.tsx).
// Two shortlisted desktop shells behind a small persisted switcher:
//   · Floating drawers  — nav hides behind a left-edge handle; a floating glass
//     capsule carries search + the top-bar cluster.
//   · Compact command bar — one floating bar; hover "Menu" drops the nav; the
//     content reclaims the full width.
//
// This is a UI change ONLY. Every functional part is the REAL production piece:
// AgentNavRail (+ buildNavGroups, so the nav can't drift), AgentGlobalSearch,
// ViewModeToggle, the refresh control, ThemeModeToggle, AuroraOpacityControl,
// DesignLabToggle, AgentBell, UserDropdown, the real .agent-newsale-cta markup,
// Recently-viewed, QuickActionDock, AppPathRecorder, PullToRefresh and the
// welcome/onboarding modals — identical destinations, permissions and toggles to
// AgentShell. Only the surrounding shell shape is new. Old (Phosphor) icons, as
// the app ships — no Solar wrapper. See AgentShell for the baseline.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, type ReactNode, type HTMLAttributes } from "react";
import type { UserRole } from "@prisma/client";
import {
  List, X, Plus, ArrowsClockwise, ClockCounterClockwise,
} from "@phosphor-icons/react";
import { LiquidGlass } from "@/components/quick-dock/LiquidGlass";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";
import { DesignLabToggle } from "@/components/glass/DesignLabToggle";
import { AuroraOpacityControl } from "@/components/agent/AuroraOpacityControl";
import { AgentNavRail } from "@/components/layout/AgentNavRail";
import { AgentBell } from "@/components/layout/AgentBell";
import { AgentGlobalSearch } from "@/components/layout/AgentGlobalSearch";
import { ViewModeToggle } from "@/components/layout/ViewModeToggle";
import { WelcomeModal } from "@/components/agent/WelcomeModal";
import { OnboardingChecklist } from "@/components/agent/OnboardingChecklist";
import { AppPathRecorder } from "@/components/agent/AppPathRecorder";
import { PullToRefresh } from "@/components/agent/PullToRefresh";
import { BrandMark } from "@/components/brand/BrandMark";
import { FounderProvider } from "@/components/layout/FounderGate";
import { QuickActionDock } from "@/components/quick-dock/QuickActionDock";
import { ShellGlassProvider, useShellGlass } from "@/lib/agent/shell-glass";
import { ShellGlassLabToggle } from "@/components/layout/ShellGlassLab";
import { useRecentlyViewed } from "@/lib/agent/use-recently-viewed";
import { useDarkMode } from "@/lib/agent/use-theme";
import { getNavBadgeCountsAction } from "@/app/actions/nav-badges";
import { NAV_BADGES_REFRESH_EVENT } from "@/lib/agent/nav-badges-client";
import {
  buildNavGroups, UserDropdown, DESIGN_LAB_EMAILS, type AgentShellProps,
} from "@/components/layout/AgentShell";
import "@/app/agent/styles/shell-experimental.css";

type ShellKind = "drawers" | "compact";
const STORE_KEY = "agx-shell";

// Same material + fallback conditions as the bottom QuickActionDock: iOS / Safari
// / Firefox can't run the refraction filter, so they get the frosted blur.
function detectFallback(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|android|crios|fxios|edg|opr).)*safari/i.test(ua);
  const firefox = /firefox|fxios/i.test(ua);
  return iOS || safari || firefox;
}

function formatAgentTime(d: Date): string {
  try {
    return d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "--:--";
  }
}

export function AgentShellExperimental(props: AgentShellProps) {
  const {
    children, session, showWelcome, suppressSimpleWelcome = false, userName, userImage,
    themeMode, backgroundOpacity = 100, agencyModeProfile, progressorName = null,
    hasSelfManagedFiles = true, todoDueCount = 0, enquiriesOpenCount = 0, remindersCount = 0,
    chainsCount = 0, completionsCount = 0, agentBellClearedAt = null, showClientsNav = false,
    isBusinessMember = false, businessMemberHasClients = true, canMigrateSale = false,
    canToggleViewAll = false, fileViewMode = "all",
  } = props;

  const pathname = usePathname();
  const router = useRouter();
  const role = session.user.role as UserRole;
  const displayName = userName ?? session.user.name ?? "";
  const isInternalStaff = role === "admin" || role === "sales_progressor";
  const isFounderDock = (session.user.email ?? "").toLowerCase().trim() === "ellis@thesalesprogressor.co.uk";

  const [badges, setBadges] = useState({ todo: todoDueCount, enquiries: enquiriesOpenCount, reminders: remindersCount, chains: chainsCount, completions: completionsCount });
  const navGroups = buildNavGroups(role, session.user.email, hasSelfManagedFiles, badges.todo, badges.enquiries, badges.reminders, badges.chains, badges.completions, showClientsNav);
  const SHOW_MIGRATE_SALE_NAV = true;

  const [shell, setShell] = useState<ShellKind>("drawers");
  const [navOpen, setNavOpen] = useState(false);   // drawers: the left drawer
  const [menuOpen, setMenuOpen] = useState(false);  // compact: the hover menu
  const [refreshedAt, setRefreshedAt] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [fallback, setFallback] = useState(false);
  const recentlyViewed = useRecentlyViewed(5, session.user.id);
  const { isDark } = useDarkMode(themeMode);

  // Persisted per-device shell choice (read after mount to avoid a hydration
  // mismatch; one-frame default→saved settle is fine for a personal preview).
  useEffect(() => {
    const s = typeof window !== "undefined" ? window.localStorage.getItem(STORE_KEY) : null;
    if (s === "compact" || s === "drawers") setShell(s);
    setFallback(detectFallback());
  }, []);
  function chooseShell(k: ShellKind) {
    setNavOpen(false); setMenuOpen(false); setShell(k);
    try { window.localStorage.setItem(STORE_KEY, k); } catch { /* ignore */ }
  }

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [navOpen]);

  // Badge counts — mirror AgentShell exactly so numbers behave identically.
  useEffect(() => {
    setBadges({ todo: todoDueCount, enquiries: enquiriesOpenCount, reminders: remindersCount, chains: chainsCount, completions: completionsCount });
  }, [todoDueCount, enquiriesOpenCount, remindersCount, chainsCount, completionsCount]);
  const firstNavRef = useRef(true);
  useEffect(() => {
    if (firstNavRef.current) { firstNavRef.current = false; return; }
    let live = true;
    getNavBadgeCountsAction().then((c) => { if (live && c) setBadges(c); }).catch(() => {});
    return () => { live = false; };
  }, [pathname]);
  useEffect(() => {
    let live = true;
    const refetch = () => getNavBadgeCountsAction().then((c) => { if (live && c) setBadges(c); }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") refetch(); };
    window.addEventListener(NAV_BADGES_REFRESH_EVENT, refetch);
    document.addEventListener("visibilitychange", onVisible);
    return () => { live = false; window.removeEventListener(NAV_BADGES_REFRESH_EVENT, refetch); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    setTimeout(() => { setRefreshedAt(new Date()); setRefreshing(false); }, 300);
  }

  // ── The right-hand control cluster (identical in both shells) ──
  const topControls = (
    <div className="agx-controls">
      {canToggleViewAll && (
        <div className="hidden md:block"><ViewModeToggle initialMode={fileViewMode} /></div>
      )}
      <button onClick={handleRefresh} disabled={refreshing} title="Refresh data" className="agent-hover-ctl agx-asof" type="button">
        <span style={{ display: "inline-flex", animation: refreshing ? "agent-spin 700ms linear infinite" : undefined }}><ArrowsClockwise size={13} /></span>
        <span className="agx-asof-txt" suppressHydrationWarning>{`As of ${formatAgentTime(refreshedAt)}`}</span>
      </button>
      {/* Theme + account stay visible at every width: V2 has no mobile sidebar
          footer to carry them (unlike AgentShell), so the floating bar is the
          only home for them. */}
      <ThemeModeToggle initialMode={themeMode} />
      <div className="hidden md:block"><AuroraOpacityControl initialOpacity={backgroundOpacity} /></div>
      {session.user.email && DESIGN_LAB_EMAILS.has(session.user.email) && (
        <div className="hidden md:block"><DesignLabToggle /></div>
      )}
      {session.user.email && DESIGN_LAB_EMAILS.has(session.user.email) && (
        <div className="hidden md:block"><ShellGlassLabToggle /></div>
      )}
      <AgentBell initialClearedAt={agentBellClearedAt} />
      <UserDropdown session={session} role={role} userName={displayName} userImage={userImage} isBusinessOwner={showClientsNav} isBusinessMember={isBusinessMember} />
    </div>
  );

  // ── Brand + New-sale + nav + recents (drawer body / compact menu body) ──
  const navPanel = (onNavigate?: () => void) => (
    <>
      <div className="agx-brand">
        <BrandMark size={32} />
        <div className="agx-brand-text">
          <p className="agx-brand-name">Sales Progressor</p>
          {session.user.firmName && <p className="agx-brand-firm">{session.user.firmName}</p>}
        </div>
      </div>
      <div className="agx-side-body">
        {SHOW_MIGRATE_SALE_NAV && canMigrateSale && (() => {
          const isMigrate = pathname.startsWith("/agent/transactions/migrate");
          return (
            <Link href="/agent/transactions/migrate" prefetch onClick={onNavigate} className={`agent-newsale-cta${isMigrate ? " is-active" : ""}`} title="Migrate a sale">
              <span className="agent-newsale-badge" aria-hidden><ArrowsClockwise size={14} weight="bold" color="#fff" /></span>
              <span className="agent-newsale-label">Migrate sale</span>
            </Link>
          );
        })()}
        {(() => {
          if (isBusinessMember && !showClientsNav && !businessMemberHasClients) return null;
          const isNewSale = pathname.startsWith("/agent/transactions/new");
          return (
            <Link href="/agent/transactions/new" prefetch onClick={onNavigate} className={`agent-newsale-cta${isNewSale ? " is-active" : ""}`} title="New sale">
              <span className="agent-newsale-badge" aria-hidden><Plus size={14} weight="bold" color="#fff" /></span>
              <span className="agent-newsale-label">New sale</span>
            </Link>
          );
        })()}
        <AgentNavRail items={navGroups.main} pathname={pathname} onNavigate={onNavigate} />
        <div className="agx-nav-div" />
        <AgentNavRail items={navGroups.secondary} pathname={pathname} onNavigate={onNavigate} />
        {recentlyViewed.length > 0 && (
          <div className="agx-recents">
            <div className="agx-nav-div" />
            <p className="agx-recents-title">Recently viewed</p>
            {recentlyViewed.map((entry) => {
              const isActive = pathname.startsWith(`/agent/transactions/${entry.id}`);
              return (
                <Link key={entry.id} href={`/agent/transactions/${entry.id}`} unstable_dynamicOnHover onClick={onNavigate} className={`agent-nav-item${isActive ? " agent-nav-item-active" : ""}`}>
                  <ClockCounterClockwise weight="regular" style={{ width: 15, height: 15, flexShrink: 0, opacity: 0.6 }} />
                  <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.address}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <ShellGlassProvider>
    <div className="agent-shell-root agx-root" data-theme="custom" data-shell={shell}>
      {shell === "drawers"
        ? <DrawersChrome navOpen={navOpen} setNavOpen={setNavOpen} fallback={fallback} isDark={isDark} controls={topControls} navPanel={navPanel} />
        : <CompactChrome menuOpen={menuOpen} setMenuOpen={setMenuOpen} fallback={fallback} isDark={isDark} controls={topControls} navPanel={navPanel} />}

      <AppPathRecorder />
      <PullToRefresh />

      <main className="agent-main-content agx-main">
        <FounderProvider value={isFounderDock}>{children}</FounderProvider>
      </main>

      <QuickActionDock />

      {/* Persisted shell switcher — bottom-left so it clears the bottom dock. */}
      <aside className="agx-switcher" aria-label="Shell preview">
        <span className="agx-switcher-label">Shell</span>
        <div className="agx-switcher-opts" role="radiogroup" aria-label="Shell layout">
          <button type="button" role="radio" aria-checked={shell === "drawers"} className={shell === "drawers" ? "on" : ""} onClick={() => chooseShell("drawers")}>Drawers</button>
          <button type="button" role="radio" aria-checked={shell === "compact"} className={shell === "compact" ? "on" : ""} onClick={() => chooseShell("compact")}>Compact</button>
        </div>
      </aside>

      {showWelcome && !suppressSimpleWelcome && <WelcomeModal agencyModeProfile={agencyModeProfile ?? "self_progressed"} userName={displayName} progressorName={progressorName} />}
      {!isInternalStaff && !showWelcome && <OnboardingChecklist userId={session.user.id} role={role} />}
    </div>
    </ShellGlassProvider>
  );
}

// Glass wrapper — real refraction, frosted fallback (same conditions as the
// bottom QuickActionDock). Module-scoped so its identity is stable across renders
// (an inner component would remount the LiquidGlass canvas every render).
function AgxGlass({ fallback, isDark, radius = 20, className = "", children, ...rest }: HTMLAttributes<HTMLDivElement> & { fallback: boolean; isDark: boolean; radius?: number; children: ReactNode }) {
  // Live knobs from the Shell Glass Lab (Ellis-only tuner). Defaults === the
  // shipped look, so untouched this renders exactly as before.
  const { settings } = useShellGlass();
  const r = Math.round(radius * settings.radiusScale);
  if (fallback) {
    const bf = `blur(${settings.frostBlur}px) saturate(190%)`;
    return <div className={`agx-frost ${className}`} style={{ borderRadius: r, backdropFilter: bf, WebkitBackdropFilter: bf }} {...rest}>{children}</div>;
  }
  return <LiquidGlass radius={r} blur={settings.blur} thickness={settings.thickness} displace={settings.displace} aberration={settings.aberration} tint={isDark ? settings.tintDark : settings.tintLight} className={className} {...rest}>{children}</LiquidGlass>;
}

type ChromeShared = { fallback: boolean; isDark: boolean; controls: ReactNode; navPanel: (onNavigate?: () => void) => ReactNode };

// ── Floating drawers ──────────────────────────────────────────────────────────
function DrawersChrome({ navOpen, setNavOpen, fallback, isDark, controls, navPanel }: ChromeShared & { navOpen: boolean; setNavOpen: (v: boolean) => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!navOpen) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("a,button,input,[tabindex]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setNavOpen(false); } };
    const onDown = (e: MouseEvent) => {
      // Keep the drawer open while the Shell Glass Lab is in use — it's portalled
      // to <body>, so a click inside it would otherwise read as "outside".
      if ((e.target as HTMLElement).closest?.("[data-shell-glass-lab]")) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && !handleRef.current?.contains(e.target as Node)) setNavOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown, true); (prev ?? handleRef.current)?.focus?.(); };
  }, [navOpen, setNavOpen]);

  return (
    <>
      <div className="agx-cap-wrap">
        <AgxGlass fallback={fallback} isDark={isDark} radius={19} className="agx-cap">
          <div className="agx-cap-search"><AgentGlobalSearch /></div>
          <span className="agx-sep" />
          {controls}
        </AgxGlass>
      </div>
      <button ref={handleRef} className="agx-edge-handle" type="button" aria-expanded={navOpen} aria-label="Open navigation" onClick={() => setNavOpen(true)}><List weight="bold" /></button>
      {navOpen && <div className="agx-scrim" aria-hidden onClick={() => setNavOpen(false)} />}
      <div ref={panelRef} className={`agx-drawer${navOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Navigation" aria-hidden={!navOpen}>
        <AgxGlass fallback={fallback} isDark={isDark} radius={24} className="agx-drawer-glass">
          {navPanel(() => setNavOpen(false))}
          <button className="agx-icon-btn agx-drawer-close" type="button" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X weight="bold" /></button>
        </AgxGlass>
      </div>
    </>
  );
}

// ── Compact command bar (nav opens on hover) ───────────────────────────────────
function CompactChrome({ menuOpen, setMenuOpen, fallback, isDark, controls, navPanel }: ChromeShared & { menuOpen: boolean; setMenuOpen: (v: boolean) => void }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const open = () => { window.clearTimeout(closeTimer.current); setMenuOpen(true); };
  const scheduleClose = () => { closeTimer.current = window.setTimeout(() => setMenuOpen(false), 140); };

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setMenuOpen(false); btnRef.current?.focus(); } };
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.("[data-shell-glass-lab]")) return;
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("mousedown", onDown, true); };
  }, [menuOpen, setMenuOpen]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  return (
    <div className="agx-cmd-wrap">
      <AgxGlass fallback={fallback} isDark={isDark} radius={19} className="agx-cmd">
        <div ref={regionRef} className="agx-cmd-region" onMouseEnter={open} onMouseLeave={scheduleClose}>
          <button ref={btnRef} className="agx-cmd-menu" type="button" aria-expanded={menuOpen} aria-haspopup="menu"
            onClick={() => { if (menuOpen) { setMenuOpen(false); } else { open(); requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("a,button")?.focus()); } }}>
            <List weight="bold" /><span>Menu</span>
          </button>
          <div ref={panelRef} className={`agx-cmd-panel${menuOpen ? " open" : ""}`} role="menu" aria-label="Navigation" aria-hidden={!menuOpen}>
            <AgxGlass fallback={fallback} isDark={isDark} radius={20} className="agx-cmd-panel-glass">{navPanel(() => setMenuOpen(false))}</AgxGlass>
          </div>
        </div>
        <span className="agx-sep" />
        <div className="agx-cmd-search"><AgentGlobalSearch /></div>
        <span className="agx-cmd-spacer" />
        {controls}
      </AgxGlass>
    </div>
  );
}
