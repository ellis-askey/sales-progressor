"use client";

// The /dev/sheets catalogue — dense, searchable, filterable inventory of every
// internal-side drawer / modal / notification, each openable in every
// meaningful state and markable as verified (persisted in localStorage).
//
// Data-driven off _registry/index.ts. This file owns only presentation +
// interaction state; it never hard-codes a component instance.

import { useMemo, useState, useEffect } from "react";
import { MagnifyingGlass, X, SunDim, MoonStars } from "@phosphor-icons/react";
import { REGISTRY } from "../_registry";
import type { SheetEntry, SheetType } from "../_registry/types";
import { useVerification } from "../_lib/useVerification";
import { loadDesign, saveDesign, DEFAULT_BY_MODE, type DesignByMode } from "../_registry/design";
import { ComponentCard } from "./ComponentCard";
import { InspectHost } from "./InspectHost";

type TypeFilter = "all" | SheetType;
type VerifyFilter = "all" | "needs" | "verified";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "drawer", label: "Drawers" },
  { id: "modal", label: "Modals" },
  { id: "notification", label: "Notifications" },
];

const VERIFY_FILTERS: { id: VerifyFilter; label: string }[] = [
  { id: "all", label: "Show all" },
  { id: "needs", label: "Needs review" },
  { id: "verified", label: "Verified" },
];

const TYPE_SECTION_TITLE: Record<SheetType, string> = {
  drawer: "Drawers",
  modal: "Modals & dialogs",
  notification: "Notifications & in-page states",
};

const TYPE_ORDER: SheetType[] = ["drawer", "modal", "notification"];

export function SheetsCatalogue() {
  const verification = useVerification();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>("all");

  const [openId, setOpenId] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string>("");
  const [isDark, setIsDark] = useState(false);

  // Design-bench selection (surface + footer, per light/dark), persisted to
  // localStorage so an in-progress look survives a refresh.
  const [designByMode, setDesignByMode] = useState<DesignByMode>(DEFAULT_BY_MODE);
  useEffect(() => setDesignByMode(loadDesign()), []);
  function updateDesign(next: DesignByMode) {
    setDesignByMode(next);
    saveDesign(next);
  }

  // Mirror the live <html> theme into the toggle, and let the toggle flip it.
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.dataset.theme === "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  function toggleTheme() {
    const next = isDark ? "light" : "dark";
    (window as unknown as { __salesProgressorThemeMode__?: string }).__salesProgressorThemeMode__ = next;
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.add("elevra-bg");
  }

  const openEntry = openId ? REGISTRY.find((e) => e.id === openId) ?? null : null;

  function inspect(entry: SheetEntry) {
    setOpenId(entry.id);
    setStateId(entry.states[0]?.id ?? "default");
  }
  function closeInspect() {
    setOpenId(null);
  }

  // Counts (whole registry, independent of filters).
  const counts = useMemo(() => {
    const byType = { drawer: 0, modal: 0, notification: 0 } as Record<SheetType, number>;
    for (const e of REGISTRY) byType[e.type] += 1;
    return {
      total: REGISTRY.length,
      ...byType,
      verified: verification.count(REGISTRY.map((e) => e.id)),
    };
  }, [verification]);

  // Filtered + grouped for display.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = REGISTRY.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      const v = verification.isVerified(e.id);
      if (verifyFilter === "verified" && !v) return false;
      if (verifyFilter === "needs" && v) return false;
      if (q) {
        const hay = `${e.name} ${e.usedIn} ${e.area} ${e.type} ${e.note ?? ""} ${e.file}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // type -> area -> entries
    const out: { type: SheetType; areas: { area: string; entries: SheetEntry[] }[]; count: number }[] = [];
    for (const type of TYPE_ORDER) {
      const ofType = filtered.filter((e) => e.type === type);
      if (ofType.length === 0) continue;
      const areaMap = new Map<string, SheetEntry[]>();
      for (const e of ofType) {
        const arr = areaMap.get(e.area) ?? [];
        arr.push(e);
        areaMap.set(e.area, arr);
      }
      out.push({
        type,
        count: ofType.length,
        areas: Array.from(areaMap.entries()).map(([area, entries]) => ({ area, entries })),
      });
    }
    return out;
  }, [query, typeFilter, verifyFilter, verification]);

  const visibleCount = grouped.reduce((n, g) => n + g.count, 0);

  return (
    <main style={{ minHeight: "100vh", padding: "40px 28px 120px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
                UI Sheets
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.55, maxWidth: 620 }}>
                Inspect and verify every drawer, modal and in-page notification used across the internal app. Rendered against the real app background with real components and edge-case fixture data.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="agent-btn agent-btn-sm agent-btn-secondary"
              style={{ gap: 6, flexShrink: 0 }}
              title="Toggle light / dark to judge overlays in both themes"
            >
              {isDark ? <SunDim size={15} weight="bold" /> : <MoonStars size={15} weight="bold" />}
              {isDark ? "Light" : "Dark"}
            </button>
          </div>

          {/* Counts */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <CountPill label="Components" value={counts.total} accent />
            <CountPill label="Verified" value={counts.verified} tone="success" />
            <CountPill label="Needs review" value={counts.total - counts.verified} tone="muted" />
            <div style={{ width: 1, alignSelf: "stretch", background: "var(--agent-border-subtle)", margin: "0 2px" }} />
            <CountPill label="Drawers" value={counts.drawer} tone="muted" />
            <CountPill label="Modals" value={counts.modal} tone="muted" />
            <CountPill label="Notifications" value={counts.notification} tone="muted" />
          </div>
        </header>

        {/* ── Controls ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <MagnifyingGlass
              size={16}
              weight="bold"
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }}
            />
            <input
              className="agent-input agent-input-sm"
              placeholder="Search by name, area or file…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 34, paddingRight: query ? 32 : 12, width: "100%" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="agent-icon-btn agent-icon-btn-sm"
                style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)" }}
              >
                <X size={13} weight="bold" />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                className={`agent-segment-pill agent-segment-pill-sm${typeFilter === f.id ? " on" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {VERIFY_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setVerifyFilter(f.id)}
                className={`agent-segment-pill agent-segment-pill-sm${verifyFilter === f.id ? " on" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Progress + reset */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--agent-border-subtle)", overflow: "hidden", maxWidth: 320 }}>
            <div
              style={{
                height: "100%",
                width: `${counts.total ? (counts.verified / counts.total) * 100 : 0}%`,
                background: "var(--agent-success)",
                borderRadius: 4,
                transition: "width 260ms var(--agent-ease)",
              }}
            />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)" }}>
            {counts.verified} / {counts.total} verified
          </span>
          <span style={{ fontSize: 12, color: "var(--agent-text-muted)", marginLeft: "auto" }}>
            {visibleCount} shown
          </span>
          {counts.verified > 0 && (
            <button
              type="button"
              onClick={() => { if (window.confirm("Clear all verified marks?")) verification.clearAll(); }}
              className="agent-btn agent-btn-sm agent-btn-ghost"
            >
              Reset
            </button>
          )}
        </div>

        {/* ── Sections ───────────────────────────────────────────────── */}
        {grouped.length === 0 && (
          <div className="glass-card rounded-[14px]" style={{ padding: 40, textAlign: "center", color: "var(--agent-text-muted)", fontSize: 14 }}>
            No components match your search.
          </div>
        )}

        {grouped.map((group) => (
          <section key={group.type} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "1px solid var(--agent-border-subtle)", paddingBottom: 8 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                {TYPE_SECTION_TITLE[group.type]}
              </h2>
              <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{group.count}</span>
            </div>

            {group.areas.map((areaGroup) => (
              <div key={areaGroup.area} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                  {areaGroup.area}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(266px, 1fr))", gap: 12 }}>
                  {areaGroup.entries.map((entry) => (
                    <ComponentCard
                      key={entry.id}
                      entry={entry}
                      verified={verification.isVerified(entry.id)}
                      onToggleVerified={() => verification.toggle(entry.id)}
                      onInspect={() => inspect(entry)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      {/* ── Active inspection ──────────────────────────────────────────── */}
      {openEntry && (
        <InspectHost
          entry={openEntry}
          stateId={stateId}
          onStateChange={setStateId}
          onClose={closeInspect}
          verified={verification.isVerified(openEntry.id)}
          onToggleVerified={() => verification.toggle(openEntry.id)}
          designByMode={designByMode}
          onDesignChange={updateDesign}
        />
      )}
    </main>
  );
}

function CountPill({ label, value, tone, accent }: { label: string; value: number; tone?: "success" | "muted"; accent?: boolean }) {
  const color = accent
    ? "var(--agent-coral-deep)"
    : tone === "success"
      ? "var(--agent-success)"
      : "var(--agent-text-primary)";
  return (
    <div
      className="glass-card rounded-[10px]"
      style={{ padding: "7px 12px", display: "flex", alignItems: "baseline", gap: 7 }}
    >
      <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}
