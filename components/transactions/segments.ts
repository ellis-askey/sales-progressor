// Smart filters for the All Files active book — a multi-select menu behind the
// Filter button (see FilterMenu.tsx), applied in FilesWorkspace. Hybrid logic:
// "Mine" narrows to your files; the problem filters (risk / quiet / no-solicitor
// / stalled) OR among themselves. Nothing ticked = every active file.

export type FilterKey = "mine" | "risk" | "quiet" | "nosolicitor" | "stalled";

// `dot` maps to the --agent-* semantic used for the row's leading dot. "Mine"
// has no dot — it's an ownership filter, not a problem lens.
export const FILTERS: { key: FilterKey; label: string; dot?: string }[] = [
  { key: "mine", label: "Mine" },
  { key: "risk", label: "At risk", dot: "danger" },
  { key: "quiet", label: "Gone quiet", dot: "warning" },
  { key: "nosolicitor", label: "No solicitor", dot: "info" },
  { key: "stalled", label: "Stalled 14d+", dot: "snoozed" },
];

// The problem lenses — combined with OR (a file matches if it hits ANY ticked
// problem), then AND-ed with the Mine scope.
export const PROBLEM_FILTERS: FilterKey[] = ["risk", "quiet", "nosolicitor", "stalled"];
