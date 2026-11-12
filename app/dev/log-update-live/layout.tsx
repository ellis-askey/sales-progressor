// /dev/log-update-live layout — renders the REAL Log-an-update components inside
// the live agent surface (tokens + App Colour + Elevra background + a
// .agent-shell-root the modals portal into), so what you see is what ships.
// Dev-only. The page flips light/dark by setting data-theme on .agent-shell-root.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevLogUpdateLiveLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root" data-theme="custom">
        {children}
      </div>
    </div>
  );
}
