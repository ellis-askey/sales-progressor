"use client";
// components/layout/AppShell.tsx — Sprint 8: Completing, Solicitors, Comms, Reports nav items

import Link from "next/link";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { AppShellClient } from "@/components/layout/AppShellClient";
import type { Session } from "next-auth";
import {
  SquaresFour, ClipboardText, ListChecks, CalendarCheck, ChartBar,
  FileText, Buildings, ChatTeardropDots, EyeSlash, PlusCircle, GearSix, House,
} from "@phosphor-icons/react";

export function AppShell({
  children,
  session,
  activePath,
  taskCount,
  todoCount,
  completingCount,
}: {
  children: React.ReactNode;
  session: Session;
  activePath?: string;
  taskCount?: number;
  todoCount?: number;
  completingCount?: number;
}) {
  const isAdmin = session.user.role === "admin";

  const navItems = [
    { href: "/dashboard",        label: "Dashboard",        icon: DashboardIcon,   badge: null },
    { href: "/tasks",            label: "Work Queue",       icon: TasksIcon,       badge: taskCount && taskCount > 0 ? { count: taskCount, color: "bg-orange-100 text-orange-600" } : null },
    { href: "/todos",            label: "To-Do",            icon: TodoIcon,        badge: todoCount && todoCount > 0 ? { count: todoCount, color: "bg-blue-100 text-blue-600" } : null },
    { href: "/completing",       label: "Completing",       icon: CompletingIcon,  badge: completingCount && completingCount > 0 ? { count: completingCount, color: "bg-emerald-100 text-emerald-700" } : null },
    { href: "/analytics",        label: "Analytics",        icon: AnalyticsIcon,   badge: null },
    { href: "/reports",          label: "Reports",          icon: ReportsIcon,     badge: null },
    { href: "/solicitors",       label: "Solicitors",       icon: SolicitorsIcon,  badge: null },
    { href: "/comms",            label: "Comms",            icon: CommsIcon,       badge: null },
    { href: "/not-our-files",    label: "Not Our Files",    icon: NotOurFilesIcon, badge: null },
    { href: "/transactions/new", label: "New Transaction",  icon: PlusIcon,        badge: null },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: AdminIcon, badge: null }] : []),
  ];

  return (
    <AppShellClient>
    <div className="flex min-h-screen">
      <aside className="glass-sidebar w-56 flex-shrink-0 flex flex-col border-r border-white/20"
             style={{ boxShadow: "var(--shadow-sidebar)" }}>
        <div className="px-5 py-5 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", boxShadow: "0 3px 10px rgba(37,99,235,0.40)" }}>
              <House className="w-4 h-4 text-white" weight="fill" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900/90 leading-tight tracking-tight">Sales Progressor</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const isActive = activePath === href;
            return (
              <Link key={href} href={href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "text-white"
                    : "text-slate-900/60 hover:text-slate-900/90 hover:bg-white/60 hover:shadow-sm"
                }`}
                style={isActive ? {
                  background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.38), 0 1px 3px rgba(0,0,0,0.08)",
                } : undefined}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors duration-150 ${
                  isActive ? "text-white/90" : "text-slate-900/40 group-hover:text-slate-900/60"
                }`} />
                <span className="flex-1 tracking-tight">{label}</span>
                {badge && (
                  <span className={`text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center tabular-nums ${
                    isActive ? "bg-white/20 text-white" : badge.color
                  }`}>
                    {badge.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/20">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 flex-shrink-0"
                 style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", boxShadow: "0 2px 6px rgba(37,99,235,0.30)" }}>
              <span className="text-xs font-bold text-white">{session.user.name?.charAt(0) ?? "?"}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900/80 truncate">{session.user.name}</p>
              <p className="text-xs text-slate-900/40 truncate capitalize">{session.user.role.replace("_", " ")}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
    </AppShellClient>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return <SquaresFour className={className} weight="regular" />;
}
function TasksIcon({ className }: { className?: string }) {
  return <ClipboardText className={className} weight="regular" />;
}
function PlusIcon({ className }: { className?: string }) {
  return <PlusCircle className={className} weight="regular" />;
}
function TodoIcon({ className }: { className?: string }) {
  return <ListChecks className={className} weight="regular" />;
}
function AnalyticsIcon({ className }: { className?: string }) {
  return <ChartBar className={className} weight="regular" />;
}
function CompletingIcon({ className }: { className?: string }) {
  return <CalendarCheck className={className} weight="regular" />;
}
function ReportsIcon({ className }: { className?: string }) {
  return <FileText className={className} weight="regular" />;
}
function SolicitorsIcon({ className }: { className?: string }) {
  return <Buildings className={className} weight="regular" />;
}
function CommsIcon({ className }: { className?: string }) {
  return <ChatTeardropDots className={className} weight="regular" />;
}
function AdminIcon({ className }: { className?: string }) {
  return <GearSix className={className} weight="regular" />;
}
function NotOurFilesIcon({ className }: { className?: string }) {
  return <EyeSlash className={className} weight="regular" />;
}
