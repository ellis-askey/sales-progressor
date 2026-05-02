"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";
import { saveCommandPreferencesAction } from "@/app/actions/command-preferences";
import type { CommandMode } from "@/lib/command/scope";

interface Agency {
  id: string;
  name: string;
  modeProfile: string;
}

export function CommandFilters({
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentMode = (searchParams.get("mode") ?? "combined") as CommandMode;
  const currentAgencyStr = searchParams.get("agency") ?? "";
  const currentAgencyIds = currentAgencyStr ? currentAgencyStr.split(",").filter(Boolean) : [];

  const isDefault =
    currentMode === savedMode &&
    JSON.stringify([...currentAgencyIds].sort()) === JSON.stringify([...savedAgencyIds].sort());

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function navigate(mode: CommandMode, agencyIds: string[]) {
    const p = new URLSearchParams(searchParams.toString());
    // Preserve non-filter params (e.g. sev, ack on insights)
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

  function reset() {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("mode");
    p.delete("agency");
    const qs = p.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  }

  const selectedAgencyNames = agencies
    .filter((a) => currentAgencyIds.includes(a.id))
    .map((a) => a.name);

  return (
    <div className="flex items-center gap-3 px-8 py-2.5 border-b border-white/10 bg-white/3 flex-wrap">
      {/* Mode toggle */}
      <div className="flex items-center gap-0.5 bg-white/8 rounded-lg p-0.5">
        {(["combined", "sp", "pm"] as const).map((m) => (
          <button
            key={m}
            onClick={() => navigate(m, currentAgencyIds)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              currentMode === m
                ? "bg-white/20 text-white"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {m === "combined" ? "Combined" : m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Agency multi-select */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
            currentAgencyIds.length > 0
              ? "bg-white/20 text-white"
              : "bg-white/8 text-white/40 hover:text-white/70"
          }`}
        >
          {currentAgencyIds.length === 0
            ? "All agencies"
            : currentAgencyIds.length === 1
            ? selectedAgencyNames[0]
            : `${currentAgencyIds.length} agencies`}
          <span className="opacity-50 text-[10px]">▾</span>
        </button>

        {dropdownOpen && agencies.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-white/20 rounded-xl shadow-xl min-w-[200px] max-h-64 overflow-y-auto">
            <div className="p-1">
              {agencies.map((a) => (
                <button
                  key={a.id}
                  onClick={() => toggleAgency(a.id)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    currentAgencyIds.includes(a.id)
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/8 hover:text-white/80"
                  }`}
                >
                  <span className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${
                    currentAgencyIds.includes(a.id) ? "bg-white/80 border-white" : "border-white/30"
                  }`}>
                    {currentAgencyIds.includes(a.id) && (
                      <span className="text-slate-900 text-[8px] font-bold leading-none">✓</span>
                    )}
                  </span>
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto text-[10px] text-white/25 flex-shrink-0 capitalize">
                    {a.modeProfile.replace(/_/g, " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reset */}
      {(currentMode !== "combined" || currentAgencyIds.length > 0) && (
        <button
          onClick={reset}
          className="text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          Reset
        </button>
      )}

      {/* Save as default */}
      {!isDefault && (
        <button
          disabled={saving}
          onClick={() =>
            startSaving(() =>
              saveCommandPreferencesAction(currentMode, currentAgencyIds)
            )
          }
          className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save as default"}
        </button>
      )}

      {isDefault && (currentMode !== "combined" || currentAgencyIds.length > 0) && (
        <span className="ml-auto text-[10px] text-white/20">default view</span>
      )}
    </div>
  );
}
