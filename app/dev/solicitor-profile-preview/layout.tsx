// /dev/solicitor-profile-preview layout — renders the real SolicitorProfileView
// inside the live agent surface (tokens + background) with no auth, so the Phase-B
// visual refinement can be eyeballed + screenshotted. Dev-only; mock data.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevSolicitorProfilePreviewLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root" data-theme="custom">{children}</div>
    </div>
  );
}
