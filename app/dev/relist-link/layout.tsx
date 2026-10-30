// /dev/relist-link layout — renders the add-sale -> add-new-buyer link UI against
// the real agent-app tokens, so the mockup reads as the shipping product. Dev-only
// (page.tsx blocks in production). Mirrors /dev/needs-filing.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { ThemeModeReapply } from "@/components/theme/ThemeModeReapply";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevRelistLinkLayout({ children }: { children: ReactNode }) {
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
