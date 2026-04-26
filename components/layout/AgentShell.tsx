"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import {
  FolderOpen, CalendarCheck, ChartBar, BellSimple,
  PlusCircle, Lightning, GearSix, Users, Tray, CheckSquare, Buildings, Gauge,
} from "@phosphor-icons/react";
import { AgentBell } from "@/components/layout/AgentBell";
import { WelcomeModal } from "@/components/agent/WelcomeModal";
import { OnboardingChecklist } from "@/components/agent/OnboardingChecklist";

function buildNavItems(role: UserRole) {
  return [
    { href: "/agent/hub-preview",      label: "Hub",          Icon: Gauge      },
    { href: "/agent/dashboard",        label: role === "director" ? "All Files" : "My Files", Icon: FolderOpen },
    { href: "/agent/completions",      label: "Completions",  Icon: CalendarCheck },
    { href: "/agent/analytics",         label: "Analytics",    Icon: ChartBar      },
    { href: "/agent/comms",            label: "Updates",      Icon: BellSimple    },
    { href: "/agent/work-queue",       label: "Work Queue",   Icon: Tray          },
    { href: "/agent/to-do",            label: "To-Do",        Icon: CheckSquare   },
    { href: "/agent/solicitors",       label: "Solicitors",   Icon: Buildings     },
    { href: "/agent/quick-add",        label: "Quick Add",    Icon: Lightning     },
    { href: "/agent/transactions/new", label: "Full form",    Icon: PlusCircle    },
    { href: "/agent/settings",         label: "Settings",     Icon: GearSix       },
  ];
}

export function AgentShell({ children, session, showWelcome }: { children: React.ReactNode; session: Session; showWelcome?: boolean }) {
  const pathname  = usePathname();
  const role      = session.user.role as UserRole;
  const isDirector = role === "director";
  const navItems  = buildNavItems(role);
  const initials  = session.user.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Warm gradient background */}
      <div aria-hidden="true" style={{
        position: "fixed", inset: 0, zIndex: -1,
        background: "linear-gradient(135deg, #FFF5EC 0%, #FFE8D4 40%, #FFDABD 70%, #FFCBA4 100%)",
      }}>
        {/* Ambient bloom — top right */}
        <div style={{
          position: "absolute", width: 480, height: 480,
          top: -80, right: -80,
          background: "radial-gradient(circle, rgba(255,255,235,0.55) 0%, transparent 70%)",
          animation: "agent-bloom-1 70s cubic-bezier(0.45,0.05,0.55,0.95) infinite",
          borderRadius: "50%",
        }} />
        {/* Ambient bloom — bottom left */}
        <div style={{
          position: "absolute", width: 360, height: 360,
          bottom: -60, left: -60,
          background: "radial-gradient(circle, rgba(255,220,100,0.25) 0%, transparent 70%)",
          animation: "agent-bloom-2 80s cubic-bezier(0.45,0.05,0.55,0.95) infinite",
          borderRadius: "50%",
        }} />
      </div>

      {/* Sidebar */}
      <aside className="agent-glass" style={{
        width: 220, flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", overflowY: "auto",
        borderRadius: 0, borderTop: "none", borderBottom: "none", borderLeft: "none",
        borderRight: "0.5px solid var(--agent-glass-border)",
      }}>

        {/* Brand */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #FF8A65 0%, #FF6B4A 100%)",
              boxShadow: "0 2px 8px rgba(255,107,74,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FolderOpen weight="fill" style={{ width: 16, height: 16, color: "#fff" }} />
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
            <AgentBell userKey={session.user.email ?? session.user.id} />
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(({ href, label, Icon }) => {
            const isActive = pathname === href || (href !== "/agent/dashboard" && pathname.startsWith(href));
            return (
              <Link key={href} href={href}
                className={`agent-nav-item${isActive ? " agent-nav-item-active" : ""}`}>
                <Icon weight={isActive ? "fill" : "regular"} style={{ width: 17, height: 17, flexShrink: 0 }} />
                <span style={{ fontSize: 13 }}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div style={{ padding: "12px 16px 20px", borderTop: "0.5px solid var(--agent-border-subtle)" }}>
          <Link href="/agent/settings" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, textDecoration: "none", borderRadius: 10, padding: "6px 4px", margin: "0 -4px 10px", transition: "background 150ms" }}
            className="hover:bg-black/[0.04]">
            <div className="agent-avatar agent-avatar-sm" style={{ flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {session.user.name}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>
                {isDirector ? "Director" : "Negotiator"}
              </p>
            </div>
            <GearSix weight="regular" style={{ width: 14, height: 14, color: "var(--agent-text-muted)", flexShrink: 0, opacity: 0.6 }} />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="agent-btn-ghost"
            style={{ fontSize: 12, color: "var(--agent-text-muted)", padding: 0, height: "auto", background: "none", border: "none", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minHeight: "100vh" }}>
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
