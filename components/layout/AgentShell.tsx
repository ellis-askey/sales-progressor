"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { UserAvatar } from "@/components/ui/Avatar";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import type { AgentTheme } from "@/lib/agent/themes";
import {
  FolderOpen, CalendarCheck, ChartBar, BellSimple,
  PlusCircle, GearSix, Users, Tray, CheckSquare, Buildings, Gauge, List, X,
  ClockCounterClockwise, CaretDown, ArrowsClockwise,
} from "@phosphor-icons/react";
import { AgentBell } from "@/components/layout/AgentBell";
import { AgentGlobalSearch } from "@/components/layout/AgentGlobalSearch";
import { WelcomeModal } from "@/components/agent/WelcomeModal";
import { OnboardingChecklist } from "@/components/agent/OnboardingChecklist";
import { useRecentlyViewed } from "@/lib/agent/use-recently-viewed";

function formatAgentTime(d: Date): string {
  try {
    return d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return "--:--";
  }
}

function buildNavGroups(role: UserRole) {
  return {
    main: [
      { href: "/agent/hub",         label: "Hub",         Icon: Gauge         },
      { href: "/agent/work-queue",  label: "Reminders",   Icon: Tray          },
      { href: "/agent/completions", label: "Completions", Icon: CalendarCheck },
      { href: "/agent/to-do",       label: "To-Do",       Icon: CheckSquare   },
      { href: "/agent/comms",       label: "Updates",     Icon: BellSimple    },
      { href: "/agent/dashboard",   label: role === "director" ? "All Files" : "My Files", Icon: FolderOpen },
      { href: "/agent/analytics",   label: "Analytics",   Icon: ChartBar      },
    ],
    secondary: [
      { href: "/agent/partners",    label: "Partners",    Icon: Buildings     },
    ],
  };
}

function UserDropdown({ session, isDirector }: { session: Session; isDirector: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "white", border: "0.5px solid rgba(0,0,0,0.12)",
          borderRadius: 999, padding: "4px 10px 4px 4px",
          cursor: "pointer", transition: "background 150ms, box-shadow 150ms",
        }}
        className="hover:bg-black/[0.04]"
        aria-label="User menu"
        aria-expanded={open}
      >
        <UserAvatar user={{ name: session.user.name ?? "" }} size={26} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {session.user.name}
        </span>
        <CaretDown
          weight="bold"
          style={{
            width: 11, height: 11, color: "var(--agent-text-muted)", flexShrink: 0,
            transition: "transform 150ms",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          minWidth: 200, borderRadius: 12, overflow: "hidden",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(40px)",
          border: "0.5px solid var(--agent-glass-border)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          zIndex: 200,
        }}>
          <div style={{ padding: "12px 14px 10px" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              {session.user.name}
            </p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>
              {isDirector ? "Director" : "Negotiator"}
            </p>
          </div>
          <div style={{ height: "0.5px", background: "var(--agent-border-subtle)" }} />
          <div style={{ padding: "6px 6px" }}>
            <Link
              href="/agent/settings"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "8px 10px", borderRadius: 8,
                textDecoration: "none", color: "var(--agent-text-primary)", fontSize: 13,
                transition: "background 150ms",
              }}
              className="hover:bg-black/[0.05]"
            >
              <GearSix weight="regular" style={{ width: 15, height: 15, color: "var(--agent-text-muted)" }} />
              Settings
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                display: "flex", width: "100%", alignItems: "center", gap: 9,
                padding: "8px 10px", borderRadius: 8, textAlign: "left",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--agent-text-secondary)", fontSize: 13,
                transition: "background 150ms",
              }}
              className="hover:bg-black/[0.05]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentShell({ children, session, showWelcome, theme }: { children: React.ReactNode; session: Session; showWelcome?: boolean; theme: AgentTheme }) {
  const pathname    = usePathname();
  const router      = useRouter();
  const role        = session.user.role as UserRole;
  const isDirector  = role === "director";
  const navGroups   = buildNavGroups(role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<Date>(() => new Date());
  const recentlyViewed = useRecentlyViewed(5);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  function handleRefresh() {
    router.refresh();
    setRefreshedAt(new Date());
  }

  return (
    <div className="agent-shell-root" data-theme={theme} style={{ display: "flex" }}>

      {/* Aurora background */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: -1,
        background: "var(--agent-bg-base)",
        overflow: "hidden",
      }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <defs>
            <filter id="agent-plasma">
              <feTurbulence type="turbulence" baseFrequency="0.009 0.006" numOctaves={4} seed={5}>
                <animate attributeName="baseFrequency" dur="32s" values="0.009 0.006; 0.014 0.010; 0.007 0.012; 0.011 0.007; 0.009 0.006" repeatCount="indefinite" />
              </feTurbulence>
              <feColorMatrix type="saturate" values="0" />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#agent-plasma)" opacity={0.08} />
        </svg>
        <div style={{ position: "absolute", top: "-8%", left: "-22%", width: "144%", height: 380, borderRadius: "50%", background: "var(--agent-aurora-band1)", filter: "blur(80px)", mixBlendMode: "multiply", animation: "agent-aurora-down-a 13s ease-in-out infinite", willChange: "transform" }} />
        <div style={{ position: "absolute", top: "28%", left: "-22%", width: "144%", height: 340, borderRadius: "50%", background: "var(--agent-aurora-band2)", filter: "blur(80px)", mixBlendMode: "multiply", animation: "agent-aurora-up-b 19s ease-in-out infinite", animationDelay: "-6s", willChange: "transform" }} />
        <div style={{ position: "absolute", top: "55%", left: "-22%", width: "144%", height: 360, borderRadius: "50%", background: "var(--agent-aurora-band3)", filter: "blur(80px)", mixBlendMode: "multiply", animation: "agent-aurora-down-c 15s ease-in-out infinite", animationDelay: "-9s", willChange: "transform" }} />
      </div>

      {/* Sticky nav bar */}
      <header className="agent-topbar">
        <button
          className="agent-topbar-hamburger"
          onClick={() => setMobileOpen(true)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--agent-text-secondary)", marginRight: 4, flexShrink: 0 }}
          aria-label="Open menu"
        >
          <List weight="regular" style={{ width: 20, height: 20 }} />
        </button>

        <div style={{ flex: 1, maxWidth: 480 }}>
          <AgentGlobalSearch />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", paddingLeft: 12 }}>
          <button
            onClick={handleRefresh}
            title="Refresh data"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--agent-text-muted)", fontSize: 11,
              padding: "4px 8px", borderRadius: 6, transition: "background 150ms",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
            className="hover:bg-black/[0.04]"
          >
            <ArrowsClockwise size={13} />
            {`As of ${formatAgentTime(refreshedAt)}`}
          </button>
          <AgentBell userKey={session.user.email ?? session.user.id} />
          <UserDropdown session={session} isDirector={isDirector} />
        </div>
      </header>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="agent-mobile-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — full viewport height, owns the left column */}
      <aside
        className={`agent-glass agent-sidebar-mobile agent-sidebar-height${mobileOpen ? " agent-sidebar-mobile-open" : ""}`}
        style={{
          width: 220, flexShrink: 0, display: "flex", flexDirection: "column",
          position: "fixed", left: 0, overflowY: "auto",
          borderRadius: 0, borderTop: "none", borderBottom: "none", borderLeft: "none",
          borderRight: "0.5px solid var(--agent-glass-border)",
          zIndex: 100,
        }}
      >
        {/* Brand */}
        <div style={{ padding: "16px 20px 14px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%)",
              boxShadow: "0 2px 8px rgba(var(--agent-coral-rgb), 0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FolderOpen weight="fill" style={{ width: 16, height: 16, color: "var(--agent-text-on-coral)" }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>
                Sales Progressor
              </p>
              {session.user.firmName && (
                <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {session.user.firmName}
                </p>
              )}
            </div>
            <button
              className="agent-sidebar-close"
              onClick={() => setMobileOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--agent-text-muted)" }}
              aria-label="Close menu"
            >
              <X weight="regular" style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {/* New sale CTA */}
          {(() => {
            const isNewSale = pathname.startsWith("/agent/transactions/new");
            return (
              <Link
                href="/agent/transactions/new"
                onClick={() => setMobileOpen(false)}
                className={isNewSale ? "agent-nav-item agent-nav-item-active" : undefined}
                style={isNewSale ? { marginBottom: 6, fontWeight: 600 } : {
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 12px", borderRadius: 10, marginBottom: 6,
                  textDecoration: "none", fontSize: 13, fontWeight: 600,
                  color: "var(--agent-coral-deep)",
                  background: "rgba(var(--agent-coral-rgb), 0.10)",
                  border: "1px solid rgba(var(--agent-coral-rgb), 0.22)",
                }}
              >
                <PlusCircle weight={isNewSale ? "fill" : "fill"} style={{ width: 16, height: 16, flexShrink: 0, color: isNewSale ? undefined : "var(--agent-coral)" }} />
                New sale
              </Link>
            );
          })()}

          {/* Main nav group */}
          {navGroups.main.map(({ href, label, Icon }) => {
            const isActive = pathname === href || (href !== "/agent/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                onClick={() => setMobileOpen(false)}
                className={`agent-nav-item${isActive ? " agent-nav-item-active" : ""}`}>
                <Icon weight={isActive ? "fill" : "regular"} style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span style={{ fontSize: 13 }}>{label}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div style={{ height: "0.5px", background: "var(--agent-border-subtle)", margin: "6px 0" }} />

          {/* Secondary nav group */}
          {navGroups.secondary.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                onClick={() => setMobileOpen(false)}
                className={`agent-nav-item${isActive ? " agent-nav-item-active" : ""}`}>
                <Icon weight={isActive ? "fill" : "regular"} style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span style={{ fontSize: 13 }}>{label}</span>
              </Link>
            );
          })}

          {/* Recently viewed */}
          {recentlyViewed.length > 0 && (
            <>
              <div style={{ height: "0.5px", background: "var(--agent-border-subtle)", margin: "6px 0" }} />
              <p style={{ margin: "0 0 4px 4px", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                Recently viewed
              </p>
              {recentlyViewed.map((entry) => {
                const isActive = pathname.startsWith(`/agent/transactions/${entry.id}`);
                return (
                  <Link
                    key={entry.id}
                    href={`/agent/transactions/${entry.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`agent-nav-item${isActive ? " agent-nav-item-active" : ""}`}
                  >
                    <ClockCounterClockwise weight="regular" style={{ width: 15, height: 15, flexShrink: 0, opacity: 0.6 }} />
                    <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.address}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <main className="agent-main-content" style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>

      {showWelcome && <WelcomeModal name={session.user.name ?? ""} />}
      <OnboardingChecklist userId={session.user.id} />
    </div>
  );
}

// Kept for external references
export function TeamIcon({ className }: { className?: string }) {
  return <Users className={className} weight="regular" />;
}
