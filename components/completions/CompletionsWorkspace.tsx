"use client";

// Completions → master-detail workspace. The redesigned list: Active / Completed
// tabs, a sort menu and a filter menu, a compact single-line row per file with
// the app's NEUTRAL selection shade (reused from the All-files list:
// --agent-surface-nested fill + a 3px --agent-border-strong left bar, NOT a coral
// wash), and a floating CompletionDetailPanel on the right that leaves the list
// live. Drop-in for the current CompletionsGroupList: it takes the same
// CompletionFileRow shape the page already serialises, and the row actions reuse
// the real production handlers. CSS is self-contained (.cw-*) so nothing else
// needs touching.

import { useMemo, useState } from "react";
import { CaretDown, Funnel, Check, ClockCountdown } from "@phosphor-icons/react";
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
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  purchasers: string[];
  agencyName?: string | null;
  assignedUserName?: string | null;
  photoUrl?: string | null;
};

type Tab = "active" | "completed";
type SortKey = "due_earliest" | "days_overdue" | "price_desc" | "exchanged_recent" | "completed_recent";

const ACTIVE_SORTS: { key: SortKey; label: string }[] = [
  { key: "due_earliest", label: "Due date (earliest)" },
  { key: "days_overdue", label: "Days overdue" },
  { key: "price_desc", label: "Price (high to low)" },
  { key: "exchanged_recent", label: "Recently exchanged" },
];
const COMPLETED_SORTS: { key: SortKey; label: string }[] = [
  { key: "completed_recent", label: "Recently completed" },
  { key: "price_desc", label: "Price (high to low)" },
];

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

// ── the compact row ──────────────────────────────────────────────────────────
function Row({
  id, photoUrl, address, priceStr, exchangedIso, completionIso, statusLabel, statusColor,
  selected, onSelect,
}: {
  id: string; photoUrl?: string | null; address: string; priceStr: string | null;
  exchangedIso: string | null; completionIso: string | null;
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
        <span className="cw-cell-lab">Completion</span>
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
  const [sort, setSort] = useState<SortKey>("due_earliest");
  const [filters, setFilters] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorts = tab === "active" ? ACTIVE_SORTS : COMPLETED_SORTS;
  const effectiveSort = sorts.some((s) => s.key === sort) ? sort : sorts[0].key;

  function switchTab(next: Tab) {
    setTab(next);
    setSelectedId(null);
    setFilters(new Set());
    setSort(next === "active" ? "due_earliest" : "completed_recent");
  }
  function toggleFilter(key: string) {
    setFilters((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    setSelectedId(null);
  }

  // Active rows: filter then sort.
  const activeRows = useMemo(() => {
    let rows = active;
    if (filters.has("overdue")) rows = rows.filter((f) => { const r = completionStatus(f.completionDateIso).rel; return r != null && r < 0; });
    if (filters.has("chain")) rows = rows.filter((f) => (f.chainSize ?? 1) > 1);
    if (filters.has("no_sol")) rows = rows.filter((f) => !f.vendorSolicitorName && !f.purchaserSolicitorName);
    if (filters.has("funds")) rows = rows.filter((f) => !(f.completionFundsSent === true || f.fundsInPlace === "yes"));
    const byDate = (a: string | null, b: string | null, dir: 1 | -1) => {
      if (!a && !b) return 0; if (!a) return 1; if (!b) return -1;
      return (new Date(a).getTime() - new Date(b).getTime()) * dir;
    };
    const sorted = [...rows];
    if (effectiveSort === "due_earliest") sorted.sort((a, b) => byDate(a.completionDateIso, b.completionDateIso, 1));
    else if (effectiveSort === "days_overdue") sorted.sort((a, b) => byDate(a.completionDateIso, b.completionDateIso, 1));
    else if (effectiveSort === "price_desc") sorted.sort((a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0));
    else if (effectiveSort === "exchanged_recent") sorted.sort((a, b) => byDate(a.exchangedAtIso, b.exchangedAtIso, -1));
    return sorted;
  }, [active, filters, effectiveSort]);

  const completedRows = useMemo(() => {
    const sorted = [...completed];
    if (effectiveSort === "price_desc") sorted.sort((a, b) => (b.purchasePrice ?? 0) - (a.purchasePrice ?? 0));
    else sorted.sort((a, b) => (new Date(b.completionDateIso ?? 0).getTime()) - (new Date(a.completionDateIso ?? 0).getTime()));
    return sorted;
  }, [completed, effectiveSort]);

  // The ordered id list drives prev/next in the panel.
  const orderedIds = tab === "active" ? activeRows.map((f) => f.id) : completedRows.map((f) => f.id);
  const selIndex = selectedId ? orderedIds.indexOf(selectedId) : -1;
  const panelOpen = selIndex >= 0;

  // The selected file, mapped to the panel's CompletionFileRow shape.
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
          completionDateIso: selectedCompleted.completionDateIso, vendorSolicitorName: null, purchaserSolicitorName: null,
          agencyName: selectedCompleted.agencyName ?? null, photoUrl: selectedCompleted.photoUrl, internal,
        }
      : null;

  const activeFilters = FILTERS.filter((f) => (!f.internalOnly || internal));
  const filterCount = filters.size;

  const sortLabel = sorts.find((s) => s.key === effectiveSort)?.label ?? sorts[0].label;

  const rows = tab === "active" ? activeRows : completedRows;
  const emptyFiltered = tab === "active" && active.length > 0 && activeRows.length === 0;

  return (
    <div className="cw-root">
      {/* Controls */}
      <div className="cw-controls">
        <div className="agent-tab-bar agent-tab-bar-static cw-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "active"} className="agent-tab" onClick={() => switchTab("active")}>
            Active {active.length > 0 && <span className="cw-count">{active.length}</span>}
          </button>
          <button type="button" role="tab" aria-selected={tab === "completed"} className="agent-tab" onClick={() => switchTab("completed")}>
            Completed {completed.length > 0 && <span className="cw-count cw-count--muted">{completed.length}</span>}
          </button>
        </div>

        <div className="cw-controls-right">
          <Popover
            preset="popover"
            width={212}
            placement="bottom-end"
            trigger={<button type="button" className="cw-ctl"><span className="cw-ctl-sort">{sortLabel}</span><CaretDown size={13} weight="bold" /></button>}
          >
            {(close) => (
              <div className="cw-menu">
                {sorts.map((s) => (
                  <button key={s.key} type="button" className={`cw-menu-item${effectiveSort === s.key ? " on" : ""}`} onClick={() => { setSort(s.key); setSelectedId(null); close(); }}>
                    {s.label}
                    {effectiveSort === s.key && <Check size={14} weight="bold" />}
                  </button>
                ))}
              </div>
            )}
          </Popover>

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
      </div>

      {/* List + detail */}
      <div className={`cw-main${panelOpen ? " cw-main--preview" : ""}`}>
        <GlassCard glassId="completions-workspace-list" label="Completions · list" defaultVariant="v05" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          {rows.length === 0 ? (
            <div className="cw-empty">
              <ClockCountdown size={30} weight="regular" style={{ color: "var(--agent-text-muted)", opacity: 0.5 }} />
              <p className="cw-empty-title">
                {emptyFiltered ? "No files match these filters"
                  : tab === "active" ? "Nothing heading to completion"
                  : "No completed files yet"}
              </p>
              <p className="cw-empty-sub">
                {emptyFiltered ? "Try clearing a filter to see more."
                  : tab === "active" ? "Files appear here once they exchange."
                  : "Completed sales will be archived here."}
              </p>
              {emptyFiltered && <button type="button" className="cw-empty-clear" onClick={() => setFilters(new Set())}>Clear filters</button>}
            </div>
          ) : (
            <div className="cw-list" role="list">
              {tab === "active"
                ? activeRows.map((f) => {
                    const st = completionStatus(f.completionDateIso);
                    return (
                      <Row key={f.id} id={f.id} photoUrl={f.photoUrl} address={f.propertyAddress}
                        priceStr={money(f.purchasePrice)} exchangedIso={f.exchangedAtIso} completionIso={f.completionDateIso}
                        statusLabel={st.label} statusColor={st.color}
                        selected={selectedId === f.id} onSelect={() => setSelectedId((cur) => (cur === f.id ? null : f.id))} />
                    );
                  })
                : completedRows.map((f) => (
                    <Row key={f.id} id={f.id} photoUrl={f.photoUrl} address={f.propertyAddress}
                      priceStr={money(f.purchasePrice)} exchangedIso={f.exchangedAtIso} completionIso={f.completionDateIso}
                      statusLabel={f.completionDateIso ? `Completed ${new Date(f.completionDateIso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Completed"}
                      statusColor="var(--agent-success)"
                      selected={selectedId === f.id} onSelect={() => setSelectedId((cur) => (cur === f.id ? null : f.id))} />
                  ))}
            </div>
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
.cw-root{ display:flex; flex-direction:column; gap:14px; }

/* Controls */
.cw-controls{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.cw-tabs{ gap:4px; }
.cw-count{ display:inline-flex; align-items:center; justify-content:center; min-width:18px; height:18px; padding:0 5px; margin-left:5px;
  border-radius:999px; font-size:11px; font-weight:700; background:rgba(var(--agent-coral-rgb),0.12); color:var(--agent-coral-deep); vertical-align:1px; }
.cw-count--muted{ background:rgba(15,23,42,0.06); color:var(--agent-text-muted); }
.cw-controls-right{ display:inline-flex; align-items:center; gap:8px; }
.cw-ctl{ display:inline-flex; align-items:center; gap:7px; height:34px; padding:0 12px; border-radius:10px; cursor:pointer; font-family:inherit;
  font-size:12.5px; font-weight:600; color:var(--agent-text-secondary); border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff);
  transition:border-color .15s, color .15s, background .15s; }
.cw-ctl:hover{ border-color:var(--agent-border-strong); color:var(--agent-text-primary); }
.cw-ctl--on{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }
.cw-ctl-sort{ max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cw-ctl-badge{ display:inline-flex; align-items:center; justify-content:center; min-width:16px; height:16px; padding:0 4px; border-radius:999px;
  font-size:10.5px; font-weight:700; background:var(--agent-coral-deep); color:#fff; }

/* Menus */
.cw-menu{ display:flex; flex-direction:column; gap:1px; }
.cw-menu-item{ display:flex; align-items:center; justify-content:space-between; gap:10px; height:34px; padding:0 10px; border-radius:8px;
  border:none; background:none; cursor:pointer; font-family:inherit; font-size:13px; font-weight:500; color:var(--agent-text-secondary); text-align:left; }
.cw-menu-item:hover{ background:var(--agent-hover-tint); color:var(--agent-text-primary); }
.cw-menu-item.on{ color:var(--agent-text-primary); font-weight:600; }
.cw-menu-item.on svg{ color:var(--agent-coral-deep); }
.cw-menu-head{ display:flex; align-items:center; justify-content:space-between; padding:2px 8px 8px; font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:0.04em; color:var(--agent-text-muted); }
.cw-menu-clear{ border:none; background:none; cursor:pointer; font-family:inherit; font-size:11.5px; font-weight:700; color:var(--agent-coral-deep); text-transform:none; letter-spacing:0; }
.cw-menu-check{ display:flex; align-items:center; gap:10px; height:34px; padding:0 8px; border-radius:8px; border:none; background:none; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:500; color:var(--agent-text-secondary); text-align:left; }
.cw-menu-check:hover{ background:var(--agent-hover-tint); color:var(--agent-text-primary); }
.cw-check{ width:17px; height:17px; border-radius:5px; border:1.5px solid var(--agent-border-strong); display:inline-flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
.cw-check.on{ background:var(--agent-coral-deep); border-color:var(--agent-coral-deep); }
.cw-menu-foot{ margin:7px 4px 1px; font-size:10.5px; color:var(--agent-text-muted); line-height:1.4; }

/* List shifts left when the panel is open (desktop only). */
.cw-main{ transition:margin-right .3s cubic-bezier(.22,1,.36,1); }
@media (min-width:1024px){ .cw-main--preview{ margin-right:556px; } }

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
.cw-cell-lab{ font-size:9.5px; text-transform:uppercase; letter-spacing:0.05em; color:var(--agent-text-muted); font-weight:700; }
.cw-cell-val{ font-size:12.5px; font-weight:500; color:var(--agent-text-secondary); white-space:nowrap; }
.cw-status{ font-size:12.5px; font-weight:700; text-align:right; white-space:nowrap; justify-self:end; font-variant-numeric:tabular-nums; }

/* Empty */
.cw-empty{ display:flex; flex-direction:column; align-items:center; text-align:center; gap:6px; padding:46px 24px; }
.cw-empty-title{ margin:4px 0 0; font-size:15px; font-weight:600; color:var(--agent-text-primary); }
.cw-empty-sub{ margin:0; font-size:13px; color:var(--agent-text-muted); max-width:320px; line-height:1.5; }
.cw-empty-clear{ margin-top:8px; border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); cursor:pointer;
  font-family:inherit; font-size:12.5px; font-weight:600; color:var(--agent-text-secondary); padding:7px 14px; border-radius:9px; }
.cw-empty-clear:hover{ border-color:var(--agent-coral); color:var(--agent-coral-deep); }

/* Mobile: the row reflows to two lines; the detail panel is a bottom sheet (no shift). */
@media (max-width:760px){
  .cw-row{ display:flex; flex-wrap:wrap; column-gap:14px; row-gap:7px; }
  .cw-thumb{ order:0; }
  .cw-id{ order:1; flex:1 1 auto; }
  .cw-status{ order:2; justify-self:auto; }
  .cw-price{ order:3; }
  .cw-cell{ order:4; flex-direction:row; align-items:baseline; gap:5px; }
  .cw-cell-lab{ font-size:10px; }
  .cw-cell-val{ font-size:12px; }
}
`;

export default CompletionsWorkspace;
