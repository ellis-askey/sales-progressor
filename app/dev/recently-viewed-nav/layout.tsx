// /dev/recently-viewed-nav layout — real agent surface so the dropdown glass
// refracts over the genuine backdrop. Mirrors the other /dev labs. Dev-only.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { GlassPicksProvider } from "@/lib/glass/context";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevRecentlyViewedNavLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root" data-theme="custom">
        <GlassPicksProvider initialPicks={{}}>
          {children}
        </GlassPicksProvider>
      </div>
    </div>
  );
}
