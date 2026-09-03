"use client";

// The /agent/chains workspace — a high-level command centre for chain visibility.
// A summary overview of the whole picture, two animated tabs (the chains our sales
// sit in, and the live sales not yet in one), and a search + lightweight filter.
// Each chain is a compact, property-led card; each unset sale a setup card. All
// editing/inviting still happens in the ChainDrawer, opened per card via
// ViewChainButton. Scoped upstream by the page.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MagnifyingGlass,
  FunnelSimple,
  UsersThree,
  House,
  HouseLine,
  LinkSimpleHorizontal,
  X,
  Check,
  CaretRight,
} from "@phosphor-icons/react";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";
import { GlassCard } from "@/components/glass/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChainCard } from "@/components/chain/ChainCard";
import { NoChainSetupCard } from "@/components/chain/NoChainSetupCard";
import type { ChainsWorkspaceChain, NoChainSale } from "@/lib/services/chains";

type Tab = "chains" | "none";
type ChainSort = "attention" | "length" | "recent";
type NoneSort = "oldest" | "newest";

// ─── Summary tiles ────────────────────────────────────────────────────────────

type TileTone = "coral" | "info" | "warning";

const TILE_TINT: Record<TileTone, { icon: string; bg: string }> = {
  coral: { icon: "var(--agent-coral-deep)", bg: "rgba(var(--agent-coral-base-rgb), 0.12)" },
  info: { icon: "#0d9488", bg: "rgba(13, 148, 136, 0.12)" },
  warning: { icon: "var(--agent-warning)", bg: "var(--agent-warning-bg)" },
};

function SummaryTile({
  icon,
  value,
  label,
  sublabel,
  tone,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  sublabel: string;
  tone: TileTone;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const tint = TILE_TINT[tone];
  const inner = (
    <>
      <span
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: tint.bg,
          color: tint.icon,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
          {value.toLocaleString()}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.2 }}>{label}</span>
        <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.2 }}>{sublabel}</span>
      </span>
      {onClick && (
        <CaretRight size={14} weight="bold" aria-hidden style={{ marginLeft: "auto", color: "var(--agent-text-muted)", alignSelf: "center", flexShrink: 0 }} />
      )}
    </>
  );

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    background: highlight ? "rgba(var(--agent-coral-base-rgb), 0.06)" : "transparent",
    textAlign: "left",
    width: "100%",
    border: "none",
    borderRadius: 12,
    font: "inherit",
    cursor: onClick ? "pointer" : "default",
  };

  return onClick ? (
    <button type="button" onClick={onClick} className={`chains-summary-cell agent-press-cell${highlight ? " chains-summary-cell-hot" : ""}`} style={style} aria-label={`${value} ${label}`}>
      {inner}
    </button>
  ) : (
    <div className="chains-summary-cell" style={style} aria-label={`${value} ${label}`}>
      {inner}
    </div>
  );
}

// ─── Lightweight filter popover ────────────────────────────────────────────────

function FilterPopover({
  tab,
  chainSort,
  setChainSort,
  onlyNeedsInvite,
  setOnlyNeedsInvite,
  noneSort,
  setNoneSort,
  hideNoChainRequired,
  setHideNoChainRequired,
  active,
}: {
  tab: Tab;
  chainSort: ChainSort;
  setChainSort: (s: ChainSort) => void;
  onlyNeedsInvite: boolean;
  setOnlyNeedsInvite: (v: boolean) => void;
  noneSort: NoneSort;
  setNoneSort: (s: NoneSort) => void;
  hideNoChainRequired: boolean;
  setHideNoChainRequired: (v: boolean) => void;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="agent-segment-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ height: 32 }}
      >
        <FunnelSimple size={14} weight="bold" aria-hidden />
        Filters
        {active && <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: "var(--agent-coral-deep)" }} />}
      </button>

      {open && (
        <div
          role="menu"
          className="agent-dropdown-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 40,
            width: 240,
            background: "var(--agent-surface-elevated)",
            border: "1px solid var(--agent-border-default)",
            borderRadius: 12,
            boxShadow: "var(--agent-shadow-lg, 0 12px 32px rgba(15,23,42,0.16))",
            padding: 8,
          }}
        >
          {tab === "chains" ? (
            <>
              <FilterGroupLabel>Sort by</FilterGroupLabel>
              <FilterRadio label="Needs attention" checked={chainSort === "attention"} onClick={() => setChainSort("attention")} />
              <FilterRadio label="Longest chain" checked={chainSort === "length"} onClick={() => setChainSort("length")} />
              <FilterRadio label="Recently agreed" checked={chainSort === "recent"} onClick={() => setChainSort("recent")} />
              <FilterDivider />
              <FilterCheck label="Only with agents to invite" checked={onlyNeedsInvite} onClick={() => setOnlyNeedsInvite(!onlyNeedsInvite)} />
            </>
          ) : (
            <>
              <FilterGroupLabel>Sort by</FilterGroupLabel>
              <FilterRadio label="Oldest first" checked={noneSort === "oldest"} onClick={() => setNoneSort("oldest")} />
              <FilterRadio label="Newest first" checked={noneSort === "newest"} onClick={() => setNoneSort("newest")} />
              <FilterDivider />
              <FilterCheck label="Hide no chain required" checked={hideNoChainRequired} onClick={() => setHideNoChainRequired(!hideNoChainRequired)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FilterGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)", padding: "4px 10px 6px" }}>
      {children}
    </div>
  );
}

function FilterDivider() {
  return <div style={{ height: 1, background: "var(--agent-border-subtle)", margin: "6px 4px" }} />;
}

function FilterRadio({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={checked} onClick={onClick} className="agent-dropdown-item" style={{ borderRadius: 8, justifyContent: "space-between" }}>
      <span>{label}</span>
      {checked && <Check size={13} weight="bold" style={{ color: "var(--agent-coral-deep)" }} />}
    </button>
  );
}

function FilterCheck({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} onClick={onClick} className="agent-dropdown-item" style={{ borderRadius: 8, justifyContent: "space-between" }}>
      <span>{label}</span>
      <span
        aria-hidden
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          border: `1.5px solid ${checked ? "var(--agent-coral-deep)" : "var(--agent-border-strong)"}`,
          background: checked ? "var(--agent-coral-deep)" : "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {checked && <Check size={10} weight="bold" style={{ color: "#fff" }} />}
      </span>
    </button>
  );
}

// ─── Workspace ─────────────────────────────────────────────────────────────────

export function ChainsWorkspace({
  chains,
  noChain,
  currentUserId,
  currentUserRole,
}: {
  chains: ChainsWorkspaceChain[];
  noChain: NoChainSale[];
  currentUserId: string;
  currentUserRole?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(chains.length === 0 && noChain.length > 0 ? "none" : "chains");
  const [query, setQuery] = useState("");
  const [chainSort, setChainSort] = useState<ChainSort>("attention");
  const [onlyNeedsInvite, setOnlyNeedsInvite] = useState(false);
  const [noneSort, setNoneSort] = useState<NoneSort>("oldest");
  const [hideNoChainRequired, setHideNoChainRequired] = useState(false);

  // Summary figures — derived, never hard-coded.
  const filesInChains = useMemo(() => chains.reduce((n, c) => n + c.links.filter((l) => l.isOurs).length, 0), [chains]);
  const agentsToInvite = useMemo(() => chains.reduce((n, c) => n + c.needsInviteCount, 0), [chains]);
  const activeSales = filesInChains + noChain.length;

  const q = query.trim().toLowerCase();

  const visibleChains = useMemo(() => {
    let list = chains;
    if (q) list = list.filter((c) => c.search.includes(q));
    if (onlyNeedsInvite) list = list.filter((c) => c.needsInviteCount > 0);
    const sorted = [...list];
    if (chainSort === "length") sorted.sort((a, b) => b.length - a.length);
    else if (chainSort === "recent") sorted.sort((a, b) => (b.saleAgreedAt ?? "").localeCompare(a.saleAgreedAt ?? ""));
    else sorted.sort((a, b) => b.needsInviteCount - a.needsInviteCount || b.length - a.length);
    return sorted;
  }, [chains, q, onlyNeedsInvite, chainSort]);

  const visibleNoChain = useMemo(() => {
    let list = noChain;
    if (q) list = list.filter((s) => s.search.includes(q));
    if (hideNoChainRequired) list = list.filter((s) => !s.noChainRequired);
    // Service returns oldest-first with no-chain-required sunk to the bottom.
    if (noneSort === "newest") {
      const sorted = [...list];
      sorted.sort((a, b) => Number(a.noChainRequired) - Number(b.noChainRequired) || b.createdAt.localeCompare(a.createdAt));
      return sorted;
    }
    return list;
  }, [noChain, q, hideNoChainRequired, noneSort]);

  const activeIdx = tab === "chains" ? 0 : 1;
  const { btnRefs, ind } = useTabIndicator(activeIdx);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const filtersActive = tab === "chains" ? onlyNeedsInvite || chainSort !== "attention" : hideNoChainRequired || noneSort !== "oldest";

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "chains", label: "In chains", count: chains.length },
    { key: "none", label: "Needs chain setup", count: noChain.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`
        .chains-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        .chains-summary-cell { border-left: 1px solid var(--agent-border-subtle); }
        .chains-summary-cell:first-child { border-left: none; }
        .chains-summary-cell-hot:hover { background: rgba(var(--agent-coral-base-rgb), 0.10) !important; }
        .chains-card-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr)); }
        @media (max-width: 760px) {
          .chains-summary-grid { grid-template-columns: repeat(2, 1fr); }
          .chains-summary-cell:nth-child(odd) { border-left: none; }
          .chains-summary-cell:nth-child(n+3) { border-top: 1px solid var(--agent-border-subtle); }
        }
      `}</style>

      {/* Summary overview */}
      <GlassCard glassId="chains-summary" label="Chains · summary" defaultVariant="v05" style={{ borderRadius: 14, overflow: "hidden" }}>
        <div className="chains-summary-grid">
          <SummaryTile
            icon={<House size={20} weight="regular" />}
            value={activeSales}
            label="Active sales"
            sublabel="Across all files"
            tone="coral"
          />
          <SummaryTile
            icon={<LinkSimpleHorizontal size={20} weight="regular" />}
            value={filesInChains}
            label="In chains"
            sublabel="Linked to other sales"
            tone="info"
            onClick={() => { setTab("chains"); setOnlyNeedsInvite(false); }}
          />
          <SummaryTile
            icon={<HouseLine size={20} weight="regular" />}
            value={noChain.length}
            label="Need chain setup"
            sublabel="Chain not yet created"
            tone="warning"
            onClick={() => setTab("none")}
          />
          <SummaryTile
            icon={<UsersThree size={20} weight="regular" />}
            value={agentsToInvite}
            label="Agents to invite"
            sublabel="Across your chains"
            tone="coral"
            highlight={agentsToInvite > 0}
            onClick={() => { setTab("chains"); setOnlyNeedsInvite(true); }}
          />
        </div>
      </GlassCard>

      {/* Tabs + search + filters */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div role="tablist" aria-label="Chains views" className="agent-tab-bar" style={{ position: "relative", flex: "1 1 240px", minWidth: 0, borderBottom: "1px solid var(--agent-border-subtle)" }}>
          {ind && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: 0,
                left: ind.left,
                width: ind.width,
                height: 2,
                background: "var(--agent-coral)",
                borderRadius: "1px 1px 0 0",
                transition: prefersReducedMotion ? "none" : "left 200ms ease, width 200ms ease",
                pointerEvents: "none",
              }}
            />
          )}
          {tabs.map((t, i) => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                ref={(el) => { btnRefs.current[i] = el; }}
                onClick={() => setTab(t.key)}
                role="tab"
                aria-selected={isActive}
                className="agent-tab flex-shrink-0"
              >
                {t.label}
                <span
                  className="text-xs rounded-full px-1.5 py-0.5 font-medium leading-none"
                  style={isActive
                    ? { background: "var(--agent-coral)", color: "var(--agent-text-on-coral, #fff)" }
                    : { background: "rgba(var(--agent-coral-base-rgb),0.12)", color: "var(--agent-coral-deep)" }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 260px", minWidth: 0, justifyContent: "flex-end" }}>
          <div style={{ position: "relative", flex: "1 1 auto", minWidth: 0, maxWidth: 360 }}>
            <MagnifyingGlass
              size={14}
              weight="bold"
              aria-hidden
              style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search address, agent or chain"
              aria-label="Search chains"
              className="agent-input agent-input-sm"
              style={{ width: "100%", paddingLeft: 32, paddingRight: query ? 30 : 12 }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, border: "none", background: "transparent", color: "var(--agent-text-muted)", cursor: "pointer", borderRadius: 6 }}
              >
                <X size={13} weight="bold" />
              </button>
            )}
          </div>

          <FilterPopover
            tab={tab}
            chainSort={chainSort}
            setChainSort={setChainSort}
            onlyNeedsInvite={onlyNeedsInvite}
            setOnlyNeedsInvite={setOnlyNeedsInvite}
            noneSort={noneSort}
            setNoneSort={setNoneSort}
            hideNoChainRequired={hideNoChainRequired}
            setHideNoChainRequired={setHideNoChainRequired}
            active={filtersActive}
          />
        </div>
      </div>

      {/* Content */}
      {tab === "chains" ? (
        chains.length === 0 ? (
          <EmptyState
            compact
            iconBg="rgba(var(--agent-coral-base-rgb), 0.12)"
            title="No chains yet"
            description="Sales you link into a chain will show here. Set one up from a sale in the Needs chain setup tab."
          />
        ) : visibleChains.length === 0 ? (
          <EmptyState compact title="No matches" description="No chains match your search or filters." />
        ) : (
          <div className="chains-card-grid">
            {visibleChains.map((c) => (
              <ChainCard key={c.chainId} chain={c} currentUserId={currentUserId} currentUserRole={currentUserRole} />
            ))}
          </div>
        )
      ) : noChain.length === 0 ? (
        <EmptyState
          compact
          iconBg="var(--agent-success-bg)"
          title="Every sale is in a chain"
          description="No live sales are sitting outside a chain right now."
        />
      ) : visibleNoChain.length === 0 ? (
        <EmptyState compact title="No matches" description="No sales match your search or filters." />
      ) : (
        <div className="chains-card-grid">
          {visibleNoChain.map((s) => (
            <NoChainSetupCard key={s.transactionId} sale={s} currentUserId={currentUserId} currentUserRole={currentUserRole} />
          ))}
        </div>
      )}
    </div>
  );
}
