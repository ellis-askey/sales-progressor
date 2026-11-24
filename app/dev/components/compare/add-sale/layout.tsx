// Isolated layout for the Add-Sale canonical comparison workspace. Loads the real
// agent token + style layer so current/proposed cards render true-to-app (including
// portalled menus). The page itself drives light/dark by setting html[data-theme].
// Dev-only, read-only — nothing here touches the production Add-Sale flow.

import type { ReactNode } from "react";
import { GlassPicksProvider } from "@/lib/glass/context";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";
import "@/app/styles/glass.css";
import "@/components/arc/cookie-consent/scope.css";

export default function AddSaleCompareLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      {/* The global cookie-consent banner (fixed bottom bar, role=dialog aria-modal=false)
          would overlay the comparisons on this dev page. */}
      <style dangerouslySetInnerHTML={{ __html: `[role="dialog"][aria-modal="false"]{display:none!important;}` }} />
      <GlassPicksProvider initialPicks={{}}>{children}</GlassPicksProvider>
    </div>
  );
}
