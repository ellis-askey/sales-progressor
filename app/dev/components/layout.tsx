// Loads the real agent token + style layer for the component gallery, so entries
// that render true app components (agent-pill, .ui-pop-pick menu rows, etc.)
// resolve their --agent-* tokens — including content that portals to
// document.body (AnchoredPanel). The Workspace sets data-theme on <html>, which
// is what the portal reads. agent-system.css carries no unscoped element
// selectors, so it never restyles the gallery's own chrome. Dev-only.

import type { ReactNode } from "react";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";
import "@/app/styles/glass.css";

export default function ComponentsGalleryLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
