// Loads the agent token + style layer for this audit page so token-driven
// canonical components (Pill, breakdown rows, LabelInput accents) resolve their
// --agent-* variables. Mirrors the new-sale-complete layout. Dev-only.

import type { ReactNode } from "react";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { ThemeModeReapply } from "@/components/theme/ThemeModeReapply";
import { GlassPicksProvider } from "@/lib/glass/context";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";
import "@/app/styles/glass.css";

export default function NewSaleComplete2AuditLayout({ children }: { children: ReactNode }) {
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
