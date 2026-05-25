"use client";

// components/account/v2/ThemePickerPlain.tsx
//
// Theme picker re-housed for the Account/Profile tab. Wiring identical to
// the original ThemePicker — uses the same useAgentTheme + useAgentMobileTheme
// hooks (server actions: updateAgentTheme / updateAgentMobileTheme) and the
// same per-tile optimistic-update pattern. Reuses the original component's
// ThemeTile + DesktopThemePreview + MobileThemePreview + THEME_META so the
// preview tiles are byte-identical between the two surfaces.
//
// The only difference is the container chrome: no glass-card wrappers,
// just the section header + tile grid, sitting flat on the Account canvas.
// The mobile-theme subsection only renders on <lg viewports — same as
// the original.

import { useState } from "react";
import { useAgentTheme, useAgentMobileTheme } from "@/lib/agent/use-theme";
import {
  AGENT_THEMES,
  MOBILE_AGENT_THEMES,
  type AgentTheme,
  type MobileAgentTheme,
} from "@/lib/agent/themes";
import {
  ThemeTile,
  DesktopThemePreview,
  MobileThemePreview,
  THEME_META,
} from "@/components/agent/ThemePicker";

export function ThemePickerPlain({
  currentTheme,
  currentMobileTheme,
}: {
  currentTheme: AgentTheme;
  currentMobileTheme: MobileAgentTheme;
}) {
  const { setTheme } = useAgentTheme();
  const { setMobileTheme } = useAgentMobileTheme();

  const [activeTheme, setActiveTheme] = useState<AgentTheme>(currentTheme);
  const [activeMobileTheme, setActiveMobileTheme] = useState<MobileAgentTheme>(currentMobileTheme);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Desktop themes */}
      <div className="agent-theme-grid">
        {AGENT_THEMES.map((theme) => (
          <ThemeTile
            key={theme}
            isActive={theme === activeTheme}
            onSelect={() => {
              setActiveTheme(theme);
              setTheme(theme);
            }}
            ariaLabel={`Switch to ${THEME_META[theme].name} theme${theme === activeTheme ? " (currently active)" : ""}`}
            preview={<DesktopThemePreview theme={theme} isActive={theme === activeTheme} />}
            label={null}
          />
        ))}
      </div>

      {/* Mobile themes — only visible on ≤1024px viewports (same gating
          as the original ThemePicker); pure presentational sub-section. */}
      <div className="lg:hidden" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Mobile theme</div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Just for you, just for your phone. Separate from your desktop theme — pick whatever
            feels easier on a small screen.
          </p>
        </div>
        <div className="agent-theme-grid">
          {MOBILE_AGENT_THEMES.map((theme) => (
            <ThemeTile
              key={theme}
              isActive={theme === activeMobileTheme}
              onSelect={() => {
                setActiveMobileTheme(theme);
                setMobileTheme(theme);
              }}
              ariaLabel={`Switch mobile theme to ${theme}${theme === activeMobileTheme ? " (currently active)" : ""}`}
              preview={<MobileThemePreview theme={theme} isActive={theme === activeMobileTheme} />}
              label={null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
