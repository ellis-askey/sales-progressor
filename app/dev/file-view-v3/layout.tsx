// /dev/file-view-v3 layout — reproduces the agent-app token environment (coral,
// ink, fonts) so the concept resolves real --agent-* tokens, but suppresses the
// glass aurora: v3 paints its own warm-paper ground. Dev-only concept; page.tsx
// blocks in production. Self-contained — touches no shared component or token.

import type { ReactNode } from "react";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";

export default function FileViewV3DevLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      <ThemeModeBoot initialMode="system" initialAuroraOpacity={0} />
      <div className="agent-shell-root" data-theme="custom">
        {children}
      </div>
    </div>
  );
}
