// /dev/background-studio layout — reproduces the agent-app token environment so
// the settings card chrome (glass, coral, --agent-* vars) resolves exactly as it
// does live. Unlike /dev/sheets this layout does NOT mount <AppBackground />:
// the sandbox mounts its own colour-driven instance so the live colour picks
// flow straight into the real WebGL shaders.
//
// Dev-only (page.tsx blocks in production). Nothing here touches any other route.

import type { ReactNode } from "react";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";
import "@/app/styles/glass.css";

export default function BackgroundStudioLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      {/* Hide the global cookie-consent banner (signed-out visitors see it) so it
          doesn't cover the bottom editing dock. Scoped to this layout's lifetime. */}
      <style dangerouslySetInnerHTML={{ __html: `[role="region"][aria-label="Cookie consent"]{display:none!important;}` }} />
      <ThemeModeBoot initialMode="system" initialAuroraOpacity={100} />
      <div className="agent-shell-root" data-theme="custom">
        {children}
      </div>
    </div>
  );
}
