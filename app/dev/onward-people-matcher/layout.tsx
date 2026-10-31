// /dev/onward-people-matcher layout — reproduces the agent-app token environment
// so the matcher's chrome (glass-input, coral, --agent-* vars) resolves exactly
// as it will live in the chain flow. Dev-only (page.tsx blocks in production).

import type { ReactNode } from "react";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";
import "@/app/styles/glass.css";

export default function OnwardPeopleMatcherDevLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="custom" style={{ display: "contents" }}>
      <style dangerouslySetInnerHTML={{ __html: brandThemeCss(null) }} />
      <ThemeModeBoot initialMode="system" initialAuroraOpacity={100} />
      <div className="agent-shell-root" data-theme="custom">
        {children}
      </div>
    </div>
  );
}
