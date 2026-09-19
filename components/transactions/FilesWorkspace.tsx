"use client";

// All Files workspace — owns the view (Pipeline / List / Forecast / Map) and the
// smart-filter selection. Views sit on the LEFT of the bar; the Filter menu on
// the RIGHT. Filters are multi-select with hybrid logic: "Mine" narrows to your
// files (owned as agent OR assigned to you), and the problem lenses (at risk /
// gone quiet / no solicitor / stalled) OR among themselves — so "Mine + At risk
// + No solicitor" reads as "my files that are at risk or missing a solicitor".
// Nothing ticked = every active file, and the List keeps its own status tabs.
// In narrowed contexts (hub / month filter) the bar is hidden and it's list-only.

import { useMemo, useState } from "react";
import { SquaresFour, Rows, ChartLineUp, MapTrifold } from "@phosphor-icons/react";
import type { TransactionStatus } from "@prisma/client";
import { TransactionListWithSearch } from "./TransactionListWithSearch";
import { PipelineBoard, type PipelineRow } from "./PipelineBoard";
import { FilesStatStrip } from "./FilesStatStrip";
import { FilterMenu } from "./FilterMenu";
import { ForecastView } from "./ForecastView";
import { MapView } from "./map/MapView";
import { riskLevelForRow } from "./TransactionRowView";
import { FILTERS, PROBLEM_FILTERS, type FilterKey } from "./segments";
import type { DisplayStageKey } from "@/lib/milestones/display-stages";

type View = "pipeline" | "list" | "forecast" | "map";

const VIEWS: { key: View; label: string; Icon: typeof SquaresFour }[] = [
  { key: "pipeline", label: "Pipeline", Icon: SquaresFour },
  { key: "list", label: "List", Icon: Rows },
  { key: "forecast", label: "Forecast", Icon: ChartLineUp },
  { key: "map", label: "Map", Icon: MapTrifold },
];

export function FilesWorkspace({
  transactions,
  stageByTx,
  basePath,
  isDirector = false,
  initialStatus,
  showStatusTabs = true,
  showAgencyColumn = false,
  showAssignedToColumn = true,
  showViewSwitcher = true,
  currentUserId,
  goneQuietIds = [],
  noSolicitorIds = [],
  stalledIds = [],
  monthKey,
  monthlyTargetPence = null,
  streetViewKey = null,
}: {
  transactions: PipelineRow[];
  stageByTx: Record<string, DisplayStageKey>;
  basePath: string;
  isDirector?: boolean;
  initialStatus?: TransactionStatus | "all";
  showStatusTabs?: boolean;
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
  showViewSwitcher?: boolean;
  currentUserId: string;
  goneQuietIds?: string[];
  noSolicitorIds?: string[];
  stalledIds?: string[];
  monthKey: string; // current calendar month, "YYYY-MM"
  monthlyTargetPence?: number | null; // agency forecast target; director-editable
  streetViewKey?: string | null; // Google Maps key for Street View; null = off
}) {
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<Set<FilterKey>>(new Set());

  // Decorate each row with its board stage so the List rows can draw the
  // journey bar (active files only — stageByTx omits the rest).
  const rows = useMemo(
    () => transactions.map((t) => (stageByTx[t.id] ? { ...t, boardStage: stageByTx[t.id] } : t)),
    [transactions, stageByTx],
  );

  const quietSet = useMemo(() => new Set(goneQuietIds), [goneQuietIds]);
  const noSolSet = useMemo(() => new Set(noSolicitorIds), [noSolicitorIds]);
  const stalledSet = useMemo(() => new Set(stalledIds), [stalledIds]);

  // "Mine" covers both models: owned as the file's agent (director / negotiator)
  // or assigned to you (internal staff). So admin / director both see all files
  // and can tick Mine to break down to just theirs.
  const isMine = (r: PipelineRow) => r.agentUser?.id === currentUserId || r.assignedUser?.id === currentUserId;

  const hits = (r: PipelineRow, k: FilterKey): boolean => {
    switch (k) {
      case "mine": return isMine(r);
      case "risk": return riskLevelForRow(r) === "high";
      case "quiet": return quietSet.has(r.id);
      case "nosolicitor": return noSolSet.has(r.id);
      case "stalled": return stalledSet.has(r.id);
    }
  };

  // Hybrid matcher over the ACTIVE book: Mine AND (any ticked problem).
  const matches = (r: PipelineRow): boolean => {
    if (r.status !== "active") return false;
    if (selected.size === 0) return true;
    if (selected.has("mine") && !isMine(r)) return false;
    const problems = PROBLEM_FILTERS.filter((p) => selected.has(p));
    if (problems.length > 0 && !problems.some((p) => hits(r, p))) return false;
    return true;
  };

  const active = useMemo(() => rows.filter((t) => t.status === "active"), [rows]);

  // Per-filter counts — how many active files each filter surfaces on its own.
  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = active.filter((r) => hits(r, f.key)).length;
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, quietSet, noSolSet, stalledSet, currentUserId]);

  // No filters → hand the list every row so its status tabs still span
  // active/on_hold/completed/withdrawn. Any filter → the matching active subset
  // (and the list's status tabs step aside — the filter is the scope).
  const scoped = useMemo(
    () => (selected.size === 0 ? rows : rows.filter(matches)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, selected, quietSet, noSolSet, stalledSet, currentUserId],
  );

  function toggleFilter(k: FilterKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  const list = (
    <TransactionListWithSearch
      transactions={scoped}
      basePath={basePath}
      isDirector={isDirector}
      initialStatus={initialStatus}
      showStatusTabs={showStatusTabs && selected.size === 0}
      showAgencyColumn={showAgencyColumn}
      showAssignedToColumn={showAssignedToColumn}
    />
  );

  if (!showViewSwitcher) return list;

  return (
    <div className="space-y-4">
      <FilesStatStrip
        active={active}
        goneQuietIds={quietSet}
        monthKey={monthKey}
        basePath={basePath}
        selected={selected}
        onToggle={toggleFilter}
      />

      <div className="files-bar">
        <div className="files-views">
          {VIEWS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={`agent-segment-pill agent-segment-pill-sm${view === key ? " on" : ""}`}
              onClick={() => setView(key)}
            >
              <Icon size={15} weight={view === key ? "fill" : "regular"} />
              {label}
            </button>
          ))}
        </div>

        <FilterMenu
          filters={FILTERS}
          counts={counts}
          selected={selected}
          onToggle={toggleFilter}
          onClear={() => setSelected(new Set())}
        />
      </div>

      {view === "pipeline" ? (
        <PipelineBoard transactions={scoped} stageByTx={stageByTx} basePath={basePath} />
      ) : view === "forecast" ? (
        <ForecastView active={active} monthKey={monthKey} basePath={basePath} monthlyTargetPence={monthlyTargetPence} canEditTarget={isDirector} />
      ) : view === "map" ? (
        <MapView rows={rows} basePath={basePath} streetViewKey={streetViewKey} />
      ) : (
        list
      )}
    </div>
  );
}
