// /dev/whatsapp-group-v2 layout — renders the proposed WhatsApp-group drawer
// redesign inside the real agent surface (tokens + App Colour + background) so
// what you judge is what would ship. Dev-only; nothing is wired to data. The
// page drives light/dark itself via document.documentElement.dataset.theme.

import type { ReactNode } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { appColourCss, DEFAULT_APP_COLOUR } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";

export default function DevWhatsappGroupV2Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: appColourCss(DEFAULT_APP_COLOUR) }} />
      <AppBackground />
      <div className="agent-shell-root">
        {children}
      </div>
    </div>
  );
}
