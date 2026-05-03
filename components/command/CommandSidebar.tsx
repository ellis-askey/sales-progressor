"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useTransition, useState, useRef, useEffect, Suspense } from "react";
import { signOut } from "next-auth/react";
import { saveCommandPreferencesAction } from "@/app/actions/command-preferences";
import type { CommandMode } from "@/lib/command/scope";
import {
  LayoutDashboard, Lightbulb, TrendingUp, Zap, RefreshCw,
  Activity, Send, HeartPulse, FlaskConical, Pencil,
  Workflow, Shield, AlertTriangle, PoundSterling, ChevronDown, Check,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Agency { id: string; name: string; modeProfile: string; }

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  soon?: boolean;
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/command/overview", label: "Overview", Icon: LayoutDashboard },
      { href: "/command/insights", label: "Insights", Icon: Lightbulb },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/command/growth", label: "Growth", Icon: TrendingUp },
      { href: "/command/activation", label: "Activation", Icon: Zap },
      { href: "/command/retention", label: "Retention", Icon: RefreshCw },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/command/activity", label: "Activity", Icon: Activity },
      { href: "/command/outbound", label: "Outbound", Icon: Send },
      { href: "/command/health", label: "Health", Icon: HeartPulse },
    ],
  },
  {
    label: "Experiments",
    items: [
      { href: "/command/experiments", label: "Experiments", Icon: FlaskConical },
    ],
  },
  {
    label: "Phase 5",
    items: [
      { href: "/command/content", label: "Content", Icon: Pencil },
      { href: "/command/automations", label: "Automations", Icon: Workflow, soon: true },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/command/audit", label: "Audit", Icon: Shield },
      { href: "/command/friction", label: "Friction", Icon: AlertTriangle },
      { href: "/command/revenue", label: "Revenue", Icon: PoundSterling },
    ],
  },
];

// ── Scope filters (needs useSearchParams → must be wrapped in Suspense) ──────

function ScopeFilters({
  agencies,
  savedMode,
  savedAgencyIds,
}: {
  agencies: Agency[];
  savedMode: CommandMode;
  savedAgencyIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [saving, startSaving] = useTransition();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const currentMode = (searchParams.get("mode") ?? "combined") as CommandMode;
  const currentAgencyStr = searchParams.get("agency") ?? "";
  const currentAgencyIds = currentAgencyStr ? currentAgencyStr.split(",").filter(Boolean) : [];

  const isDefault =
    currentMode === savedMode &&
    JSON.stringify([...currentAgencyIds].sort()) === JSON.stringify([...savedAgencyIds].sort());

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function navigate(mode: CommandMode, agencyIds: string[]) {
    const p = new URLSearchParams(searchParams.toString());
    if (mode !== "combined") p.set("mode", mode); else p.delete("mode");
    if (agencyIds.length > 0) p.set("agency", agencyIds.join(",")); else p.delete("agency");
    router.push(`${pathname}?${p.toString()}`);
  }

  function toggleAgency(id: string) {
    const next = currentAgencyIds.includes(id)
      ? currentAgencyIds.filter((a) => a !== id)
      : [...currentAgencyIds, id];
    navigate(currentMode, next);
  }

  const selectedNames = agencies
    .filter((a) => currentAgencyIds.includes(a.id))
    .map((a) => a.name);

  function modeLabel(m: "self_progressed" | "progressor_managed" | "mixed" | string) {
    if (m === "self_progressed") return "SP";
    if (m === "progressor_managed") return "PM";
    return "—";
  }

  return (
    <div className="px-3 py-3 border-b border-[#1f1f1f]">
      <p className="text-[9px] font-bold text-[#404040] uppercase tracking-widest mb-2">Scope</p>

      {/* SP / PM / All toggle */}
      <div className="flex gap-0.5 bg-[#1a1a1a] rounded-md p-0.5 mb-2.5">
        {(["combined", "sp", "pm"] as const).map((m) => (
          <button
            key={m}
            onClick={() => navigate(m, currentAgencyIds)}
            className={`flex-1 text-[11px] py-1 rounded font-semibold transition-all ${
              currentMode === m
                ? "bg-[#2563eb] text-white"
                : "text-[#525252] hover:text-[#a3a3a3]"
            }`}
          >
            {m === "combined" ? "All" : m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Agency multi-select */}
      {agencies.length > 0 && (
        <div className="relative mb-2" ref={dropRef}>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`w-full text-[11px] px-2.5 py-1.5 rounded-md flex items-center justify-between transition-colors border ${
              currentAgencyIds.length > 0
                ? "bg-[#1d2d50] text-[#93c5fd] border-[#2563eb]/40"
                : "bg-[#1a1a1a] text-[#525252] border-[#262626] hover:text-[#a3a3a3]"
            }`}
          >
            <span className="truncate">
              {currentAgencyIds.length === 0
                ? "All agencies"
                : currentAgencyIds.length === 1
                ? selectedNames[0]
                : `${currentAgencyIds.length} agencies`}
            </span>
            <ChevronDown className="w-3 h-3 flex-shrink-0 ml-1 opacity-50" />
          </button>

          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1a1a1a] border border-[#262626] rounded-md shadow-2xl max-h-52 overflow-y-auto">
              {agencies.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAgency(a.id)}
                  className="w-full text-left text-[11px] px-2.5 py-1.5 flex items-center gap-2 hover:bg-[#262626] transition-colors"
                >
                  <span
                    className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
                      currentAgencyIds.includes(a.id)
                        ? "bg-[#2563eb] border-[#2563eb]"
                        : "border-[#404040]"
                    }`}
                  >
                    {currentAgencyIds.includes(a.id) && (
                      <Check className="w-2 h-2 text-white" />
                    )}
                  </span>
                  <span className="truncate text-[#d4d4d4]">{a.name}</span>
                  <span className="ml-auto text-[10px] text-[#525252] flex-shrink-0">
                    {modeLabel(a.modeProfile)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reset / save row */}
      {(currentMode !== "combined" || currentAgencyIds.length > 0) && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const p = new URLSearchParams(searchParams.toString());
              p.delete("mode");
              p.delete("agency");
              router.push(`${pathname}?${p.toString()}`);
            }}
            className="text-[10px] text-[#525252] hover:text-[#a3a3a3] transition-colors"
          >
            Reset
          </button>
          {!isDefault ? (
            <button
              disabled={saving}
              onClick={() =>
                startSaving(() =>
                  saveCommandPreferencesAction(currentMode, currentAgencyIds),
                )
              }
              className="text-[10px] text-[#525252] hover:text-[#a3a3a3] transition-colors disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save default"}
            </button>
          ) : (
            <span className="text-[10px] text-[#404040]">default</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function CommandSidebar({
  agencies,
  savedMode,
  savedAgencyIds,
  adminEmail,
}: {
  agencies: Agency[];
  savedMode: CommandMode;
  savedAgencyIds: string[];
  adminEmail: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-screen bg-[#111111] border-r border-[#1f1f1f] overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full bg-[#2563eb] flex-shrink-0" />
          <span className="text-[13px] font-semibold text-[#fafafa] tracking-tight leading-none">
            Command Centre
          </span>
        </div>
        <p className="text-[10px] text-[#404040] pl-4 mt-0.5">Platform intelligence</p>
      </div>

      {/* Scope filters */}
      <Suspense fallback={<div className="h-[76px] border-b border-[#1f1f1f]" />}>
        <ScopeFilters
          agencies={agencies}
          savedMode={savedMode}
          savedAgencyIds={savedAgencyIds}
        />
      </Suspense>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-[9px] font-bold text-[#404040] uppercase tracking-widest px-2 mb-1">
              {section.label}
            </p>
            {section.items.map(({ href, label, Icon, soon }) => {
              const isActive =
                pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors ${
                    isActive
                      ? "bg-[#1d2d50] text-[#2563eb]"
                      : soon
                      ? "text-[#3a3a3a] hover:text-[#525252]"
                      : "text-[#737373] hover:text-[#d4d4d4] hover:bg-[#1a1a1a]"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-[#2563eb]" />
                  )}
                  <Icon className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={1.75} />
                  <span className="flex-1 text-[13px] font-medium">{label}</span>
                  {soon && (
                    <span className="text-[9px] font-semibold text-[#3a3a3a] bg-[#1a1a1a] px-1.5 py-0.5 rounded uppercase tracking-wide">
                      soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[#1f1f1f] flex-shrink-0">
        <p className="text-[10px] text-[#404040] truncate mb-1.5" title={adminEmail}>{adminEmail}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-[11px] text-[#2e2e2e] hover:text-[#525252] transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
