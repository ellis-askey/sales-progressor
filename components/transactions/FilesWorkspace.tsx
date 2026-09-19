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
import type { FilterSection } from "./FilterMenu";
import {
  FILTER_META, PROBLEM_FILTERS, SERVICE_FILTERS,
  isOwnerKey, ownerIdOf, type FilterKey, type StaticFilterKey,
} from "./segments";
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
  // The List reports its active status tab up (see onStatusChange) so the
  // Filter menu can count each lens against the slice on screen.
  const [listStatus, setListStatus] = useState<string>(initialStatus ?? "active");

  // Decorate each row with its board stage so the List rows can draw the
  // journey bar (active files only — stageByTx omits the rest).
  const rows = useMemo(
    () => transactions.map((t) => (stageByTx[t.id] ? { ...t, boardStage: stageByTx[t.id] } : t)),
    [transactions, stageByTx],
  );

  const quietSet = useMemo(() => new Set(goneQuietIds), [goneQuietIds]);
  const noSolSet = useMemo(() => new Set(noSolicitorIds), [noSolicitorIds]);
  const stalledSet = useMemo(() => new Set(stalledIds), [stalledIds]);

  const active = useMemo(() => rows.filter((t) => t.status === "active"), [rows]);

  // "Mine" covers both models: owned as the file's agent (director / negotiator)
  // or assigned to you (internal staff). So admin / director both see all files
  // and can tick Mine to break down to just theirs.
  const isMine = (r: PipelineRow) => r.agentUser?.id === currentUserId || r.assignedUser?.id === currentUserId;

  const hits = (r: PipelineRow, k: FilterKey): boolean => {
    if (isOwnerKey(k)) return r.agentUser?.id === ownerIdOf(k);
    switch (k) {
      case "mine": return isMine(r);
      case "risk": return riskLevelForRow(r) === "high";
      case "quiet": return quietSet.has(r.id);
      case "nosolicitor": return noSolSet.has(r.id);
      case "stalled": return stalledSet.has(r.id);
      case "selfmanaged": return r.serviceType === "self_managed";
      case "outsourced": return r.serviceType === "outsourced";
      default: return false;
    }
  };

  // Owners present in the active book, for the "Yours" section's per-owner rows.
  const owners = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const t of active) {
      if (t.agentUser && !seen.has(t.agentUser.id)) { seen.add(t.agentUser.id); list.push({ id: t.agentUser.id, name: t.agentUser.name }); }
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [active]);

  // Owner rows: directors/admin see them whenever there's at least one owner;
  // negotiators (who see only their own files) get nothing to pick from, so hide.
  const showOwnerRows = isDirector ? owners.length > 0 : owners.length > 1;
  // Service rows: directors/admin always; others only when both kinds are present.
  const showServiceRows = isDirector
    ? active.length > 0
    : active.some((t) => t.serviceType === "self_managed") && active.some((t) => t.serviceType === "outsourced");

  const meta = (k: StaticFilterKey) => ({ key: k as FilterKey, label: FILTER_META[k].label, dot: FILTER_META[k].dot });
  const sections: FilterSection[] = useMemo(() => {
    const s: FilterSection[] = [];
    const yours = [meta("mine"), ...(showOwnerRows ? owners.map((o) => ({ key: `owner:${o.id}` as FilterKey, label: o.name })) : [])];
    s.push({ title: "Yours", items: yours });
    s.push({ title: "Needs attention", items: PROBLEM_FILTERS.map((k) => meta(k as StaticFilterKey)) });
    if (showServiceRows) s.push({ title: "Service", items: SERVICE_FILTERS.map((k) => meta(k as StaticFilterKey)) });
    return s;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owners, showOwnerRows, showServiceRows]);

  // Sectioned matcher: rows within a section OR, sections AND. Ownership +
  // service are status-agnostic; the problem lenses only apply to the active
  // book, so ticking one scopes the workspace to active files.
  const matches = (r: PipelineRow): boolean => {
    const mineSel = selected.has("mine");
    const ownerSel = [...selected].filter(isOwnerKey);
    if (mineSel || ownerSel.length > 0) {
      const ok = (mineSel && isMine(r)) || ownerSel.some((k) => r.agentUser?.id === ownerIdOf(k));
      if (!ok) return false;
    }
    const svcSel = SERVICE_FILTERS.filter((k) => selected.has(k));
    if (svcSel.length > 0 && !svcSel.some((k) => hits(r, k))) return false;
    const probSel = PROBLEM_FILTERS.filter((k) => selected.has(k));
    if (probSel.length > 0) {
      if (r.status !== "active") return false;
      if (!probSel.some((k) => hits(r, k))) return false;
    }
    return true;
  };

  // Any problem lens active → the view scopes to the active book (and the list's
  // status tabs step aside — the lens is the scope).
  const hasProblemSelected = PROBLEM_FILTERS.some((k) => selected.has(k));

  // The slice the counts should reflect: when the status tabs are live, it's the
  // visible tab (so "Outsourced 3" matches what ticking it reveals on that tab);
  // when they're hidden (narrowed view, or a problem lens is on), it's the
  // active book.
  const tabsVisible = showStatusTabs && !hasProblemSelected;
  const statusRows = useMemo(() => {
    if (!tabsVisible) return active;
    if (listStatus === "all") return rows;
    return rows.filter((r) => r.status === listStatus);
  }, [rows, active, listStatus, tabsVisible]);

  // Per-filter counts. Problem lenses only apply to the active book, so they
  // count there; ownership/service apply within the visible tab, so they count
  // against that slice — keeping each badge honest to what a tick would show.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const section of sections) for (const it of section.items) {
      const set = PROBLEM_FILTERS.includes(it.key) ? active : statusRows;
      c[it.key] = set.filter((r) => hits(r, it.key)).length;
    }
    return c;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, active, statusRows, quietSet, noSolSet, stalledSet, currentUserId]);

  // No filters → hand the list every row so its status tabs still span
  // active/on_hold/completed/withdrawn. Any filter → the matching subset.
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
      initialStatus={initialStatus}
      showStatusTabs={showStatusTabs && !hasProblemSelected}
      showAgencyColumn={showAgencyColumn}
      showAssignedToColumn={showAssignedToColumn}
      onStatusChange={setListStatus}
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
          sections={sections}
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
