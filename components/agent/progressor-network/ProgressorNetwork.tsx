"use client";

import { useMemo, useState } from "react";
import { CaretDown, Check, Compass } from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";
import { SearchField } from "@/components/ui/SearchField";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";
import type { ProgressorNetworkBusiness, ProgressorNetworkTab } from "@/lib/services/progressor-network";
import { NETWORK_SPECIALISMS } from "@/lib/services/progressor-network";
import { ProgressorCard } from "./ProgressorCard";
import { NetworkValueStrip } from "./NetworkValueStrip";
import { HowItWorksRail } from "./HowItWorksRail";
import { ProgressorProfileDrawer } from "./ProgressorProfileDrawer";

// Client orchestrator for the Progressor Network. Owns tab / search / filter /
// sort state and the profile drawer. Save + connect are optimistic in-session
// edits against the mock catalogue (persistence + the real handshake land in
// P1/P2 — see docs/active/progressor-network/SPEC.md).

type SortKey = "match" | "completion-rate" | "fastest" | "most-exchanges" | "team";
type AvailKey = "all" | "accepting";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "match", label: "Best match" },
  { key: "completion-rate", label: "Highest completion rate" },
  { key: "fastest", label: "Fastest to exchange" },
  { key: "most-exchanges", label: "Most exchanges" },
  { key: "team", label: "Largest team" },
];

const AVAIL: { key: AvailKey; label: string }[] = [
  { key: "all", label: "Any availability" },
  { key: "accepting", label: "Accepting new instructions" },
];

// Specialism facets come from the shared NETWORK_SPECIALISMS controlled vocab.

const TABS: { value: ProgressorNetworkTab; label: string }[] = [
  { value: "discover", label: "Discover" },
  { value: "my-progressors", label: "My progressors" },
  { value: "introductions", label: "Introductions" },
  { value: "saved", label: "Saved" },
];

function FilterButton({ open, label }: { open: boolean; label: string }) {
  return (
    <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 7 }} aria-haspopup="menu" aria-expanded={open}>
      {label}
      <CaretDown size={12} weight="bold" style={{ transition: "transform .18s ease", transform: open ? "rotate(180deg)" : "none" }} />
    </button>
  );
}

export function ProgressorNetwork({ businesses }: { businesses: ProgressorNetworkBusiness[] }) {
  const [items, setItems] = useState(businesses);
  const [tab, setTab] = useState<ProgressorNetworkTab>("discover");
  const [query, setQuery] = useState("");
  const [avail, setAvail] = useState<AvailKey>("all");
  const [specialism, setSpecialism] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("match");
  const [activeId, setActiveId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      discover: items.length,
      "my-progressors": items.filter((b) => b.connectionStatus === "connected").length,
      introductions: items.filter((b) => b.connectionStatus === "requested").length,
      saved: items.filter((b) => b.saved).length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((b) => {
      if (tab === "my-progressors" && b.connectionStatus !== "connected") return false;
      if (tab === "introductions" && b.connectionStatus !== "requested") return false;
      if (tab === "saved" && !b.saved) return false;
      if (avail === "accepting" && b.availability !== "accepting") return false;
      if (specialism !== "all" && !b.tags.includes(specialism)) return false;
      if (q && !`${b.name} ${b.blurb} ${b.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "completion-rate":
          return (b.stats.completionRatePct ?? -1) - (a.stats.completionRatePct ?? -1);
        case "fastest":
          return (a.stats.avgTimeToExchangeWeeks ?? 999) - (b.stats.avgTimeToExchangeWeeks ?? 999);
        case "most-exchanges":
          return (b.stats.exchangedFiles12mo ?? -1) - (a.stats.exchangedFiles12mo ?? -1);
        case "team":
          return b.stats.teamSize - a.stats.teamSize;
        default:
          return 0;
      }
    });
  }, [items, tab, query, avail, specialism, sort]);

  const toggleSave = (id: string) =>
    setItems((prev) => prev.map((b) => (b.id === id ? { ...b, saved: !b.saved } : b)));
  const connect = (id: string) =>
    setItems((prev) => prev.map((b) => (b.id === id && b.connectionStatus === "none" ? { ...b, connectionStatus: "requested" } : b)));

  const active = items.find((b) => b.id === activeId) ?? null;
  const filtersActive = query.trim() !== "" || avail !== "all" || specialism !== "all";
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Best match";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div data-bloom>
        <NetworkValueStrip />
      </div>

      <div data-bloom>
        <SegmentedSwitch
          options={TABS.map((t) => ({ id: t.value, label: t.label, count: counts[t.value] }))}
          value={tab}
          onChange={(v) => setTab(v)}
          ariaLabel="Progressor network views"
        />
      </div>

      <div className={`pn-body${tab === "discover" ? " pn-body--rail" : ""}`}>
        {tab === "discover" && (
          <aside data-bloom>
            <HowItWorksRail />
          </aside>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="pn-controls" data-bloom>
            <div className="pn-search">
              <SearchField value={query} onChange={setQuery} placeholder="Search businesses, regions or specialisms…" ariaLabel="Search the network" />
            </div>
            <div className="pn-filters">
              <Popover placement="bottom-start" trigger={(open) => <FilterButton open={open} label={`Availability: ${avail === "all" ? "Any" : "Accepting"}`} />}>
                {(close) =>
                  AVAIL.map((a) => (
                    <PopoverMenuItem
                      key={a.key}
                      icon={a.key === avail ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                      onClick={() => {
                        setAvail(a.key);
                        close();
                      }}
                    >
                      {a.label}
                    </PopoverMenuItem>
                  ))
                }
              </Popover>

              <Popover placement="bottom-start" trigger={(open) => <FilterButton open={open} label={`Specialism: ${specialism === "all" ? "Any" : specialism}`} />}>
                {(close) => (
                  <>
                    <PopoverMenuItem
                      icon={specialism === "all" ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                      onClick={() => {
                        setSpecialism("all");
                        close();
                      }}
                    >
                      Any specialism
                    </PopoverMenuItem>
                    {NETWORK_SPECIALISMS.map((s) => (
                      <PopoverMenuItem
                        key={s}
                        icon={s === specialism ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                        onClick={() => {
                          setSpecialism(s);
                          close();
                        }}
                      >
                        {s}
                      </PopoverMenuItem>
                    ))}
                  </>
                )}
              </Popover>

              <Popover placement="bottom-end" trigger={(open) => <FilterButton open={open} label={`Sort: ${sortLabel}`} />}>
                {(close) =>
                  SORTS.map((s) => (
                    <PopoverMenuItem
                      key={s.key}
                      icon={s.key === sort ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                      onClick={() => {
                        setSort(s.key);
                        close();
                      }}
                    >
                      {s.label}
                    </PopoverMenuItem>
                  ))
                }
              </Popover>
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState tab={tab} filtersActive={filtersActive} />
          ) : (
            <div className="pn-grid">
              {visible.map((b) => (
                <ProgressorCard
                  key={b.id}
                  business={b}
                  onView={(id) => setActiveId(id)}
                  onConnect={(id) => connect(id)}
                  onToggleSave={(id) => toggleSave(id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ProgressorProfileDrawer
        business={active}
        open={active != null}
        onClose={() => setActiveId(null)}
        onConnect={(id) => connect(id)}
        onToggleSave={(id) => toggleSave(id)}
      />

      <style>{`
        .pn-body{display:grid;grid-template-columns:1fr;gap:24px;align-items:start}
        .pn-body--rail{grid-template-columns:252px minmax(0,1fr)}
        @media (max-width:1080px){.pn-body--rail{grid-template-columns:1fr}}
        .pn-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
        .pn-search{flex:1 1 300px;min-width:0}
        .pn-filters{display:flex;gap:8px;flex-wrap:wrap}
        .pn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
        .pn-card{transition:box-shadow .18s ease,border-color .18s ease}
        .pn-card:hover{box-shadow:0 10px 26px rgba(15,23,42,0.10);border-color:rgba(var(--agent-coral-rgb),0.30)}
        .pn-save{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:8px;flex-shrink:0;transition:background .15s ease,color .15s ease}
        .pn-save:hover{background:var(--agent-surface-glass)}
      `}</style>
    </div>
  );
}

function EmptyState({ tab, filtersActive }: { tab: ProgressorNetworkTab; filtersActive: boolean }) {
  const title = filtersActive
    ? "No progressors match your filters"
    : tab === "saved"
      ? "Nothing saved yet"
      : tab === "my-progressors"
        ? "No connected progressors yet"
        : tab === "introductions"
          ? "No introductions in progress"
          : "No progressors yet";
  const body = filtersActive
    ? "Try a different search, or clear the filters."
    : tab === "saved"
      ? "Save a business from Discover to keep it here."
      : tab === "my-progressors"
        ? "Once you connect with a business, it appears here."
        : tab === "introductions"
          ? "Connection requests you send show here until they're accepted."
          : "Check back soon.";
  return (
    <div className="agent-glass-strong agent-empty-card" style={{ padding: "48px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
      <Compass size={32} weight="regular" style={{ color: "var(--agent-text-muted)", opacity: 0.5, margin: "0 auto 12px", display: "block" }} />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>{body}</p>
    </div>
  );
}
