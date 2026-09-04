// /dev/sheets layout — reproduces the REAL agent-app environment so every
// drawer / modal / notification renders against the exact background,
// theming and providers it sees in production.
//
// What this mirrors from app/agent/layout.tsx (the live agent shell):
//   - ThemeModeBoot: sets data-theme (light|dark) + .elevra-bg on <html>
//     pre-paint, so the WebGL backdrop + elevra body gradients are correct
//     on first frame and the dark toggle works.
//   - brandThemeCss(null): the default coral brand token set on
//     [data-theme="custom"], the same derivation the live app injects. This
//     is what makes every var(--agent-*) resolve — including inside modals
//     that portal to <body> and re-stamp data-theme="custom" via
//     usePortalTheme().
//   - <AppBackground />: the canonical WebGL iridescence (light) / soft
//     aurora (dark) backdrop. NOT the old SVG-plasma approximation. This is
//     the surface you judge drawer translucency + backdrop blur against.
//   - <GlassPicksProvider> + <AgentToaster>: the two context providers the
//     agent surfaces mount, so glass cards and toast-driven components
//     behave exactly as they do live.
//
// Dev-only (page.tsx blocks in production). Nothing here touches any other
// route. See docs/active/sheets-inspection/README.md.

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

export default function SheetsLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme="custom" + the brand token <style> exactly mirror the live
    // agent layout wrapper, so tokens resolve identically here and in portals.
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      {/* The root layout shows the cookie-consent banner to signed-out visitors
          (which /dev/sheets is). It sits bottom-right and covers the very
          drawer/modal footers this page exists to review, so hide it here. This
          global rule only lives while the /dev/sheets layout is mounted. */}
      <style dangerouslySetInnerHTML={{ __html: `[role="region"][aria-label="Cookie consent"]{display:none!important;}` }} />
      <ThemeModeBoot initialMode="system" initialAuroraOpacity={100} />
      <ThemeModeReapply initialMode="system" initialAuroraOpacity={100} />
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
