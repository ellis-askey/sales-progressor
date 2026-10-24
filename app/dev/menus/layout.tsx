// /dev/menus — surface-options harness for the little-menus / tooltips / popovers
// consolidation. Mirrors the real agent-app environment (tokens, backdrop,
// providers) so the candidate surfaces render true-to-app, in light AND dark
// (toggle on the page). Dev-only (page.tsx blocks in production).
//
// Copied from app/dev/sheets/layout.tsx — same token + theme plumbing.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { ThemeModeReapply } from "@/components/theme/ThemeModeReapply";
import { GlassPicksProvider } from "@/lib/glass/context";
import { AgentToaster } from "@/components/agent/AgentToaster";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";
import "@/app/styles/glass.css";

export default function DevMenusLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      <style dangerouslySetInnerHTML={{ __html: `[role="region"][aria-label="Cookie consent"]{display:none!important;}` }} />
      <ThemeModeBoot initialMode="light" initialAuroraOpacity={100} />
      <ThemeModeReapply initialMode="light" initialAuroraOpacity={100} />
      <AppBackground />
      <GlassPicksProvider initialPicks={{}}>
        <AgentToaster>
          <div className="agent-shell-root" data-theme="custom">
            {children}
          </div>
        </AgentToaster>
      </GlassPicksProvider>
    </div>
  );
}
