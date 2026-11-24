// /dev/toast-lab layout — the real agent surface (tokens + App Colour + Elevra
// background) so glass materials refract over the genuine backdrop. Mirrors
// /dev/chain-email-audience. Dev-only; flips light/dark via the page.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { GlassPicksProvider } from "@/lib/glass/context";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevToastLabLayout({ children }: { children: ReactNode }) {
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
