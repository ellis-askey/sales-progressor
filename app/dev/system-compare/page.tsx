import { notFound } from "next/navigation";
import { SystemCompare } from "./SystemCompare";

// Dev-only visual comparison bench for the REAL button / card-glass / modal /
// drawer / hover implementations that ship today. 404 in production (same
// prod-block convention as the rest of /dev — see app/dev/welcome-modals).
//
// This page RENDERS the real components and CSS classes unchanged. Nothing here
// is a recreation or a redesign; it only displays what already exists, side by
// side, so the canonical-vs-legacy-vs-bespoke variants can be compared and a
// standard chosen. It mutates no component, style, token, doc or data.
export default function SystemComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SystemCompare />;
}
