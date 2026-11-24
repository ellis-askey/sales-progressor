// Loads the agent token + style layer for this one audit page, so the canonical
// components that portal to document.body (AnchoredPanel / .ui-pop-pick menu)
// resolve their --agent-* tokens and styling exactly as they do in the app.
// Mirrors app/dev/menus/layout.tsx (the proven menu environment). Dev-only.

import type { ReactNode } from "react";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { ThemeModeReapply } from "@/components/theme/ThemeModeReapply";
import { GlassPicksProvider } from "@/lib/glass/context";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";
import "@/app/styles/glass.css";

export default function NewSaleCompleteAuditLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      <ThemeModeBoot initialMode="light" initialAuroraOpacity={100} />
      <ThemeModeReapply initialMode="light" initialAuroraOpacity={100} />
      <GlassPicksProvider initialPicks={{}}>
        {children}
      </GlassPicksProvider>
    </div>
  );
}
