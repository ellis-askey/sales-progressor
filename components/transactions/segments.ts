// Smart filters for the All Files workspace — one multi-select menu behind the
// Filter button (see FilterMenu.tsx), applied in FilesWorkspace across every
// view. The menu is split into sections; rows within a section OR together,
// sections AND together. Nothing ticked = every active file.
//
//   Yours            Mine, + a row per owner (director/admin)      → OR
//   Needs attention  At risk / Gone quiet / No solicitor / Stalled → OR (active book)
//   Service          Self-managed / Outsourced                     → OR
//
// Owner rows are dynamic (`owner:<userId>`); everything else is a fixed key.

export type StaticFilterKey =
  | "mine"
  | "risk" | "quiet" | "nosolicitor" | "stalled"
  | "selfmanaged" | "outsourced";

export type FilterKey = StaticFilterKey | `owner:${string}`;

// The problem lenses — OR among themselves, then AND-ed with the other
// sections. These only apply to the active book (a completed file isn't "at
// risk"), so ticking any of them scopes the workspace to active files.
export const PROBLEM_FILTERS: FilterKey[] = ["risk", "quiet", "nosolicitor", "stalled"];

// The service lenses — status-agnostic (an outsourced file is outsourced
// whatever its status), so they apply on top of the current status tab.
export const SERVICE_FILTERS: FilterKey[] = ["selfmanaged", "outsourced"];

export function isOwnerKey(k: FilterKey): k is `owner:${string}` {
  return k.startsWith("owner:");
}
export function ownerIdOf(k: `owner:${string}`): string {
  return k.slice("owner:".length);
}

// Label + leading-dot semantic for the fixed keys. `dot` maps to the --agent-*
// tone used for the row's leading dot; ownership / service rows have none.
export const FILTER_META: Record<StaticFilterKey, { label: string; dot?: string }> = {
  mine:        { label: "Mine" },
  risk:        { label: "At risk",      dot: "danger" },
  quiet:       { label: "Gone quiet",   dot: "warning" },
  nosolicitor: { label: "No solicitor", dot: "info" },
  stalled:     { label: "Stalled 14d+", dot: "snoozed" },
  selfmanaged: { label: "Self-managed" },
  outsourced:  { label: "Outsourced" },
};
