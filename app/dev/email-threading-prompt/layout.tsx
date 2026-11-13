// /dev/email-threading-prompt — shows the "Continue conversation?" prompt inside
// a mock email composer, rendered both ways (reliable full-recipient match vs
// first-recipient-only), so the data approach can be chosen by eye. Dev-only.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";

export default function DevEmailThreadingPromptLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root" data-theme="custom">{children}</div>
    </div>
  );
}
