// /dev/chain-email-audience layout — renders the proposed "Email the chain"
// audience toggle (Agents / Solicitors) inside the real agent surface (tokens +
// App Colour + Elevra background). Mirrors /dev/chain-solicitors. Dev-only,
// nothing wired to data. Flips light/dark via document.documentElement.dataset.theme.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { GlassPicksProvider } from "@/lib/glass/context";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevChainEmailAudienceLayout({ children }: { children: ReactNode }) {
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
