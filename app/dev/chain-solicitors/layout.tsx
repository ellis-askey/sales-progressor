// /dev/chain-solicitors layout — renders the proposed chain-card solicitor row
// inside the real agent surface (tokens + App Colour + Elevra background). Mirrors
// the proven /dev/partners-rework layout so the backdrop + light/dark match the
// real app. Dev-only; nothing is wired to data. The page flips light/dark via
// document.documentElement.dataset.theme.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { GlassPicksProvider } from "@/lib/glass/context";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevChainSolicitorsLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root" data-theme="custom">
        {/* Design Lab needs the picks context; empty picks = default look. */}
        <GlassPicksProvider initialPicks={{}}>
          {children}
        </GlassPicksProvider>
      </div>
    </div>
  );
}
