"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "next-auth";
import type { UserRole } from "@prisma/client";
import {
  FolderOpen, CalendarCheck, ChartBar, BellSimple, PlusCircle, House, GearSix, Users,
} from "@phosphor-icons/react";
import { AgentBell } from "@/components/layout/AgentBell";

function buildNavItems(role: UserRole) {
  return [
    { href: "/agent/dashboard",   label: role === "director" ? "All Files" : "My Files", icon: FilesIcon },
    { href: "/agent/completions", label: "Completions",  icon: CompletingIcon },
    { href: "/agent/analytics",   label: "Analytics",    icon: AnalyticsIcon },
    { href: "/agent/comms",       label: "Updates",      icon: CommsIcon },
    { href: "/agent/transactions/new", label: "New File", icon: PlusIcon },
    { href: "/agent/settings",    label: "Settings",     icon: SettingsIcon },
  ];
}

export function AgentShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session;
}) {
  const pathname = usePathname();
  const role = session.user.role as UserRole;
  const isDirector = role === "director";
  const navItems = buildNavItems(role);

  return (
    <div className="flex min-h-screen">
      <div className="fixed inset-0 -z-10" style={{
        background: "linear-gradient(rgba(8,12,25,0.52), rgba(6,10,22,0.58)), url('/hero-bg.jpg') center center / cover no-repeat",
      }} />

      <aside className="glass-sidebar w-56 flex-shrink-0 flex flex-col border-r border-white/10 sticky top-0 h-screen overflow-y-auto"
             style={{ boxShadow: "var(--shadow-sidebar)" }}>

        <div className="px-5 py-5 border-b border-white/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", boxShadow: "0 2px 8px rgba(59,130,246,0.35)" }}>
              <House className="w-4 h-4 text-white" weight="fill" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900/90 leading-tight">Sales Progressor</p>
              {session.user.firmName && (
                <p className="text-xs text-slate-900/40 truncate">{session.user.firmName}</p>
              )}
            </div>
            <AgentBell userKey={session.user.email ?? session.user.id} />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                  isActive
                    ? "bg-blue-500 text-white font-medium shadow-sm"
                    : "text-slate-900/50 hover:text-slate-900/80 hover:bg-white/40"
                }`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-900/40"}`} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/20">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)" }}>
              <span className="text-xs font-semibold text-blue-700">{session.user.name?.charAt(0) ?? "?"}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900/80 truncate">{session.user.name}</p>
              <p className="text-xs text-slate-900/40">{isDirector ? "Director" : "Negotiator"}</p>
            </div>
          </div>
          <a href="/api/auth/signout"
            className="block text-xs text-slate-900/40 hover:text-slate-900/70 transition-colors">
            Sign out
          </a>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">{children}</main>
    </div>
  );
}

function FilesIcon({ className }: { className?: string }) {
  return <FolderOpen className={className} weight="regular" />;
}
function CompletingIcon({ className }: { className?: string }) {
  return <CalendarCheck className={className} weight="regular" />;
}
function AnalyticsIcon({ className }: { className?: string }) {
  return <ChartBar className={className} weight="regular" />;
}
function CommsIcon({ className }: { className?: string }) {
  return <BellSimple className={className} weight="regular" />;
}
function PlusIcon({ className }: { className?: string }) {
  return <PlusCircle className={className} weight="regular" />;
}
function SettingsIcon({ className }: { className?: string }) {
  return <GearSix className={className} weight="regular" />;
}
// Referenced in buildNavItems but unused directly — kept for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TeamIcon({ className }: { className?: string }) {
  return <Users className={className} weight="regular" />;
}
