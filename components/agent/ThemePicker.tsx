"use client";

import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { useAgentTheme, useAgentMobileTheme } from "@/lib/agent/use-theme";
import { AGENT_THEMES, MOBILE_AGENT_THEMES, type AgentTheme, type MobileAgentTheme } from "@/lib/agent/themes";

interface ThemePickerProps {
  currentTheme: AgentTheme;
  currentMobileTheme: MobileAgentTheme;
}

const THEME_META: Record<AgentTheme, { name: string; tagline: string }> = {
  sunset:   { name: "Sunset",   tagline: "Warm and modern"     },
  coastal:  { name: "Coastal",  tagline: "Calm and fresh"      },
  heritage: { name: "Heritage", tagline: "Trustworthy classic" },
  slate:    { name: "Slate",    tagline: "Modern minimal"      },
  emerald:  { name: "Emerald",  tagline: "Premium established" },
  claret:   { name: "Claret",   tagline: "Distinctive bold"    },
};

const MOBILE_THEME_META: Record<MobileAgentTheme, { name: string; tagline: string; bg: string; accent: string }> = {
  heritage: { name: "Heritage", tagline: "Trustworthy classic", bg: "linear-gradient(135deg, #DCE7F8 0%, #D5D8F0 100%)", accent: "#4A6FB5" },
  sage:     { name: "Sage",     tagline: "Natural and grounding", bg: "linear-gradient(135deg, #E6F0EB 0%, #DCE8E2 100%)", accent: "#3D7A55" },
  dusk:     { name: "Dusk",     tagline: "Calm and moody",      bg: "linear-gradient(135deg, #EDE8F5 0%, #DDD8EC 100%)", accent: "#7A5FB5" },
  stone:    { name: "Stone",    tagline: "Works in any light",  bg: "linear-gradient(135deg, #EEEAE4 0%, #DDD7CE 100%)", accent: "#7A6B60" },
  mist:     { name: "Mist",     tagline: "Crisp and airy",      bg: "linear-gradient(135deg, #E8F0F7 0%, #D5E2EE 100%)", accent: "#4A7A9B" },
  blush:    { name: "Blush",    tagline: "Gentle and warm",     bg: "linear-gradient(135deg, #F5ECF0 0%, #ECDDE8 100%)", accent: "#A0607A" },
};

function ThemeTile({
  isActive,
  onSelect,
  label,
  ariaLabel,
  preview,
}: {
  isActive: boolean;
  onSelect: () => void;
  label: React.ReactNode;
  ariaLabel: string;
  preview: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      style={{
        position: "relative",
        padding: 0,
        cursor: "pointer",
        background: "transparent",
        border: "none",
        boxShadow: isActive
          ? "0 0 0 2px var(--agent-coral-deep)"
          : hovered
            ? "0 0 0 2px var(--agent-border-strong)"
            : "0 0 0 1px var(--agent-border-default)",
        borderRadius: "var(--agent-radius-lg)",
        overflow: "hidden",
        textAlign: "left",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {preview}
      {label}
    </button>
  );
}

function DesktopThemePreview({ theme, isActive }: { theme: AgentTheme; isActive: boolean }) {
  return (
    <div data-theme={theme} style={{ borderRadius: "var(--agent-radius-lg)", overflow: "hidden" }}>
      <div style={{
        position: "relative",
        height: 130,
        background: "linear-gradient(135deg, var(--agent-bg-base) 0%, var(--agent-bg-warm) 100%)",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 8, top: 8, bottom: 8, width: 36,
          borderRadius: 6,
          background: "linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%)",
        }}>
          <div style={{ position: "absolute", left: 4, right: 4, top: 8, height: 6, borderRadius: 3, background: "var(--agent-text-on-coral)", opacity: 0.9 }} />
          <div style={{ position: "absolute", left: 4, right: 4, top: 20, height: 3, borderRadius: 2, background: "var(--agent-text-on-coral)", opacity: 0.3 }} />
          <div style={{ position: "absolute", left: 4, right: 4, top: 28, height: 3, borderRadius: 2, background: "var(--agent-text-on-coral)", opacity: 0.3 }} />
        </div>
        <div style={{ position: "absolute", right: 12, top: 12, width: 52, height: 14, borderRadius: 5, background: "linear-gradient(135deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%)" }} />
        <div style={{
          position: "absolute", left: 52, right: 12, top: 34, bottom: 10,
          borderRadius: 6, background: "var(--agent-surface-elevated)", border: "0.5px solid rgba(0,0,0,0.06)", padding: 6, overflow: "hidden",
        }}>
          <div style={{ height: 4, width: "45%", borderRadius: 2, background: "var(--agent-text-secondary)", opacity: 0.45, marginBottom: 5 }} />
          <div style={{ height: 10, borderRadius: 3, background: "rgba(199,62,62,0.08)", borderLeft: "2px solid #C73E3E", marginBottom: 6 }} />
          <div style={{ display: "flex", gap: 4 }}>
            {(["var(--agent-success)", "var(--agent-coral-deep)", "var(--agent-danger)"] as const).map((color, i) => (
              <div key={i} style={{ flex: 1, height: 26, borderRadius: 4, background: "var(--agent-bg-base)", position: "relative" }}>
                <div style={{ position: "absolute", top: 4, left: 4, width: i === 1 ? 8 : 10, height: 5, borderRadius: 1, background: color }} />
                <div style={{ position: "absolute", bottom: 4, left: 4, right: 4, height: 2, borderRadius: 1, background: "var(--agent-text-tertiary)", opacity: 0.35 }} />
              </div>
            ))}
          </div>
        </div>
        {isActive && (
          <div style={{
            position: "absolute", top: 10, right: 10, width: 24, height: 24,
            borderRadius: "50%", background: "var(--agent-coral-deep)", color: "var(--agent-text-on-coral)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.20)", zIndex: 2,
          }}>
            <Check size={13} weight="bold" />
          </div>
        )}
      </div>
      <div style={{ padding: "9px 11px", background: "var(--agent-surface-elevated)", borderTop: "0.5px solid var(--agent-border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            {THEME_META[theme].name}
          </span>
          {isActive && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "2px 7px",
              borderRadius: "var(--agent-radius-pill)",
              background: "var(--agent-coral-pale)", color: "var(--agent-coral-darker)",
              letterSpacing: "0.03em", textTransform: "uppercase" as const,
            }}>Active</span>
          )}
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: "var(--agent-text-secondary)" }}>
          {THEME_META[theme].tagline}
        </div>
      </div>
    </div>
  );
}

function MobileThemePreview({ theme, isActive }: { theme: MobileAgentTheme; isActive: boolean }) {
  const meta = MOBILE_THEME_META[theme];
  return (
    <div style={{ borderRadius: "var(--agent-radius-lg)", overflow: "hidden" }}>
      <div style={{ position: "relative", height: 110, background: meta.bg, overflow: "hidden" }}>
        {/* Top bar simulating mobile header */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 28,
          background: "rgba(255,255,255,0.18)", borderBottom: "0.5px solid rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", padding: "0 10px", gap: 6,
        }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: meta.accent, opacity: 0.6 }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)" }} />
        </div>
        {/* Content rows */}
        <div style={{ position: "absolute", top: 38, left: 10, right: 10 }}>
          <div style={{ height: 10, borderRadius: 4, background: "rgba(255,255,255,0.55)", marginBottom: 6 }} />
          <div style={{ height: 10, borderRadius: 4, background: "rgba(255,255,255,0.40)", marginBottom: 6, width: "80%" }} />
          <div style={{ display: "flex", gap: 5 }}>
            <div style={{ flex: 1, height: 22, borderRadius: 4, background: "rgba(255,255,255,0.45)", borderLeft: `2.5px solid ${meta.accent}` }} />
            <div style={{ flex: 1, height: 22, borderRadius: 4, background: "rgba(255,255,255,0.30)" }} />
          </div>
        </div>
        {/* Accent chip */}
        <div style={{
          position: "absolute", bottom: 8, right: 10,
          width: 36, height: 12, borderRadius: 6,
          background: meta.accent, opacity: 0.8,
        }} />
        {isActive && (
          <div style={{
            position: "absolute", top: 8, right: 10, width: 22, height: 22,
            borderRadius: "50%", background: meta.accent, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(0,0,0,0.20)", zIndex: 2,
          }}>
            <Check size={12} weight="bold" />
          </div>
        )}
      </div>
      <div style={{ padding: "9px 11px", background: "var(--agent-surface-elevated)", borderTop: "0.5px solid var(--agent-border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{meta.name}</span>
          {isActive && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: "2px 7px",
              borderRadius: "var(--agent-radius-pill)",
              background: "var(--agent-coral-pale)", color: "var(--agent-coral-darker)",
              letterSpacing: "0.03em", textTransform: "uppercase" as const,
            }}>Active</span>
          )}
        </div>
        <div style={{ fontSize: 11, marginTop: 2, color: "var(--agent-text-secondary)" }}>{meta.tagline}</div>
      </div>
    </div>
  );
}

export function ThemePicker({ currentTheme, currentMobileTheme }: ThemePickerProps) {
  const { setTheme } = useAgentTheme();
  const { setMobileTheme } = useAgentMobileTheme();

  const [activeTheme, setActiveTheme] = useState<AgentTheme>(currentTheme);
  const [activeMobileTheme, setActiveMobileTheme] = useState<MobileAgentTheme>(currentMobileTheme);

  function handleSelectDesktop(theme: AgentTheme) {
    setActiveTheme(theme);
    setTheme(theme);
  }

  function handleSelectMobile(mobileTheme: MobileAgentTheme) {
    setActiveMobileTheme(mobileTheme);
    setMobileTheme(mobileTheme);
  }

  return (
    <div className="space-y-5">
      {/* Desktop theme */}
      <div className="glass-card p-6">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-slate-900/80 mb-1">Branch theme</h2>
          <p className="text-xs text-slate-900/50">
            Your personal theme — visible only to you, not your whole branch. Applies instantly.
          </p>
        </div>
        <div className="agent-theme-grid">
          {AGENT_THEMES.map((theme) => (
            <ThemeTile
              key={theme}
              isActive={theme === activeTheme}
              onSelect={() => handleSelectDesktop(theme)}
              ariaLabel={`Switch to ${THEME_META[theme].name} theme${theme === activeTheme ? " (currently active)" : ""}`}
              preview={<DesktopThemePreview theme={theme} isActive={theme === activeTheme} />}
              label={null}
            />
          ))}
        </div>
      </div>

      {/* Mobile theme — only visible on ≤1024px */}
      <div className="glass-card p-6 lg:hidden">
        <div className="mb-5">
          <h2 className="text-sm font-bold text-slate-900/80 mb-1">Mobile theme</h2>
          <p className="text-xs text-slate-900/50">
            Just for you, just for your phone. Separate from your desktop theme — pick whatever feels easier on a small screen.
          </p>
        </div>
        <div className="agent-theme-grid">
          {MOBILE_AGENT_THEMES.map((theme) => (
            <ThemeTile
              key={theme}
              isActive={theme === activeMobileTheme}
              onSelect={() => handleSelectMobile(theme)}
              ariaLabel={`Switch mobile theme to ${MOBILE_THEME_META[theme].name}${theme === activeMobileTheme ? " (currently active)" : ""}`}
              preview={<MobileThemePreview theme={theme} isActive={theme === activeMobileTheme} />}
              label={null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
