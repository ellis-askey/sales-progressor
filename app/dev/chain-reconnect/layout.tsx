// /dev/chain-reconnect layout — renders the reactivation "reconnect the chain"
// prompt against the real agent-app environment + App Colour tokens, so what you
// judge is what ships. Dev-only (page.tsx blocks in prod).

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { ThemeModeReapply } from "@/components/theme/ThemeModeReapply";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevChainReconnectLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <ThemeModeBoot initialMode="system" initialAuroraOpacity={100} />
      <ThemeModeReapply initialMode="system" initialAuroraOpacity={100} />
      <AppBackground />
      <div className="agent-shell-root" data-theme="custom">
        {children}
      </div>
    </div>
  );
}
