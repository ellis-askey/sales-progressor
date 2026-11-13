// /dev/bell-check — isolates the notification bell inside the experimental
// capsule (agx-cap) so its resting + unread states can be eyeballed and cleaned
// up without an Ellis session. Dev-only.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "../../agent/styles/shell-experimental.css";
import "@/app/styles/elevra.css";

export default function DevBellCheckLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root agx-root" data-theme="custom">{children}</div>
    </div>
  );
}
