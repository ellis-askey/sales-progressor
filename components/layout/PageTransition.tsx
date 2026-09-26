"use client";

// Consistent page entrance (fade + rise) for every agent-app page. Applied once,
// around AgentShell's content slot. Keyed on the TOP-LEVEL route segment so it
// replays when you move between pages (hub → chains → enquiries …) but NOT when
// you switch tabs within a file (the segment stays "transactions") — the file
// page keeps its own instant per-tab TabEnter, so this never double-animates or
// re-fades the file shell on a tab click. Pure CSS (opacity + transform) that
// runs after content paints, so it never delays a load; reduced-motion disables
// it. See the "all pages should fade in and up" critique.

import { usePathname } from "next/navigation";

function topSegment(pathname: string | null): string {
  if (!pathname) return "";
  const parts = pathname.split("/").filter(Boolean); // ["agent","chains"] | ["agent","transactions","id","steps"]
  const i = parts.indexOf("agent");
  return (i >= 0 ? parts[i + 1] : parts[0]) ?? "";
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const seg = topSegment(usePathname());
  // The file page animates its own tabs (TabEnter). Animating the shell here too
  // would double up and re-fade the whole file on every tab switch — so skip it.
  if (seg === "transactions") return <>{children}</>;
  return (
    <div key={seg} className="page-fade-up">
      {children}
    </div>
  );
}
