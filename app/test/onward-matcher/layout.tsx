// /test/onward-matcher layout — agent-app token environment so the matcher
// renders exactly as it will in the chain flow. Disposable test harness for the
// Phase 2 "same person?" matcher against REAL seeded data (see
// scripts/seed-onward-matcher-demo.ts). Auth-gated by the action; dev-only.

import type { ReactNode } from "react";
import { ThemeModeBoot } from "@/components/theme/ThemeModeBoot";
import { brandThemeCss } from "@/lib/agent/brand-theme";
import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "@/app/styles/elevra.css";
import "@/app/styles/glass.css";

export default function OnwardMatcherTestLayout({ children }: { children: ReactNode }) {
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
