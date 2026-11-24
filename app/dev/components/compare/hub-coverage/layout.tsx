// Isolated layout for the Hub coverage compare. Loads the real agent token + style
// layer so the reproduced hub specimens render true-to-app. Dev-only, read-only.

import type { ReactNode } from "react";
import { GlassPicksProvider } from "@/lib/glass/context";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";
import "@/app/styles/glass.css";
import "@/components/arc/cookie-consent/scope.css";

export default function HubCoverageLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      <style dangerouslySetInnerHTML={{ __html: `[role="dialog"][aria-modal="false"]{display:none!important;}` }} />
      <GlassPicksProvider initialPicks={{}}>{children}</GlassPicksProvider>
    </div>
  );
}
