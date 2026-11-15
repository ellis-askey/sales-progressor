"use client";

// Completions → master-detail workspace. Redesigned list, matched to the
// All-Files list family: a search+tabs bar (the shared .tl-* / .agent-tab bar,
// so hover + underline are identical), Active / Completed tabs, a Filters menu,
// a sortable column-header row (titles live once in the header, not on every
// row), compact rows with the app's NEUTRAL selection shade (--agent-surface-
// nested + a 3px --agent-border-strong left bar, reused from .files-row-selected,
// not a coral wash), and a floating CompletionDetailPanel that leaves the list
// live. Drop-in for CompletionsGroupList: same CompletionFileRow shape, real
// production actions. CSS is self-contained (.cw-*); the .tl-*/.agent-tab bar
// classes are the shared globals.

import { useMemo, useState } from "react";
import { Funnel, Check, ClockCountdown } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { Popover } from "@/components/ui/Popover";
import { CompletionDetailPanel, completionStatus } from "@/components/completions/CompletionDetailPanel";
import type { CompletionFileRow } from "@/components/completions/CompletionFileRowView";

export type CompletedCompletionRow = {
  id: string;
  propertyAddress: string;
  completionDateIso: string | null;
  exchangedAtIso: string | null;
  instructedAtIso: string | null;
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  purchasers: string[];
  vendorSolicitorName: string | null;
  purchaserSolicitorName: string | null;
  agencyName?: string | null;
  assignedUserName?: string | null;
  photoUrl?: string | null;
};

type Tab = "active" | "completed";
type SortCol = "property" | "price" | "exchanged" | "completion";
type SortDir = "asc" | "desc";

const FILTERS = [
  { key: "overdue", label: "Overdue", internalOnly: false },
  { key: "chain", label: "In a chain", internalOnly: false },
  { key: "no_sol", label: "No solicitor", internalOnly: false },
  { key: "funds", label: "Funds not confirmed", internalOnly: true },
] as const;

function fmtDate(iso: string | null): string {
  if (!iso) return "No date";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function money(pence: number | null): string | null {
  if (pence == null) return null;
  return "£" + Math.round(pence / 100).toLocaleString("en-GB");
}
function splitAddr(address: string): [string, string] {
  const [first, ...rest] = address.split(",");
  return [first.trim(), rest.join(",").trim()];
}

function SortChevron({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`cw-chev${active ? " on" : ""}`} aria-hidden>
      <svg width="7" height="5" viewBox="0 0 7 5" style={{ opacity: active && dir === "asc" ? 1 : 0.3 }}><path d="M3.5 0L7 5H0z" /></svg>
      <svg width="7" height="5" viewBox="0 0 7 5" style={{ opacity: active && dir === "desc" ? 1 : 0.3 }}><path d="M3.5 5L0 0h7z" /></svg>
    </span>
  );
}

// ── the compact row ──────────────────────────────────────────────────────────
function Row({
  id, photoUrl, address, priceStr, exchangedIso, completionIso, completionLabel,
  statusLabel, statusColor, selected, onSelect,
}: {
  id: string; photoUrl?: string | null; address: string; priceStr: string | null;
  exchangedIso: string | null; completionIso: string | null; completionLabel: string;
  statusLabel: string; statusColor: string; selected: boolean; onSelect: () => void;
}) {
  const [line1, town] = splitAddr(address);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      className={`cw-row agent-hover-row${selected ? " cw-row--selected" : ""}`}
      data-id={id}
    >
      <span className="cw-thumb"><PropertyThumb photoUrl={photoUrl} size={44} /></span>
      <span className="cw-id">
        <span className="cw-addr">{line1}</span>
        {town && <span className="cw-town">{town}</span>}
      </span>
      <span className="cw-price">{priceStr ?? "—"}</span>
      <span className="cw-cell">
        <span className="cw-cell-lab">Exchanged</span>
        <span className="cw-cell-val">{fmtDate(exchangedIso)}</span>
      </span>
      <span className="cw-cell">
        <span className="cw-cell-lab">{completionLabel}</span>
        <span className="cw-cell-val">{fmtDate(completionIso)}</span>
      </span>
      <span className="cw-status" style={{ color: statusColor }}>{statusLabel}</span>
    </div>
  );
}

export function CompletionsWorkspace({
  active, completed, internal = false, basePath = "/agent/transactions",
}: {
  active: CompletionFileRow[];
  completed: CompletedCompletionRow[];
  internal?: boolean;
  basePath?: string;
}) {
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("completion");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function switchTab(next: Tab) {
    setTab(next);
    setSelectedId(null);
    setFilters(new Set());
    setQuery("");
    setSortCol("completion");
    setSortDir(next === "completed" ? "desc" : "asc");
  }
  function handleSort(col: SortCol) {
    if (col === sortCol) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "price" || (col === "completion" && tab === "completed") ? "desc" : "asc"); }
    setSelectedId(null);
  }
  function toggleFilter(key: string) {
    setFilters((prev) => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    setSelectedId(null);
  }

  const q = query.trim().toLowerCase();
  const dir = sortDir === "asc" ? 1 : -1;
  // One comparator for both tabs (completed rows carry the same sortable fields).
  type Sortable = { propertyAddress: string; purchasePrice: number | null; exchangedAtIso: string | null; completionDateIso: string | null };
  function compare(a: Sortable, b: Sortable): number {
    if (sortCol === "property") return a.propertyAddress.localeCompare(b.propertyAddress) * dir;
    if (sortCol === "price") return ((a.purchasePrice ?? 0) - (b.purchasePrice ?? 0)) * dir;
    const av = sortCol === "exchanged" ? a.exchangedAtIso : a.completionDateIso;
    const bv = sortCol === "exchanged" ? b.exchangedAtIso : b.completionDateIso;
    if (!av && !bv) return 0; if (!av) return 1; if (!bv) return -1; // undated always last
    return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
  }

  const activeRows = useMemo(() => {
    let rows = active;
    if (filters.has("overdue")) rows = rows.filter((f) => { const r = completionStatus(f.completionDateIso).rel; return r != null && r < 0; });
    if (filters.has("chain")) rows = rows.filter((f) => (f.chainSize ?? 1) > 1);
    if (filters.has("no_sol")) rows = rows.filter((f) => !f.vendorSolicitorName && !f.purchaserSolicitorName);
    if (filters.has("funds")) rows = rows.filter((f) => !(f.completionFundsSent === true || f.fundsInPlace === "yes"));
    if (q) rows = rows.filter((f) => f.propertyAddress.toLowerCase().includes(q));
    return [...rows].sort(compare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, filters, q, sortCol, sortDir]);

  const completedRows = useMemo(() => {
    let rows = completed;
    if (q) rows = rows.filter((f) => f.propertyAddress.toLowerCase().includes(q));
    return [...rows].sort(compare);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed, q, sortCol, sortDir]);

  const orderedIds = tab === "active" ? activeRows.map((f) => f.id) : completedRows.map((f) => f.id);
  const selIndex = selectedId ? orderedIds.indexOf(selectedId) : -1;
  const panelOpen = selIndex >= 0;

  const selectedActive = tab === "active" ? activeRows.find((f) => f.id === selectedId) ?? null : null;
  const selectedCompleted = tab === "completed" ? completedRows.find((f) => f.id === selectedId) ?? null : null;
  const panelFile: CompletionFileRow | null = selectedActive
    ? selectedActive
    : selectedCompleted
      ? {
          id: selectedCompleted.id, propertyAddress: selectedCompleted.propertyAddress,
          purchasePrice: selectedCompleted.purchasePrice, agentFeeAmount: selectedCompleted.agentFeeAmount,
          agentFeePercent: null, agentFeeIsVatInclusive: null, purchasers: selectedCompleted.purchasers,
          assignedUserName: selectedCompleted.assignedUserName ?? null, exchangedAtIso: selectedCompleted.exchangedAtIso,
          completionDateIso: selectedCompleted.completionDateIso,
          vendorSolicitorName: selectedCompleted.vendorSolicitorName, purchaserSolicitorName: selectedCompleted.purchaserSolicitorName,
          instructedAtIso: selectedCompleted.instructedAtIso,
          agencyName: selectedCompleted.agencyName ?? null, photoUrl: selectedCompleted.photoUrl, internal,
        }
      : null;

  const activeFilters = FILTERS.filter((f) => !f.internalOnly || internal);
  const filterCount = filters.size;
  const completionLabel = tab === "completed" ? "Completed" : "Completion";
  const rows = tab === "active" ? activeRows : completedRows;
  const emptyFiltered = tab === "active" && active.length > 0 && activeRows.length === 0 && filterCount > 0;
  const emptySearch = !!q && rows.length === 0;

  const countPill = (isActive: boolean, n: number) => (
    <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 7px", borderRadius: 99, marginLeft: 6,
      background: isActive ? "rgba(var(--agent-coral-rgb), 0.12)" : "rgba(0,0,0,0.06)",
      color: isActive ? "var(--agent-coral-deep)" : "var(--agent-text-muted)" }}>{n}</span>
  );

  return (
    <div className="cw-root">
      <div className={`cw-main${panelOpen ? " cw-main--preview" : ""}`}>
        {/* Search + tabs bar — the All-Files family (.tl-* + .agent-tab) */}
        <GlassCard glassId="completions-search" label="Completions · Search & tabs" defaultVariant="v25" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div className="tl-card-search tl-search-row">
            <div className="tl-search-input" style={{ flex: 1 }}>
              <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--agent-text-muted)", pointerEvents: "none" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }} placeholder="Search completions by address…" className="agent-input agent-input-sm" style={{ width: "100%", paddingLeft: 34, paddingRight: 34, fontSize: 13 }} />
              {query && <button onClick={() => setQuery("")} className="agent-icon-btn agent-icon-btn-sm" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)" }} aria-label="Clear search">×</button>}
            </div>
            {tab === "active" && (
              <Popover
                preset="popover"
                width={220}
                placement="bottom-end"
                trigger={
                  <button type="button" className={`cw-ctl${filterCount > 0 ? " cw-ctl--on" : ""}`}>
                    <Funnel size={14} weight={filterCount > 0 ? "fill" : "regular"} /> Filters
                    {filterCount > 0 && <span className="cw-ctl-badge">{filterCount}</span>}
                  </button>
                }
              >
                {() => (
                  <div className="cw-menu">
                    <div className="cw-menu-head">
                      <span>Filter completions</span>
                      {filterCount > 0 && <button type="button" className="cw-menu-clear" onClick={() => { setFilters(new Set()); setSelectedId(null); }}>Clear</button>}
                    </div>
                    {activeFilters.map((f) => (
                      <button key={f.key} type="button" className="cw-menu-check" onClick={() => toggleFilter(f.key)}>
                        <span className={`cw-check${filters.has(f.key) ? " on" : ""}`}>{filters.has(f.key) && <Check size={12} weight="bold" />}</span>
                        {f.label}
                      </button>
                    ))}
                    <p className="cw-menu-foot">Nothing ticked shows every active file.</p>
                  </div>
                )}
              </Popover>
            )}
          </div>

          <div className="tl-card-tabs">
            <div className="agent-tab-bar agent-tab-bar-static tl-bar-row">
              <div className="tl-bar-tabs">
                <button type="button" onClick={() => switchTab("active")} className="agent-tab" aria-selected={tab === "active" || undefined} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  Active {countPill(tab === "active", active.length)}
                </button>
                <button type="button" onClick={() => switchTab("completed")} className="agent-tab" aria-selected={tab === "completed" || undefined} style={{ background: "none", border: "none", cursor: "pointer" }}>
                  Completed {countPill(tab === "completed", completed.length)}
                </button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* List */}
        <GlassCard glassId="completions-workspace-list" label="Completions · list" defaultVariant="v05" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          {rows.length === 0 ? (
            <div className="cw-empty">
              <ClockCountdown size={30} weight="regular" style={{ color: "var(--agent-text-muted)", opacity: 0.5 }} />
              <p className="cw-empty-title">
                {emptyFiltered ? "No files match these filters"
                  : emptySearch ? "No completions match your search"
                  : tab === "active" ? "Nothing heading to completion"
                  : "No completed files yet"}
              </p>
              <p className="cw-empty-sub">
                {emptyFiltered ? "Try clearing a filter to see more."
                  : emptySearch ? "Try a different address."
                  : tab === "active" ? "Files appear here once they exchange."
                  : "Completed sales will be archived here."}
              </p>
              {emptyFiltered && <button type="button" className="cw-empty-clear" onClick={() => setFilters(new Set())}>Clear filters</button>}
              {emptySearch && <button type="button" className="cw-empty-clear" onClick={() => setQuery("")}>Clear search</button>}
            </div>
          ) : (
            <>
              {/* Column headers — titles live here once, not on every row. */}
              <div className="cw-head">
                <span aria-hidden />
                <button type="button" className="cw-head-cell" onClick={() => handleSort("property")}>Property<SortChevron active={sortCol === "property"} dir={sortDir} /></button>
                <button type="button" className="cw-head-cell" onClick={() => handleSort("price")}>Price<SortChevron active={sortCol === "price"} dir={sortDir} /></button>
                <button type="button" className="cw-head-cell" onClick={() => handleSort("exchanged")}>Exchanged<SortChevron active={sortCol === "exchanged"} dir={sortDir} /></button>
                <button type="button" className="cw-head-cell" onClick={() => handleSort("completion")}>{completionLabel}<SortChevron active={sortCol === "completion"} dir={sortDir} /></button>
                <span className="cw-head-cell cw-head-status">Status</span>
              </div>
              <div className="cw-list">
                {tab === "active"
                  ? activeRows.map((f) => {
                      const st = completionStatus(f.completionDateIso);
                      return (
                        <Row key={f.id} id={f.id} photoUrl={f.photoUrl} address={f.propertyAddress}
                          priceStr={money(f.purchasePrice)} exchangedIso={f.exchangedAtIso} completionIso={f.completionDateIso} completionLabel={completionLabel}
                          statusLabel={st.label} statusColor={st.color}
                          selected={selectedId === f.id} onSelect={() => setSelectedId((cur) => (cur === f.id ? null : f.id))} />
                      );
                    })
                  : completedRows.map((f) => (
                      <Row key={f.id} id={f.id} photoUrl={f.photoUrl} address={f.propertyAddress}
                        priceStr={money(f.purchasePrice)} exchangedIso={f.exchangedAtIso} completionIso={f.completionDateIso} completionLabel={completionLabel}
                        statusLabel={f.completionDateIso ? `Completed ${new Date(f.completionDateIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Completed"}
                        statusColor="var(--agent-success)"
                        selected={selectedId === f.id} onSelect={() => setSelectedId((cur) => (cur === f.id ? null : f.id))} />
                    ))}
              </div>
            </>
          )}
        </GlassCard>
      </div>

      <CompletionDetailPanel
        file={panelFile}
        open={panelOpen}
        completed={tab === "completed"}
        basePath={basePath}
        onClose={() => setSelectedId(null)}
        onPrev={() => { if (selIndex > 0) setSelectedId(orderedIds[selIndex - 1]); }}
        onNext={() => { if (selIndex >= 0 && selIndex < orderedIds.length - 1) setSelectedId(orderedIds[selIndex + 1]); }}
        hasPrev={selIndex > 0}
        hasNext={selIndex >= 0 && selIndex < orderedIds.length - 1}
      />

      <style>{CW_CSS}</style>
    </div>
  );
}

const CW_CSS = `
.cw-root{ display:flex; flex-direction:column; }
.cw-main{ display:flex; flex-direction:column; gap:14px; transition:margin-right .3s cubic-bezier(.22,1,.36,1); }
@media (min-width:1024px){ .cw-main--preview{ margin-right:556px; } }

/* Filters control (lives in the search row) */
.cw-ctl{ display:inline-flex; align-items:center; gap:7px; height:34px; padding:0 12px; border-radius:10px; cursor:pointer; font-family:inherit;
  font-size:12.5px; font-weight:600; color:var(--agent-text-secondary); border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff);
  transition:border-color .15s, color .15s, background .15s; flex-shrink:0; }
.cw-ctl:hover{ border-color:var(--agent-border-strong); color:var(--agent-text-primary); }
.cw-ctl--on{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }
.cw-ctl-badge{ display:inline-flex; align-items:center; justify-content:center; min-width:16px; height:16px; padding:0 4px; border-radius:999px;
  font-size:10.5px; font-weight:700; background:var(--agent-coral-deep); color:#fff; }

/* Filter menu */
.cw-menu{ display:flex; flex-direction:column; gap:1px; }
.cw-menu-head{ display:flex; align-items:center; justify-content:space-between; padding:2px 8px 8px; font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:0.04em; color:var(--agent-text-muted); }
.cw-menu-clear{ border:none; background:none; cursor:pointer; font-family:inherit; font-size:11.5px; font-weight:700; color:var(--agent-coral-deep); text-transform:none; letter-spacing:0; }
.cw-menu-check{ display:flex; align-items:center; gap:10px; height:34px; padding:0 8px; border-radius:8px; border:none; background:none; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:500; color:var(--agent-text-secondary); text-align:left; }
.cw-menu-check:hover{ background:var(--agent-hover-tint); color:var(--agent-text-primary); }
.cw-check{ width:17px; height:17px; border-radius:5px; border:1.5px solid var(--agent-border-strong); display:inline-flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
.cw-check.on{ background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); }
.cw-menu-foot{ margin:7px 4px 1px; font-size:10.5px; color:var(--agent-text-muted); line-height:1.4; }

/* Column headers — same grid as the rows so they line up (labels live here). */
.cw-head{ display:grid; grid-template-columns:44px minmax(0,1.7fr) minmax(74px,0.7fr) minmax(96px,0.9fr) minmax(96px,0.9fr) minmax(104px,auto);
  gap:14px; align-items:center; padding:10px 16px; background:rgba(var(--agent-shadow-rgb),0.04); border-bottom:0.5px solid var(--agent-border-subtle); }
.cw-head-cell{ display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;
  color:var(--agent-text-muted); background:none; border:none; padding:0; font-family:inherit; }
button.cw-head-cell{ cursor:pointer; transition:color .15s; }
button.cw-head-cell:hover{ color:var(--agent-text-secondary); }
.cw-head-status{ justify-self:end; }
.cw-chev{ display:inline-flex; flex-direction:column; gap:1px; opacity:0; transition:opacity .15s; color:var(--agent-text-secondary); }
button.cw-head-cell:hover .cw-chev{ opacity:0.55; }
.cw-chev.on{ opacity:1; }
.cw-chev svg{ fill:currentColor; display:block; }

/* Rows */
.cw-list{ display:flex; flex-direction:column; }
.cw-row{ display:grid; grid-template-columns:44px minmax(0,1.7fr) minmax(74px,0.7fr) minmax(96px,0.9fr) minmax(96px,0.9fr) minmax(104px,auto);
  align-items:center; gap:14px; padding:11px 16px; cursor:pointer; position:relative; outline:none;
  border-bottom:0.5px solid var(--agent-border-subtle); }
.cw-row:last-child{ border-bottom:none; }
.cw-row:focus-visible{ outline:2px solid var(--agent-coral); outline-offset:-2px; border-radius:10px; }
.cw-row--selected{ background:var(--agent-surface-nested, rgba(15,23,42,0.06)); box-shadow:inset 3px 0 0 var(--agent-border-strong, rgba(15,23,42,0.22)); }
.cw-row--selected:hover{ background:var(--agent-surface-nested, rgba(15,23,42,0.06)); }
.cw-thumb{ display:flex; }
.cw-id{ display:flex; flex-direction:column; min-width:0; line-height:1.25; }
.cw-addr{ font-size:14px; font-weight:600; color:var(--agent-text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-row:hover .cw-addr{ color:var(--agent-coral-deep); }
.cw-town{ font-size:11.5px; color:var(--agent-text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-price{ font-size:13.5px; font-weight:700; color:var(--agent-text-primary); font-variant-numeric:tabular-nums; white-space:nowrap; }
.cw-cell{ display:flex; flex-direction:column; min-width:0; line-height:1.2; }
.cw-cell-lab{ display:none; }
.cw-cell-val{ font-size:12.5px; font-weight:500; color:var(--agent-text-secondary); white-space:nowrap; }
.cw-status{ font-size:12.5px; font-weight:700; text-align:right; white-space:nowrap; justify-self:end; font-variant-numeric:tabular-nums; }

/* Empty */
.cw-empty{ display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; padding:46px 24px; }
.cw-empty-title{ margin:4px 0 0; font-size:15px; font-weight:600; color:var(--agent-text-primary); }
.cw-empty-sub{ margin:0; font-size:13px; color:var(--agent-text-muted); max-width:320px; line-height:1.5; }
.cw-empty-clear{ margin-top:8px; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:var(--agent-text-secondary); padding:7px 14px; border-radius:9px; }
.cw-empty-clear:hover{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }

/* Mobile: hide the header; rows reflow to two lines and show their own labels. */
@media (max-width:760px){
  .cw-head{ display:none; }
  .cw-row{ display:flex; flex-wrap:wrap; column-gap:14px; row-gap:7px; }
  .cw-thumb{ order:0; }
  .cw-id{ order:1; flex:1 1 auto; }
  .cw-status{ order:2; justify-self:auto; }
  .cw-price{ order:3; }
  .cw-cell{ order:4; flex-direction:row; align-items:baseline; gap:5px; }
  .cw-cell-lab{ display:inline; font-size:10px; text-transform:uppercase; letter-spacing:0.04em; color:var(--agent-text-muted); font-weight:700; }
  .cw-cell-val{ font-size:12px; }
}
`;

export default CompletionsWorkspace;
