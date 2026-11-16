// Status pill (label + CSS class) for a progression client's sale rows. Shared by
// the client workspace Sales tab (`.aw-spill`) and the Overview "Recent sales"
// list (`.ov-spill`), which both use these class names. "Exchanged" is derived
// from exchangedAt (it isn't a status) and only applies to an active sale, so the
// terminal states are checked first. Drafts are filtered out of the list upstream;
// the draft case is kept here only as a safety net.
export function salePill(status: string, exchanged?: boolean): { label: string; cls: string } {
  if (status === "completed") return { label: "Completed", cls: "done" };
  if (status === "withdrawn") return { label: "Withdrawn", cls: "withdrawn" };
  if (status === "on_hold") return { label: "On hold", cls: "hold" };
  if (status === "draft") return { label: "Draft", cls: "muted" };
  if (exchanged) return { label: "Exchanged", cls: "exchanged" };
  return { label: "Active", cls: "active" };
}
