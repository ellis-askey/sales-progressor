// /dev/file-view-v2 layout — reproduces the agent-app token environment so the
// improved file view resolves the real --agent-* tokens, glass system and aurora
// exactly as it would live under /agent/*. Dev-only (page.tsx blocks in prod).

import type { ReactNode } from "react";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";
import "@/app/styles/glass.css";

export default function FileViewV2DevLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      <ThemeModeBoot initialMode="system" initialAuroraOpacity={100} />
      <div className="agent-shell-root" data-theme="custom">
        {children}
      </div>
    </div>
  );
}
